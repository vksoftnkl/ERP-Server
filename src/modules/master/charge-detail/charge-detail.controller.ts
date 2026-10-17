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
import { ChargeDetailExceptionFilter } from './charge-detail-exception.filter';
import {
  ChargeDetailErrorResponseDto,
  ChargeDetailSuccessDeleteDto,
  ChargeDetailSuccessManyDto,
  ChargeDetailSuccessSingleDto,
} from './dto/charge-detail-response.dto';
import { GetChargeDetailQueryDto } from './dto/get-charge-detail-query.dto';
import { SaveChargeDetailDto } from './dto/save-charge-detail.dto';
import { ChargeDetailService } from './charge-detail.service';
import {
  ChargeDetailDeleteResult,
  ChargeDetailPayload,
  ChargeDetailSuccessResponse,
} from './types/charge-detail-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Charge Detail')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('charge-details')
@UseFilters(ChargeDetailExceptionFilter)
export class ChargeDetailController {
  constructor(private readonly chargeDetailService: ChargeDetailService) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update one applied charge line (by cdId presence)',
    description:
      'A create needs cdDocType, cdDocId, cdCompId, cdBranchId, cdAccYear, cdChgId and cdLedgerCode. ' +
      'An update needs cdId plus the fields that change; cdDocType / cdDocId are immutable.',
  })
  @ApiCreatedResponse({ type: ChargeDetailSuccessSingleDto })
  @ApiBadRequestResponse({ type: ChargeDetailErrorResponseDto })
  @ApiConflictResponse({ type: ChargeDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: ChargeDetailErrorResponseDto })
  async save(
    @Body() saveChargeDetailDto: SaveChargeDetailDto,
  ): Promise<ChargeDetailSuccessResponse<ChargeDetailPayload>> {
    const data = await this.chargeDetailService.save(saveChargeDetailDto);
    return {
      success: true,
      message: saveChargeDetailDto.cdId
        ? 'Charge line updated successfully'
        : 'Charge line created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "Get one charge line by id, or a document's charge lines",
    description:
      'Send either `cdId` (returns a single charge line) or both `cdDocType` and `cdDocId` ' +
      '(returns an array, ordered by cdSlno with unnumbered lines last). Soft-deleted lines are ' +
      'never returned; pass `isActive` on a document lookup to filter on cd_is_active.',
  })
  @ApiExtraModels(ChargeDetailSuccessSingleDto, ChargeDetailSuccessManyDto)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ChargeDetailSuccessSingleDto) },
        { $ref: getSchemaPath(ChargeDetailSuccessManyDto) },
      ],
    },
  })
  @ApiBadRequestResponse({ type: ChargeDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: ChargeDetailErrorResponseDto })
  async get(
    @Query() getChargeDetailQueryDto: GetChargeDetailQueryDto,
  ): Promise<ChargeDetailSuccessResponse<ChargeDetailPayload | ChargeDetailPayload[]>> {
    const data = await this.chargeDetailService.get(getChargeDetailQueryDto);
    return {
      success: true,
      message: Array.isArray(data)
        ? 'Charge lines fetched successfully'
        : 'Charge line fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete one charge line by id' })
  @ApiQuery({ name: 'cdId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: ChargeDetailSuccessDeleteDto })
  @ApiBadRequestResponse({ type: ChargeDetailErrorResponseDto })
  @ApiNotFoundResponse({ type: ChargeDetailErrorResponseDto })
  async remove(
    @Query('cdId', new ParseUUIDPipe()) cdId: string,
  ): Promise<ChargeDetailSuccessResponse<ChargeDetailDeleteResult>> {
    const data = await this.chargeDetailService.softDelete(cdId);
    return {
      success: true,
      message: 'Charge line deleted successfully',
      data,
    };
  }
}
