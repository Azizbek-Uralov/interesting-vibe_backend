import { Logger } from '@nestjs/common';
import { env } from '../db';

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      first_name?: string;
      username?: string;
    };
    date: number;
    text?: string;
  };
}

export class TelegramBot {
  private static readonly logger = new Logger(TelegramBot.name);

  static get token(): string {
    return env.TELEGRAM.BOT_TOKEN;
  }

  static get username(): string {
    return env.TELEGRAM.BOT_USERNAME;
  }

  static isConfigured(): boolean {
    return Boolean(this.token && this.token.length > 5);
  }

  private static get baseUrl(): string {
    return `https://api.telegram.org/bot${this.token}`;
  }

  static async getMe(): Promise<{ ok: boolean; result?: { id: number; username: string; first_name: string } }> {
    if (!this.isConfigured()) {
      return { ok: false };
    }
    try {
      const response = await fetch(`${this.baseUrl}/getMe`);
      return (await response.json()) as any;
    } catch (error) {
      this.logger.error('Telegram getMe failed:', error);
      return { ok: false };
    }
  }

  static async sendMessage(
    chatId: number | string,
    text: string,
    options?: { parse_mode?: 'Markdown' | 'HTML' },
  ): Promise<{ ok: boolean; result?: any; description?: string }> {
    if (!this.isConfigured()) {
      this.logger.warn('Telegram bot is not configured, skipping sendMessage');
      return { ok: false, description: 'Telegram bot not configured' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options?.parse_mode,
        }),
      });

      const data = (await response.json()) as any;
      if (!response.ok || !data.ok) {
        this.logger.error(`Telegram sendMessage failed: ${data.description || response.statusText}`);
      }
      return data;
    } catch (error) {
      this.logger.error('Telegram sendMessage exception:', error);
      return { ok: false, description: String(error) };
    }
  }

  static async getUpdates(offset?: number, timeout = 10): Promise<TelegramUpdate[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const url = new URL(`${this.baseUrl}/getUpdates`);
      if (offset) url.searchParams.append('offset', String(offset));
      if (timeout) url.searchParams.append('timeout', String(timeout));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), (timeout + 5) * 1000);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      const data = (await response.json()) as { ok: boolean; result?: TelegramUpdate[]; description?: string };

      if (!response.ok || !data.ok) {
        this.logger.warn(`Telegram getUpdates failed: ${data.description || response.statusText}`);
        return [];
      }

      return data.result ?? [];
    } catch (error: any) {
      this.logger.warn(`Telegram getUpdates network error: ${error?.message || error} (cause: ${error?.cause})`);
      return [];
    }
  }
}

