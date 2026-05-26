import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import {
  TenderTypeMasterErrorResponseDto,
  TenderTypeMasterSuccessDeleteDto,
  TenderTypeMasterSuccessSingleDto,
} from './dto/tender-type-master-response.dto';
import { SaveTenderTypeMasterDto } from './dto/save-tender-type-master.dto';
import { TenderTypeMasterExceptionFilter } from './tender-type-master-exception.filter';
import { TenderTypeMasterService } from './tender-type-master.service';
import {
  TenderTypeMasterPayload,
  TenderTypeMasterSuccessResponse,
} from './types/tender-type-master-api.types';

@ApiTags('Tender Type Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('tender-type-masters')
@UseFilters(TenderTypeMasterExceptionFilter)
export class TenderTypeMasterController {
  constructor(private readonly tenderTypeMasterService: TenderTypeMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update tender type (by ttmTypeId presence)' })
  @ApiCreatedResponse({ type: TenderTypeMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: TenderTypeMasterErrorResponseDto })
  @ApiConflictResponse({ type: TenderTypeMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: TenderTypeMasterErrorResponseDto })
  async save(
    @Body() saveTenderTypeMasterDto: SaveTenderTypeMasterDto,
  ): Promise<TenderTypeMasterSuccessResponse<TenderTypeMasterPayload>> {
    const data = await this.tenderTypeMasterService.save(saveTenderTypeMasterDto);

    return {
      success: true,
      message: saveTenderTypeMasterDto.ttmTypeId
        ? 'Tender type updated successfully'
        : 'Tender type created successfully',
      data,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get tender type by id' })
  @ApiQuery({ name: 'ttmTypeId', schema: { type: 'string', example: '1' } })
  @ApiOkResponse({ type: TenderTypeMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: TenderTypeMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: TenderTypeMasterErrorResponseDto })
  async getById(
    @Query('ttmTypeId') ttmTypeId: string,
  ): Promise<TenderTypeMasterSuccessResponse<TenderTypeMasterPayload>> {
    const data = await this.tenderTypeMasterService.getById(ttmTypeId);

    return {
      success: true,
      message: 'Tender type fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete tender type by id' })
  @ApiQuery({ name: 'ttmTypeId', schema: { type: 'string', example: '1' } })
  @ApiOkResponse({ type: TenderTypeMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: TenderTypeMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: TenderTypeMasterErrorResponseDto })
  async remove(
    @Query('ttmTypeId') ttmTypeId: string,
  ): Promise<TenderTypeMasterSuccessResponse<{ ttmTypeId: string; deleted: true }>> {
    const data = await this.tenderTypeMasterService.softDelete(ttmTypeId);

    return {
      success: true,
      message: 'Tender type deleted successfully',
      data,
    };
  }
}
