import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({
    description: 'Suhbat boshlanayotgan ikkinchi foydalanuvchi IDsi',
    example: '271e991d-a73e-4ba0-b500-5590438f29af',
  })
  @IsNotEmpty({ message: 'participantId kiritilishi shart.' })
  @IsUUID('4', { message: 'participantId to‘g‘ri UUID formatida bo‘lishi kerak.' })
  participantId!: string;
}

