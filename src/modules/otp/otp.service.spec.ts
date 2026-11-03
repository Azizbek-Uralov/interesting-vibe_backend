import { Test, TestingModule } from '@nestjs/testing';
import { OtpService } from './otp.service';
import { RedisService } from '../../db/redis/redis.service';
import { PrismaService } from '../../db/prisma/prisma.service';
import { OtpPurpose } from '../../../generated/prisma/enums';

describe('OtpService', () => {
  let service: OtpService;
  let redisService: any;
  let prisma: any;

  beforeEach(async () => {
    const memoryStore = new Map<string, string>();

    redisService = {
      client: {
        set: jest.fn().mockImplementation((key, val) => {
          memoryStore.set(key, val);
          return Promise.resolve('OK');
        }),
        get: jest.fn().mockImplementation((key) => {
          return Promise.resolve(memoryStore.get(key) ?? null);
        }),
        del: jest.fn().mockImplementation((key) => {
          memoryStore.delete(key);
          return Promise.resolve(1);
        }),
        ttl: jest.fn().mockResolvedValue(55),
      },
      set: jest.fn().mockImplementation((key, val) => {
        memoryStore.set(key, val);
        return Promise.resolve('OK');
      }),
      get: jest.fn().mockImplementation((key) => {
        return Promise.resolve(memoryStore.get(key) ?? null);
      }),
      del: jest.fn().mockImplementation((key) => {
        memoryStore.delete(key);
        return Promise.resolve(1);
      }),
    };

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      otpVerification: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'otp-id-1' }),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: RedisService, useValue: redisService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  it('should normalize valid 998 phone number', () => {
    expect(service.normalize('998901234567')).toBe('+998901234567');
    expect(service.normalize('+998 (90) 123-45-67')).toBe('+998901234567');
  });

  it('should throw for invalid phone numbers', () => {
    expect(() => service.normalize('123456')).toThrow();
    expect(() => service.normalize('+12345678901')).toThrow();
  });

  it('should create Telegram session with pending status', async () => {
    const res = await service.createTelegramSession('+998901234567', OtpPurpose.SIGN_UP);

    expect(res.provider).toBe('TELEGRAM');
    expect(res.sessionToken).toBeDefined();
    expect(res.botUrl).toContain(res.sessionToken);

    const status = await service.getTelegramSessionStatus(res.sessionToken);
    expect(status.status).toBe('PENDING');
    expect(status.phone).toBe('+998901234567');
  });

  it('should return EXPIRED for non-existent session token', async () => {
    const status = await service.getTelegramSessionStatus('non-existent-token');
    expect(status.status).toBe('EXPIRED');
  });

  it('should process Telegram start and update status to SENT', async () => {
    const res = await service.createTelegramSession('+998901234567', OtpPurpose.SIGN_UP);

    // Mock TelegramBot sendMessage
    const TelegramBot = require('../../infrastructure/TelegramBot').TelegramBot;
    jest.spyOn(TelegramBot, 'sendMessage').mockResolvedValue({ ok: true });

    const processRes = await service.processTelegramStart(res.sessionToken, 123456789);
    expect(processRes.success).toBe(true);

    const statusAfter = await service.getTelegramSessionStatus(res.sessionToken);
    expect(statusAfter.status).toBe('SENT');
  });

  it('should auto-send OTP for latest pending session on tokensiz start', async () => {
    const res = await service.createTelegramSession('+998901234567', OtpPurpose.SIGN_UP);

    const TelegramBot = require('../../infrastructure/TelegramBot').TelegramBot;
    jest.spyOn(TelegramBot, 'sendMessage').mockResolvedValue({ ok: true });

    const autoRes = await service.processTelegramLatestPending(123456789);
    expect(autoRes.success).toBe(true);

    const statusAfter = await service.getTelegramSessionStatus(res.sessionToken);
    expect(statusAfter.status).toBe('SENT');
  });

  it('should process contact and send OTP', async () => {
    const res = await service.createTelegramSession('+998901234567', OtpPurpose.SIGN_UP);

    const TelegramBot = require('../../infrastructure/TelegramBot').TelegramBot;
    jest.spyOn(TelegramBot, 'sendMessage').mockResolvedValue({ ok: true });

    const contactRes = await service.processTelegramContact('+998901234567', 123456789);
    expect(contactRes.success).toBe(true);
  });
});
