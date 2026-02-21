import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
  Version,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { ListItemEanCodeQueryDto } from './dto/list-item-ean-code-query.dto';
import {
  ItemEanCodeErrorResponseDto,
  ItemEanCodeSuccessDeleteDto,
  ItemEanCodeSuccessListDto,
  ItemEanCodeSuccessSingleDto,
} from './dto/item-ean-code-response.dto';
import { SaveItemEanCodeDto } from './dto/save-item-ean-code.dto';
import { ItemEanCodeExceptionFilter } from './item-ean-code-exception.filter';
import { ItemsEanCodeMasterService } from './items-ean-code-master.service';
import {
  ItemEanCodeListItem,
  ItemEanCodeListMeta,
  ItemEanCodePayload,
  ItemEanCodeSuccessResponse,
} from './types/item-ean-code-api.types';

@ApiTags('Item EAN Codes')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('item-ean-codes')
@UseFilters(ItemEanCodeExceptionFilter)
export class ItemsEanCodeMasterController {
  constructor(private readonly itemsEanCodeMasterService: ItemsEanCodeMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update item EAN code (by ean_id presence)' })
  @ApiCreatedResponse({ type: ItemEanCodeSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemEanCodeErrorResponseDto })
  @ApiConflictResponse({ type: ItemEanCodeErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemEanCodeErrorResponseDto })
  async save(
    @Body() saveItemEanCodeDto: SaveItemEanCodeDto,
  ): Promise<ItemEanCodeSuccessResponse<ItemEanCodePayload>> {
    const data = await this.itemsEanCodeMasterService.save(saveItemEanCodeDto);

    return {
      success: true,
      message: saveItemEanCodeDto.ean_id
        ? 'Item EAN code updated successfully'
        : 'Item EAN code created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List item EAN codes with filter/search/pagination' })
  @ApiOkResponse({ type: ItemEanCodeSuccessListDto })
  @ApiBadRequestResponse({ type: ItemEanCodeErrorResponseDto })
  async list(
    @Query() queryDto: ListItemEanCodeQueryDto,
  ): Promise<ItemEanCodeSuccessResponse<ItemEanCodeListItem[], ItemEanCodeListMeta>> {
    const result = await this.itemsEanCodeMasterService.list(queryDto);

    return {
      success: true,
      message: 'Item EAN codes fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get/:ean_id')
  @Version('1')
  @ApiOperation({ summary: 'Get item EAN code by id' })
  @ApiParam({ name: 'ean_id', format: 'uuid' })
  @ApiOkResponse({ type: ItemEanCodeSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemEanCodeErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemEanCodeErrorResponseDto })
  async getById(
    @Param('ean_id', new ParseUUIDPipe({ version: '7' })) eanId: string,
  ): Promise<ItemEanCodeSuccessResponse<ItemEanCodePayload>> {
    const data = await this.itemsEanCodeMasterService.getById(eanId);

    return {
      success: true,
      message: 'Item EAN code fetched successfully',
      data,
    };
  }

  @Delete('delete/:ean_id')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete item EAN code by id' })
  @ApiParam({ name: 'ean_id', format: 'uuid' })
  @ApiOkResponse({ type: ItemEanCodeSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemEanCodeErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemEanCodeErrorResponseDto })
  async remove(
    @Param('ean_id', new ParseUUIDPipe({ version: '7' })) eanId: string,
  ): Promise<ItemEanCodeSuccessResponse<{ ean_id: string; deleted: true }>> {
    const data = await this.itemsEanCodeMasterService.softDelete(eanId);

    return {
      success: true,
      message: 'Item EAN code deleted successfully',
      data,
    };
  }
}
