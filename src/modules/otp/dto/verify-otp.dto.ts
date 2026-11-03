import { IsNotEmpty, IsString, Length } from 'class-validator';
import { SendOtpDto } from './send-otp.dto';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOTPDto extends SendOtpDto {
  @ApiProperty({ minLength: 6, maxLength: 6, example: '123456' })
  @Length(6)
  @IsString()
  @IsNotEmpty()
  code!: string;
}
