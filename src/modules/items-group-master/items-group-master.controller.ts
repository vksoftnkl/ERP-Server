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
  ApiBody,
  ApiBadRequestResponse,
  ApiConsumes,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { ListItemGroupQueryDto } from './dto/list-item-group-query.dto';
import {
  ItemGroupErrorResponseDto,
  ItemGroupSuccessDeleteDto,
  ItemGroupSuccessListDto,
  ItemGroupSuccessSingleDto,
} from './dto/item-group-response.dto';
import { SaveItemGroupDto } from './dto/save-item-group.dto';
import { ItemGroupExceptionFilter } from './item-group-exception.filter';
import { ItemsGroupMasterService } from './items-group-master.service';
import {
  ItemGroupListMeta,
  ItemGroupListItem,
  ItemGroupPayload,
  ItemGroupSuccessResponse,
} from './types/item-group-api.types';

type UploadedPhotoFile = {
  buffer: Buffer;
};

@ApiTags('Item Groups')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('item-groups')
@UseFilters(ItemGroupExceptionFilter)
export class ItemsGroupMasterController {
  constructor(private readonly itemsGroupMasterService: ItemsGroupMasterService) {}

  @Post('create')
  @Version('1')
  @UseInterceptors(FileInterceptor('itg_photo'))
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({ type: SaveItemGroupDto })
  @ApiOperation({ summary: 'Create or update item group (by itg_id presence)' })
  @ApiCreatedResponse({ type: ItemGroupSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemGroupErrorResponseDto })
  @ApiConflictResponse({ type: ItemGroupErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemGroupErrorResponseDto })
  async save(
    @Body() saveItemGroupDto: SaveItemGroupDto,
    @UploadedFile() itgPhotoFile?: UploadedPhotoFile,
  ): Promise<ItemGroupSuccessResponse<ItemGroupPayload>> {
    const payload = this.withUploadedPhoto(saveItemGroupDto, itgPhotoFile);
    const data = await this.itemsGroupMasterService.save(payload);

    return {
      success: true,
      message: payload.itg_id
        ? 'Item group updated successfully'
        : 'Item group created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List item groups with filter/search/pagination' })
  @ApiOkResponse({ type: ItemGroupSuccessListDto })
  @ApiBadRequestResponse({ type: ItemGroupErrorResponseDto })
  async list(
    @Query() queryDto: ListItemGroupQueryDto,
  ): Promise<ItemGroupSuccessResponse<ItemGroupListItem[], ItemGroupListMeta>> {
    const result = await this.itemsGroupMasterService.list(queryDto);

    return {
      success: true,
      message: 'Item groups fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get item group by id' })
  @ApiQuery({ name: 'itg_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemGroupSuccessSingleDto })
  @ApiBadRequestResponse({ type: ItemGroupErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemGroupErrorResponseDto })
  async getById(
    @Query('itg_id', new ParseUUIDPipe({ version: '7' })) itgId: string,
  ): Promise<ItemGroupSuccessResponse<ItemGroupPayload>> {
    const data = await this.itemsGroupMasterService.getById(itgId);

    return {
      success: true,
      message: 'Item group fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete item group by id' })
  @ApiQuery({ name: 'itg_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ItemGroupSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ItemGroupErrorResponseDto })
  @ApiNotFoundResponse({ type: ItemGroupErrorResponseDto })
  async remove(
    @Query('itg_id', new ParseUUIDPipe({ version: '7' })) itgId: string,
  ): Promise<ItemGroupSuccessResponse<{ itg_id: string; deleted: true }>> {
    const data = await this.itemsGroupMasterService.softDelete(itgId);

    return {
      success: true,
      message: 'Item group deleted successfully',
      data,
    };
  }

  private withUploadedPhoto(
    saveItemGroupDto: SaveItemGroupDto,
    itgPhotoFile?: UploadedPhotoFile,
  ): SaveItemGroupDto {
    if (!itgPhotoFile) {
      return saveItemGroupDto;
    }

    return {
      ...saveItemGroupDto,
      itg_photo: itgPhotoFile.buffer.toString('base64'),
    };
  }
}
