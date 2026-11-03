import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { TelegramPollerService } from './telegram-poller.service';

@Module({
  providers: [OtpService, TelegramPollerService],
  exports: [OtpService],
})
export class OtpModule {}
