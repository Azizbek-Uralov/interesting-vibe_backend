import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Faol kategoriyalarni olish' })
  @ApiQuery({
    name: 'language',
    required: false,
    enum: ['UZ', 'EN', 'RU'],
  })
  findAll(@Query('language') language?: string) {
    return this.categoriesService.findAll(language);
  }

  @Get(':id')
  @ApiOperation({ summary: 'ID bo‘yicha kategoriyani olish' })
  @ApiParam({ name: 'id', format: 'uuid' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('language') language?: string,
  ) {
    return this.categoriesService.findOne(id, language);
  }
}
