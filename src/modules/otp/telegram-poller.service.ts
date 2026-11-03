import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { env } from '../../db';
import { TelegramBot } from '../../infrastructure/TelegramBot';
import { OtpService } from './otp.service';

@Injectable()
export class TelegramPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramPollerService.name);
  private isRunning = false;
  private offset = 0;

  constructor(private readonly otpService: OtpService) {}

  async onModuleInit() {
    if (env.OTP_PROVIDER !== 'TELEGRAM') {
      this.logger.log('OTP_PROVIDER Telegram emas, polling o‘chirilgan.');
      return;
    }

    if (!TelegramBot.isConfigured()) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN belgilanmagan. Telegram bot polling boshlanmadi.',
      );
      return;
    }

    this.isRunning = true;
    this.pollLoop().catch((err) => {
      this.logger.error('Telegram polling loop fatal error:', err);
    });
  }

  onModuleDestroy() {
    this.isRunning = false;
  }

  private async pollLoop() {
    this.logger.log('Telegram bot tekshirilmoqda...');
    const me = await TelegramBot.getMe();
    if (me.ok && me.result) {
      this.logger.log(
        `Telegram bot muvaffaqiyatli ulandi: @${me.result.username} (${me.result.first_name})`,
      );
    } else {
      this.logger.warn('Telegram bot tokeni noto‘g‘ri yoki tarmoqqa ulanib bo‘lmadi.');
    }

    this.logger.log('Telegram polling xizmati ishga tushdi.');

    while (this.isRunning) {
      try {
        const updates = await TelegramBot.getUpdates(this.offset, 25);

        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      } catch (error) {
        this.logger.warn(`Telegram polling interval xatosi: ${error}`);
        // Xatolik bo'lsa 4 soniya kutib qayta ulaymiz
        await new Promise((resolve) => setTimeout(resolve, 4000));
      }
    }
  }

  private async handleUpdate(update: any) {
    const message = update.message;
    if (!message || !message.text) return;

    const text = message.text.trim();
    const chatId = message.chat.id;

    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/);
      const sessionToken = parts[1]?.trim();

      if (sessionToken) {
        this.logger.log(`Telegram /start qabul qilindi. Token: ${sessionToken}`);
        const result = await this.otpService.processTelegramStart(sessionToken, chatId);
        if (!result.success) {
          await TelegramBot.sendMessage(
            chatId,
            `⚠️ ${result.message}\n\nIltimos, saytdan qayta kod so‘rang.`,
          );
        }
      } else {
        const name = message.from?.first_name ?? 'Foydalanuvchi';
        const welcome =
          `Assalomu alaykum, *${name}*! 👋\n\n` +
          `Bu *Visual Discovery* platformasining rasmiy tasdiqlash boti.\n\n` +
          `Saytda ro‘yxatdan o‘tish yoki tizimga kirish paytida taqdim etilgan QR kod yoki havola orqali kirsangiz, bu yerda sizga bir martalik tasdiqlash kodi beriladi.`;
        await TelegramBot.sendMessage(chatId, welcome, { parse_mode: 'Markdown' });
      }
    }
  }
}

