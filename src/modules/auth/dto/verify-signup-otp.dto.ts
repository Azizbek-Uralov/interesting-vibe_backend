import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class VerifySignupOtpDto {
  @ApiPropertyOptional({
    example: '+998901234567',
    description: 'OTP yuborilgan telefon raqami',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: '+998901234567',
    description: 'Muqobil telefon parametri',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({
    example: '123456',
    description: 'Telefonga yuborilgan 6 xonali OTP kod',
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
