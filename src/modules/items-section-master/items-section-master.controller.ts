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
import { ListItemSectionQueryDto } from './dto/list-item-section-query.dto';
import {
  ItemSectionErrorResponseDto,
  ItemSectionSuccessDeleteDto,
  ItemSectionSuccessListDto,
  ItemSectionSuccessSingleDto,
} from './dto/item-section-response.dto';
import { SaveItemSectionDto } from './dto/save-item-section.dto';
import { ItemSectionExceptionFilter } from './item-section-exception.filter';
import { ItemsSectionMasterService } from './items-section-master.service';
import {
  ItemSectionListItem,
  ItemSectionListMeta,
  ItemSectionPayload,
  ItemSectionSuccessResponse,
} from './types/item-section-api.types';

type UploadedPhotoFile = {
  buffer: Buffer;
};

@ApiTags('Item Sections')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('item-sections')
@UseFilters(ItemSectionExceptionFilter)
export class ItemsSectionMasterController {
  constructor(private readonly itemsSectionMasterService: ItemsSectionMasterService) {}

  @Post('create')
  @Version('1')
  @UseInterceptors(FileInterceptor('sec_photo'))
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({ type: SaveItemSectionDto })
  @ApiOperation({ summary: 'Create or update item section (by sec_id presence)' })
  @ApiCreatedResponse({ type: ItemSectionSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemSectionErrorResponseDto })
  @ApiConflictResponse({ type: ItemSectionErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemSectionErrorResponseDto })
  async save(
    @Body() saveItemSectionDto: SaveItemSectionDto,
    @UploadedFile() secPhotoFile?: UploadedPhotoFile,
  ): Promise<ItemSectionSuccessResponse<ItemSectionPayload>> {
    const payload = this.withUploadedPhoto(saveItemSectionDto, secPhotoFile);
    const data = await this.itemsSectionMasterService.save(payload);

    return {
      success: true,
      message: payload.sec_id
        ? 'Item section updated successfully'
        : 'Item section created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List item sections with filter/search/pagination' })
  @ApiOkResponse({ type: ItemSectionSuccessListDto })
  @ApiBadRequestResponse({ type: ItemSectionErrorResponseDto })
  async list(
    @Query() queryDto: ListItemSectionQueryDto,
  ): Promise<ItemSectionSuccessResponse<ItemSectionListItem[], ItemSectionListMeta>> {
    const result = await this.itemsSectionMasterService.list(queryDto);

    return {
      success: true,
      message: 'Item sections fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get item section by id' })
  @ApiQuery({ name: 'sec_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemSectionSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemSectionErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemSectionErrorResponseDto })
  async getById(
    @Query('sec_id', new ParseUUIDPipe({ version: '7' })) secId: string,
  ): Promise<ItemSectionSuccessResponse<ItemSectionPayload>> {
    const data = await this.itemsSectionMasterService.getById(secId);

    return {
      success: true,
      message: 'Item section fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete item section by id' })
  @ApiQuery({ name: 'sec_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemSectionSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemSectionErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemSectionErrorResponseDto })
  async remove(
    @Query('sec_id', new ParseUUIDPipe({ version: '7' })) secId: string,
  ): Promise<ItemSectionSuccessResponse<{ sec_id: string; deleted: true }>> {
    const data = await this.itemsSectionMasterService.softDelete(secId);

    return {
      success: true,
      message: 'Item section deleted successfully',
      data,
    };
  }

  private withUploadedPhoto(
    saveItemSectionDto: SaveItemSectionDto,
    secPhotoFile?: UploadedPhotoFile,
  ): SaveItemSectionDto {
    if (!secPhotoFile) {
      return saveItemSectionDto;
    }

    return {
      ...saveItemSectionDto,
      sec_photo: secPhotoFile.buffer,
    };
  }
}
