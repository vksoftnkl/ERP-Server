import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ItemCategoryErrorResponseDto,
  ItemCategorySuccessDeleteDto,
  ItemCategorySuccessSingleDto,
} from './dto/item-category-response.dto';
import { SaveItemCategoryDto } from './dto/save-item-category.dto';
import { ItemCategoryExceptionFilter } from './item-category-exception.filter';
import { ItemsCategoryMasterService } from './items-category-master.service';
import { ItemCategoryPayload, ItemCategorySuccessResponse } from './types/item-category-api.types';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';

type UploadedPhotoFile = {
  buffer: Buffer;
};

@ApiTags('Item Categories')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('item-categories')
@UseFilters(ItemCategoryExceptionFilter)
export class ItemsCategoryMasterController {
  constructor(private readonly itemsCategoryMasterService: ItemsCategoryMasterService) {}

  @Post('create')
  @Version('1')
  @UseInterceptors(FileInterceptor('category_photo'))
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({ type: SaveItemCategoryDto })
  @ApiOperation({ summary: 'Create or update item category (by category_id presence)' })
  @ApiCreatedResponse({ type: ItemCategorySuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemCategoryErrorResponseDto })
  @ApiConflictResponse({ type: ItemCategoryErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemCategoryErrorResponseDto })
  async save(
    @Body() saveItemCategoryDto: SaveItemCategoryDto,
    @UploadedFile() categoryPhotoFile?: UploadedPhotoFile,
  ): Promise<ItemCategorySuccessResponse<ItemCategoryPayload>> {
    const payload = this.withUploadedPhoto(saveItemCategoryDto, categoryPhotoFile);
    const data = await this.itemsCategoryMasterService.save(payload);

    return {
      success: true,
      message: payload.category_id
        ? 'Item category updated successfully'
        : 'Item category created successfully',
      data,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get item category by id' })
  @ApiQuery({ name: 'category_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemCategorySuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemCategoryErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemCategoryErrorResponseDto })
  async getById(
    @Query('category_id', new ParseUUIDPipe({ version: '7' })) categoryId: string,
  ): Promise<ItemCategorySuccessResponse<ItemCategoryPayload>> {
    const data = await this.itemsCategoryMasterService.getById(categoryId);

    return {
      success: true,
      message: 'Item category fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete item category by id' })
  @ApiQuery({ name: 'category_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemCategorySuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemCategoryErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemCategoryErrorResponseDto })
  async remove(
    @Query('category_id', new ParseUUIDPipe({ version: '7' })) categoryId: string,
  ): Promise<ItemCategorySuccessResponse<{ category_id: string; deleted: true }>> {
    const data = await this.itemsCategoryMasterService.softDelete(categoryId);

    return {
      success: true,
      message: 'Item category deleted successfully',
      data,
    };
  }

  private withUploadedPhoto(
    saveItemCategoryDto: SaveItemCategoryDto,
    categoryPhotoFile?: UploadedPhotoFile,
  ): SaveItemCategoryDto {
    if (!categoryPhotoFile) {
      return saveItemCategoryDto;
    }

    return {
      ...saveItemCategoryDto,
      category_photo: categoryPhotoFile.buffer.toString('base64'),
    };
  }
}
