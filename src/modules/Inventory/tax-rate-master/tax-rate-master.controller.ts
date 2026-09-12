import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Delete, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { SaveTaxRateDto } from './dto/save-tax-rate.dto';
import {
  DeleteTaxRateQueryDto,
  ListTaxRateQueryDto,
  ResolveTaxRateQueryDto,
  TaxRateIdQueryDto,
} from './dto/tax-rate-query.dto';
import {
  TaxRateErrorResponseDto,
  TaxRateSuccessDeleteDto,
  TaxRateSuccessListDto,
  TaxRateSuccessResolveDto,
  TaxRateSuccessSingleDto,
} from './dto/tax-rate-response.dto';
import { TaxRateMasterExceptionFilter } from './tax-rate-master-exception.filter';
import { TaxRateMasterService } from './tax-rate-master.service';
import {
  TaxRateDeleteResult,
  TaxRatePayload,
  TaxRateResolution,
  TaxRateSuccessResponse,
} from './types/tax-rate-api.types';

/**
 * Two tables, one URL.
 *
 * POST /create saves the rate whole: the header plus its ledger overrides
 * nested as `lines`, in one transaction. GET /get returns the same shape back,
 * names resolved and ready to edit. There is deliberately no per-line endpoint
 * — an override is created, changed and removed by posting the array it
 * belongs to.
 */
@ApiTags('Tax Rate Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('tax-rates')
@UseFilters(TaxRateMasterExceptionFilter)
export class TaxRateMasterController {
  constructor(private readonly taxRateMasterService: TaxRateMasterService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a whole GST rate — header and ledger overrides — in one call',
    description:
      'Object payload. Omit tax_id to create, send it to update — on update only the keys ' +
      'present in the body are written.\n\n' +
      'The `lines` array is optional and saves with the header in the same transaction. An ' +
      'array that is present REPLACES the grid: lines carrying trl_id are updated, lines ' +
      'without one are inserted, and lines already on the rate but missing from the array are ' +
      'soft deleted. Omit the key to leave the grid untouched — `"lines": []` means "delete ' +
      'every override", which is not the same thing.\n\n' +
      'A rate with NO lines is the normal case and a complete configuration: it posts wherever ' +
      'accounts.acc_ledger_map says. Lines exist only where a rate genuinely differs.\n\n' +
      'tax_cgst_perc / tax_sgst_perc / tax_igst_perc are GENERATED from tax_rate_perc by the ' +
      'database and are not accepted here.',
  })
  @ApiCreatedResponse({ type: TaxRateSuccessSingleDto })
  @ApiBadRequestResponse({ type: TaxRateErrorResponseDto })
  @ApiConflictResponse({ type: TaxRateErrorResponseDto })
  @ApiNotFoundResponse({ type: TaxRateErrorResponseDto })
  async save(@Body() dto: SaveTaxRateDto): Promise<TaxRateSuccessResponse<TaxRatePayload>> {
    const data = await this.taxRateMasterService.save(dto);
    return {
      success: true,
      message: dto.tax_id ? 'Tax rate updated successfully' : 'Tax rate created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get one GST rate with its ledger overrides',
    description:
      'Returns the same shape POST /create accepts, ready to edit and post back. Deactivated ' +
      'lines are included so the screen can switch them back on; deleted ones are not.',
  })
  @ApiOkResponse({ type: TaxRateSuccessSingleDto })
  @ApiBadRequestResponse({ type: TaxRateErrorResponseDto })
  @ApiNotFoundResponse({ type: TaxRateErrorResponseDto })
  async getById(
    @Query() query: TaxRateIdQueryDto,
  ): Promise<TaxRateSuccessResponse<TaxRatePayload>> {
    const data = await this.taxRateMasterService.getById(query.tax_id);
    return { success: true, message: 'Tax rate fetched successfully', data };
  }

  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'List GST rates, each one whole',
    description:
      'Every filter is optional and narrows independently, so a bare /list is every live rate ' +
      'there is, ordered by tax_sort_order then tax_name.\n\n' +
      'tax_is_deleted = false is NOT a parameter and cannot be turned off. active_only defaults ' +
      'to true and is the one part of that a maintenance screen may relax; it applies to the ' +
      'lines as well as the header, so an inactive override is absent rather than flagged.',
  })
  @ApiOkResponse({ type: TaxRateSuccessListDto })
  @ApiBadRequestResponse({ type: TaxRateErrorResponseDto })
  async list(
    @Query() query: ListTaxRateQueryDto,
  ): Promise<TaxRateSuccessResponse<TaxRatePayload[]>> {
    const data = await this.taxRateMasterService.list(query);
    return { success: true, message: 'Tax rates fetched successfully', data };
  }

  @Get('resolve')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Where this rate actually posts — every role it can influence, resolved',
    description:
      'GET /get returns the overrides the grid carries and says nothing about the rest. This ' +
      'asks the resolver the question posting will ask, for every role the catalogue marks ' +
      'alr_by_rate.\n\n' +
      'Each row comes back with a `source`: OVERRIDE where this rate carries a row of its own, ' +
      'DEFAULT where it inherits accounts.acc_ledger_map, and UNMAPPED where neither answers — ' +
      'the one state that makes a voucher touching that role unpostable.\n\n' +
      'Round-off, discount, write-off and advances are deliberately absent: they have one ' +
      'answer for the whole business and a rate has no opinion about them.',
  })
  @ApiOkResponse({ type: TaxRateSuccessResolveDto })
  @ApiBadRequestResponse({ type: TaxRateErrorResponseDto })
  @ApiNotFoundResponse({ type: TaxRateErrorResponseDto })
  async resolve(
    @Query() query: ResolveTaxRateQueryDto,
  ): Promise<TaxRateSuccessResponse<TaxRateResolution>> {
    const data = await this.taxRateMasterService.resolveLedgers(query);
    return { success: true, message: 'Tax rate ledgers resolved successfully', data };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a GST rate and every one of its ledger overrides',
    description:
      'Soft delete only — a rate that has priced a bill is never removed. Deleting frees the ' +
      'name and code for reuse, which is what the partial unique indexes are for.',
  })
  @ApiOkResponse({ type: TaxRateSuccessDeleteDto })
  @ApiBadRequestResponse({ type: TaxRateErrorResponseDto })
  @ApiNotFoundResponse({ type: TaxRateErrorResponseDto })
  async remove(
    @Query() query: DeleteTaxRateQueryDto,
  ): Promise<TaxRateSuccessResponse<TaxRateDeleteResult>> {
    const data = await this.taxRateMasterService.softDelete(query.tax_id, query.tax_modified_by);
    return { success: true, message: 'Tax rate deleted successfully', data };
  }
}
