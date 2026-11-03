import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: 'Azizbek Uralov' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: 'azizbek_01' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,30}$/, {
    message:
      'Username 3–30 ta belgidan iborat bo‘lishi va faqat harf, raqam, _ ishlatishi kerak.',
  })
  username!: string;

  @ApiProperty({ example: 'StrongPassword123' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}