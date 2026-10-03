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
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { TenderDetailExceptionFilter } from './tender-detail-exception.filter';
import {
  TenderDetailErrorResponseDto,
  TenderDetailSuccessDeleteDto,
  TenderDetailSuccessManyDto,
  TenderDetailSuccessSingleDto,
} from './dto/tender-detail-response.dto';
import { GetTenderDetailQueryDto } from './dto/get-tender-detail-query.dto';
import { SaveTenderDetailDto } from './dto/save-tender-detail.dto';
import { TenderDetailService } from './tender-detail.service';
import {
  TenderDetailDeleteResult,
  TenderDetailPayload,
  TenderDetailSuccessResponse,
} from './types/tender-detail-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Tender Detail')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('tender-details')
@UseFilters(TenderDetailExceptionFilter)
export class TenderDetailController {
  constructor(private readonly tenderDetailService: TenderDetailService) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update one tender line (by tdId presence)',
    description:
      'A create needs tdSrcModule, tdSrcDocType, tdSrcDocId, tdCompanyId, tdBranchId, tdAccYear, ' +
      'tdDocDate, tdPartyLedgerId, tdUserId, tdDrCr and tdTenderId. An update needs tdId plus the ' +
      'fields that change; the document triple is immutable. tdTenderTypeId / tdTenderLedgerId ' +
      'default to the tender master, and tdTotalAmt is derived from tdAmount + tdSurchargeAmt.',
  })
  @ApiCreatedResponse({ type: TenderDetailSuccessSingleDto })
  @ApiBadRequestResponse({ type: TenderDetailErrorResponseDto })
  @ApiConflictResponse({ type: TenderDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: TenderDetailErrorResponseDto })
  async save(
    @Body() saveTenderDetailDto: SaveTenderDetailDto,
  ): Promise<TenderDetailSuccessResponse<TenderDetailPayload>> {
    const data = await this.tenderDetailService.save(saveTenderDetailDto);
    return {
      success: true,
      message: saveTenderDetailDto.tdId
        ? 'Tender line updated successfully'
        : 'Tender line created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "Get one tender line by id, or a document's tender lines",
    description:
      'Send either `tdId` (returns a single tender line) or all of `tdSrcModule`, `tdSrcDocType` ' +
      'and `tdSrcDocId` (returns an array ordered by tdRowNo). Soft-deleted lines are never returned.',
  })
  @ApiExtraModels(TenderDetailSuccessSingleDto, TenderDetailSuccessManyDto)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(TenderDetailSuccessSingleDto) },
        { $ref: getSchemaPath(TenderDetailSuccessManyDto) },
      ],
    },
  })
  @ApiBadRequestResponse({ type: TenderDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: TenderDetailErrorResponseDto })
  async get(
    @Query() getTenderDetailQueryDto: GetTenderDetailQueryDto,
  ): Promise<TenderDetailSuccessResponse<TenderDetailPayload | TenderDetailPayload[]>> {
    const data = await this.tenderDetailService.get(getTenderDetailQueryDto);
    return {
      success: true,
      message: Array.isArray(data)
        ? 'Tender lines fetched successfully'
        : 'Tender line fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete one tender line by id' })
  @ApiQuery({ name: 'tdId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: TenderDetailSuccessDeleteDto })
  @ApiBadRequestResponse({ type: TenderDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: TenderDetailErrorResponseDto })
  async remove(
    @Query('tdId', new ParseUUIDPipe()) tdId: string,
  ): Promise<TenderDetailSuccessResponse<TenderDetailDeleteResult>> {
    const data = await this.tenderDetailService.softDelete(tdId);
    return {
      success: true,
      message: 'Tender line deleted successfully',
      data,
    };
  }
}
