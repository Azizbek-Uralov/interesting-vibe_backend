import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '..';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    this.client = new Redis(env.REDIS, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    this.client.on('error', (error) => {
      console.error(`Redis error: ${error}`);
    });
  }

  async onModuleInit() {
    await this.client.connect();

    const result = await this.client.ping();
    console.log(`Redis connected: ${result}`);
  }

  async onModuleDestroy() {
    if (this.client.status === 'ready') {
      await this.client.quit();
      return;
    }

    await this.client.disconnect();
  }

  // Redis'ga ma'lumot saqlash
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.client.set(key, value, 'EX', ttlSeconds);
      return;
    }

    await this.client.set(key, value);
  }

  // Redis'dan ma'lumot olish
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  // Redis'dan ma'lumot o'chirish
  async del(key: string): Promise<number> {
    return this.client.del(key);
  }
}
