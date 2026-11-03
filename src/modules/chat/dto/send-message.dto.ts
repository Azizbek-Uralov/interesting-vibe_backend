import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'Xabar matni',
    example: 'Salom, yangi post loyihangiz juda ajoyib chiqibdi!',
    maxLength: 3000,
  })
  @IsNotEmpty({ message: 'Xabar matni bo‘sh bo‘lishi mumkin emas.' })
  @IsString({ message: 'Xabar matn formatida bo‘lishi kerak.' })
  @MaxLength(3000, { message: 'Xabar uzunligi 3000 belgidan oshmasligi kerak.' })
  content!: string;
}

