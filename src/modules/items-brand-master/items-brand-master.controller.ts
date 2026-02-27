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
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { ListItemBrandQueryDto } from './dto/list-item-brand-query.dto';
import {
  ItemBrandErrorResponseDto,
  ItemBrandSuccessDeleteDto,
  ItemBrandSuccessListDto,
  ItemBrandSuccessSingleDto,
} from './dto/item-brand-response.dto';
import { SaveItemBrandDto } from './dto/save-item-brand.dto';
import { ItemBrandExceptionFilter } from './item-brand-exception.filter';
import { ItemsBrandMasterService } from './items-brand-master.service';
import {
  ItemBrandListItem,
  ItemBrandListMeta,
  ItemBrandPayload,
  ItemBrandSuccessResponse,
} from './types/item-brand-api.types';
type UploadedPhotoFile = {
  buffer: Buffer;
};
@ApiTags('Item Brands')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('item-brands')
@UseFilters(ItemBrandExceptionFilter)
export class ItemsBrandMasterController {
  constructor(private readonly itemsBrandMasterService: ItemsBrandMasterService) {}
  @Post('create')
  @Version('1')
  @UseInterceptors(FileInterceptor('brand_photo'))
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({ type: SaveItemBrandDto })
  @ApiOperation({ summary: 'Create or update item brand (by brand_id presence)' })
  @ApiCreatedResponse({ type: ItemBrandSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemBrandErrorResponseDto })
  @ApiConflictResponse({ type: ItemBrandErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemBrandErrorResponseDto })
  async save(
    @Body() saveItemBrandDto: SaveItemBrandDto,
    @UploadedFile() brandPhotoFile?: UploadedPhotoFile,
  ): Promise<ItemBrandSuccessResponse<ItemBrandPayload>> {
    const payload = this.withUploadedPhoto(saveItemBrandDto, brandPhotoFile);
    const data = await this.itemsBrandMasterService.save(payload);
    return {
      success: true,
      message: payload.brand_id
        ? 'Item brand updated successfully'
        : 'Item brand created successfully',
      data,
    };
  }
  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List item brands with filter/search/pagination' })
  @ApiOkResponse({ type: ItemBrandSuccessListDto })
  @ApiBadRequestResponse({ type: ItemBrandErrorResponseDto })
  async list(
    @Query() queryDto: ListItemBrandQueryDto,
  ): Promise<ItemBrandSuccessResponse<ItemBrandListItem[], ItemBrandListMeta>> {
    const result = await this.itemsBrandMasterService.list(queryDto);
    return {
      success: true,
      message: 'Item brands fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get item brand by id' })
  @ApiQuery({ name: 'brand_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemBrandSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemBrandErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemBrandErrorResponseDto })
  async getById(
    @Query('brand_id', new ParseUUIDPipe({ version: '7' })) brandId: string,
  ): Promise<ItemBrandSuccessResponse<ItemBrandPayload>> {
    const data = await this.itemsBrandMasterService.getById(brandId);
    return {
      success: true,
      message: 'Item brand fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete item brand by id' })
  @ApiQuery({ name: 'brand_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemBrandSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemBrandErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemBrandErrorResponseDto })
  async remove(
    @Query('brand_id', new ParseUUIDPipe({ version: '7' })) brandId: string,
  ): Promise<ItemBrandSuccessResponse<{ brand_id: string; deleted: true }>> {
    const data = await this.itemsBrandMasterService.softDelete(brandId);
    return {
      success: true,
      message: 'Item brand deleted successfully',
      data,
    };
  }
  private withUploadedPhoto(
    saveItemBrandDto: SaveItemBrandDto,
    brandPhotoFile?: UploadedPhotoFile,
  ): SaveItemBrandDto {
    if (!brandPhotoFile) {
      return saveItemBrandDto;
    }
    return {
      ...saveItemBrandDto,
      brand_photo: brandPhotoFile.buffer.toString('base64'),
    };
  }
}
