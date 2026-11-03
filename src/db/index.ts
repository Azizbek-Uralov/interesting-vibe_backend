import { config } from 'dotenv';
config();

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveNumber(name: string): number {
  const value = Number(required(name));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: positiveNumber('PORT'),
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  DB_URI: required('DATABASE_URL'),
  REDIS: required('REDIS_URL'),
  SUPERADMIN: {
    PHONE: process.env.SUPERADMIN_PHONE,
    PASSWORD: process.env.SUPERADMIN_PASSWORD,
    USERNAME: process.env.SUPERADMIN_USERNAME,
    FULLNAME: process.env.SUPERADMIN_FULLNAME
  },
  OTP_PROVIDER: (process.env.OTP_PROVIDER ?? 'TELEGRAM').toUpperCase(),
  TELEGRAM: {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '',
    BOT_USERNAME: (process.env.TELEGRAM_BOT_USERNAME ?? '').replace(/^@/, ''),
  },
  OTP: {
    TTL: positiveNumber('OTP_TTL'),
    RESEND: positiveNumber('OTP_RESEND'),
    ATTEMPTS: positiveNumber('OTP_ATTEMPTS'),
    SECRET: required('OTP_SECRET'),
  },
  ESKIZ: {
    BASE_URL: process.env.ESKIZ_BASE_URL ?? '',
    EMAIL: process.env.ESKIZ_EMAIL ?? '',
    PASSWORD: process.env.ESKIZ_PASSWORD ?? '',
    FROM: process.env.ESKIZ_FROM ?? '',
  },
  TOKEN: {
    ACCESS_KEY: required('ACCESS_TOKEN_KEY'),
    ACCESS_TIME: required('ACCESS_TOKEN_TIME'),
    REFRESH_KEY: required('REFRESH_TOKEN_KEY'),
    REFRESH_TIME: required('REFRESH_TOKEN_TIME'),
  },
};
