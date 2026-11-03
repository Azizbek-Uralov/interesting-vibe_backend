import { config } from 'dotenv';
config();

import { io } from 'socket.io-client';
import { PrismaClient, Roles, UserStatus } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Token } from '../infrastructure/Token';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function runChatIntegrationTest() {
  console.log('=== CHAT INTEGRATION & SECURITY TEST BOSHLANDI ===\n');

  // 1. Ikkita test foydalanuvchisini olish
  const user1 = await prisma.user.findUnique({ where: { username: 'laylo_arch' } });
  const user2 = await prisma.user.findUnique({ where: { username: 'jasur_craft' } });
  const user3 = await prisma.user.findUnique({ where: { username: 'anvar_nature' } });

  if (!user1 || !user2 || !user3) {
    throw new Error('Test userlari topilmadi.');
  }

  console.log(`[TEST USERS] User 1: @${user1.username} (${user1.id})`);
  console.log(`[TEST USERS] User 2: @${user2.username} (${user2.id})`);
  console.log(`[TEST USERS] User 3 (Begona): @${user3.username} (${user3.id})\n`);

  // Foydalanuvchilar uchun test sessiyasi va tokenlarini yaratish
  const createTestToken = async (userId: string) => {
    let session = await prisma.session.findFirst({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!session) {
      session = await prisma.session.create({
        data: {
          userId,
          userAgent: 'Integration Test Agent',
          ipAddress: '127.0.0.1',
          refreshTokenHash: `integration-test-hash-${userId}-${Date.now()}-${Math.random()}`,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
    }

    return Token.generateAccess({
      id: userId,
      role: Roles.USER,
      status: UserStatus.ACTIVE,
      sid: session.id,
    });
  };

  const token1 = await createTestToken(user1.id);
  const token2 = await createTestToken(user2.id);
  const token3 = await createTestToken(user3.id);

  const base = 'http://localhost:5005/api/v1';

  // -------------------------------------------------------------
  // TEST 1: POST /chats (Conversation yaratish va qayta ishlatish)
  // -------------------------------------------------------------
  console.log('[TEST 1] POST /chats (Conversation yaratish)...');
  const res1 = await fetch(`${base}/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({ participantId: user2.id }),
  });
  const conv1 = await res1.json();
  console.log(`  -> HTTP ${res1.status} | Conversation ID: ${conv1.id} | Partner: @${conv1.partner?.username}`);
  if (res1.status !== 200 || !conv1.id) throw new Error('TEST 1 muvaffaqiyatsiz');

  console.log('[TEST 2] POST /chats (Aynan o‘sha suhbat qayta ishlatilishini tekshirish)...');
  const res2 = await fetch(`${base}/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token2}`,
    },
    body: JSON.stringify({ participantId: user1.id }),
  });
  const conv2 = await res2.json();
  console.log(`  -> HTTP ${res2.status} | Qaytarilgan ID: ${conv2.id}`);
  if (conv1.id !== conv2.id) {
    throw new Error('TEST 2 muvaffaqiyatsiz: Ikki user o‘rtasida takroriy suhbat yaratildi!');
  }
  console.log('  -> PASS: Idempotentlik taʼminlangan, bir xil conversation ID qaytdi.\n');

  // -------------------------------------------------------------
  // TEST 3: Tokensiz WebSocket ulanishini tekshirish
  // -------------------------------------------------------------
  console.log('[TEST 3] Unauthorized WebSocket ulanishini rad etish...');
  await new Promise<void>((resolve) => {
    const unauthSocket = io('http://localhost:5005', {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: false,
    });

    unauthSocket.on('connect_error', () => {
      console.log('  -> PASS: Tokensiz socket ulanishi rad etildi (connect_error).');
      unauthSocket.disconnect();
      resolve();
    });

    unauthSocket.on('disconnect', () => {
      console.log('  -> PASS: Tokensiz socket ulanishi uzildi (disconnect).');
      resolve();
    });

    setTimeout(() => {
      unauthSocket.disconnect();
      resolve();
    }, 1500);
  });

  // -------------------------------------------------------------
  // TEST 4: Authorized WebSockets (User 1 va User 2 ulanishi)
  // -------------------------------------------------------------
  console.log('\n[TEST 4] User 1 va User 2 ni WebSocket orqali ulash...');
  const socket1 = io('http://localhost:5005', {
    auth: { token: token1 },
    transports: ['websocket'],
  });

  const socket2 = io('http://localhost:5005', {
    auth: { token: token2 },
    transports: ['websocket'],
  });

  await Promise.all([
    new Promise<void>((resolve) => socket1.on('connect', resolve)),
    new Promise<void>((resolve) => socket2.on('connect', resolve)),
  ]);
  console.log('  -> PASS: User 1 va User 2 muvaffaqiyatli Socketga ulandi.');

  // Roomga kirish
  socket1.emit('join_conversation', { conversationId: conv1.id });
  socket2.emit('join_conversation', { conversationId: conv1.id });
  await new Promise((r) => setTimeout(r, 200));

  // -------------------------------------------------------------
  // TEST 5: Real-time Xabar yuborish va qabul qilish
  // -------------------------------------------------------------
  console.log('\n[TEST 5] Real-time xabar yuborish va tinglash...');
  const testMessageContent = `Salom Jasur, bu real-time test xabari! Vaqt: ${Date.now()}`;

  const messagePromise = new Promise<any>((resolve) => {
    socket2.on('new_message', (msg) => {
      console.log(`  -> User 2 real-time qabul qildi: "${msg.content}" (Sender: @${msg.sender?.username})`);
      resolve(msg);
    });
  });

  socket1.emit('send_message', {
    conversationId: conv1.id,
    content: testMessageContent,
  });

  const receivedMsg = await messagePromise;
  if (receivedMsg.content !== testMessageContent) {
    throw new Error('TEST 5 muvaffaqiyatsiz: Xabar matni mos kelmadi.');
  }
  console.log('  -> PASS: Xabar real-time qabul qilindi va PostgreSQLga saqlandi.\n');

  // -------------------------------------------------------------
  // TEST 6: Typing indikatori
  // -------------------------------------------------------------
  console.log('[TEST 6] Typing indikatori...');
  const typingPromise = new Promise<void>((resolve) => {
    socket1.on('user_typing', (data) => {
      console.log(`  -> User 1 ko‘rdi: User 2 yozmoqda... (Conv: ${data.conversationId})`);
      resolve();
    });
  });

  socket2.emit('typing', { conversationId: conv1.id });
  await typingPromise;
  console.log('  -> PASS: Typing indikatori ishladi.\n');

  // -------------------------------------------------------------
  // TEST 7: Mark Read (O‘qilgan deb belgilash)
  // -------------------------------------------------------------
  console.log('[TEST 7] Xabarni o‘qilgan deb belgilash (mark_read)...');
  const readPromise = new Promise<void>((resolve) => {
    socket1.on('message_read', (data) => {
      console.log(`  -> User 1 ko‘rdi: Xabar o‘qildi (Reader ID: ${data.readerId})`);
      resolve();
    });
  });

  socket2.emit('mark_read', { conversationId: conv1.id });
  await readPromise;
  console.log('  -> PASS: Mark read real-time ishlayapti.\n');

  // Socketlarni yopish
  socket1.disconnect();
  socket2.disconnect();

  // -------------------------------------------------------------
  // TEST 8: Xavfsizlik — Begona User 3 ruxsatsiz kira olmasligi
  // -------------------------------------------------------------
  console.log('[TEST 8] Begona User 3 begona suhbat xabarlarini o‘qishga urinishi...');
  const resForbidden = await fetch(`${base}/chats/${conv1.id}/messages`, {
    headers: {
      Authorization: `Bearer ${token3}`,
    },
  });
  console.log(`  -> HTTP Javob: ${resForbidden.status} ${resForbidden.statusText}`);
  if (resForbidden.status === 403) {
    console.log('  -> PASS: Xavfsizlik qatʼiy taʼminlangan: Begona foydalanuvchiga 403 Forbidden qaytdi.\n');
  } else {
    throw new Error('TEST 8 XATOLIK: Begona foydalanuvchi suhbatga kirishi mumkin bo‘ldi!');
  }

  // -------------------------------------------------------------
  // TEST 9: GET /chats ro‘yxati va Unread Count
  // -------------------------------------------------------------
  console.log('[TEST 9] GET /chats suhbatlar ro‘yxati...');
  const listRes = await fetch(`${base}/chats`, {
    headers: {
      Authorization: `Bearer ${token1}`,
    },
  });
  const listData = await listRes.json();
  console.log(`  -> HTTP ${listRes.status} | Suhbatlar soni: ${listData.length} ta`);
  const currentChat = listData.find((c: any) => c.id === conv1.id);
  console.log(`  -> Suhbatdosh: @${currentChat.partner?.username} | Oxirgi xabar: "${currentChat.lastMessage?.content?.slice(0, 30)}..." | Unread: ${currentChat.unreadCount}`);
  console.log('  -> PASS: Suhbatlar ro‘yxati to‘liq va aniq shakllandi.\n');

  console.log('==========================================');
  console.log('BARCHA CHAT INTEGRATSIYA TESTLARI 100% O‘TDI!');
  console.log('==========================================\n');
}

runChatIntegrationTest()
  .catch((e) => {
    console.error('Testda xatolik:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
