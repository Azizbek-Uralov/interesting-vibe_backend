import { IsEnum, IsOptional } from 'class-validator';
import { Language } from '../../../../generated/prisma/enums';

export class QueryCategoriesDto {
  @IsOptional()
  @IsEnum(Language)
  language?: Language = Language.UZ;
}
