import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifySignupOtpDto {
  @ApiProperty({
    example: '+998901234567',
    description: 'OTP yuborilgan telefon raqami',
  })
  @IsString()
  phone!: string;

  @ApiProperty({
    example: '123456',
    description: 'Telefonga yuborilgan 6 xonali OTP kod',
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}