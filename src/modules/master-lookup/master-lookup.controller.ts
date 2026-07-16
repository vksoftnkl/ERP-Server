import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Param, ParseIntPipe, Query, Version } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import {
  BarcodeItemLookup,
  CustomerDetail,
  FiscalYearOption,
  FreightChargeOption,
  ItemPriceLookupPayload,
  LOOKUP_MODULE_KEYS,
  MasterLookupDataPayload,
  MasterLookupSuccessResponse,
  NameIdOption,
} from './types/master-lookup-api.types';
import {
  BarcodeItemLookupSuccessDto,
  CustomerDetailSuccessDto,
  FiscalYearOptionListSuccessDto,
  FreightChargeListSuccessDto,
  ItemPriceLookupPayloadDto,
  ItemPriceLookupSuccessDto,
  MasterLookupSuccessDto,
  NameIdOptionListSuccessDto,
} from './dto/master-lookup-response.dto';
import { MasterLookupService } from './master-lookup.service';
import { MasterLookupQueryDto } from './dto/master-lookup-query.dto';
import { CustomerDetailQueryDto } from './dto/customer-detail-query.dto';
import { FreightChargeQueryDto } from './dto/freight-charge-query.dto';
import { BarcodeLookupQueryDto } from './dto/barcode-lookup-query.dto';
import { ItemPriceLookupQueryDto } from './dto/item-price-lookup-query.dto';
import { API_VERSION } from '../../common/constants/api-version';
@ApiTags('Master Lookup')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiExtraModels(ItemPriceLookupPayloadDto)
@CacheTTL(1)
@Controller('master-lookups')
export class MasterLookupController {
  constructor(private readonly masterLookupService: MasterLookupService) {}
  @Get('name-id/all-accounts-and-masters')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Get id-name lookup data for all accounts/master modules, or one module via query parameter',
  })
  @ApiQuery({ name: 'module', required: false, enum: LOOKUP_MODULE_KEYS })
  @ApiOkResponse({ type: MasterLookupSuccessDto })
  async getAllAccountsAndMasterNameIds(
    @Query() queryDto: MasterLookupQueryDto,
  ): Promise<MasterLookupSuccessResponse<MasterLookupDataPayload>> {
    const data = await this.masterLookupService.getAllAccountsAndMasterNameIds(queryDto.module);
    const message = queryDto.module
      ? `Name-id data fetched successfully for module ${queryDto.module}`
      : 'Name-id data fetched successfully';
    return { success: true, message, data };
  }
  @Get('name-id/all-masters')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get id-name lookup data for all master modules as a flat array',
  })
  @ApiQuery({ name: 'module', required: false, enum: LOOKUP_MODULE_KEYS })
  @ApiOkResponse({ type: NameIdOptionListSuccessDto })
  async getAllMasters(
    @Query() queryDto: MasterLookupQueryDto,
  ): Promise<MasterLookupSuccessResponse<NameIdOption[]>> {
    const data = await this.masterLookupService.getAllMasters(queryDto.module);
    const message = 'Data fetched successfully';
    return { success: true, message, data };
  }
  @Get('branches/by-company/:companyId')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get branches for a specific company' })
  @ApiParam({ name: 'companyId', type: String, description: 'UUID of the company' })
  @ApiOkResponse({ type: NameIdOptionListSuccessDto })
  async getBranchesByCompany(
    @Param('companyId') companyId: string,
  ): Promise<MasterLookupSuccessResponse<NameIdOption[]>> {
    const data = await this.masterLookupService.getBranchesByCompany(companyId);
    return { success: true, message: `Branches fetched for company ${companyId}`, data };
  }
  @Get('fiscal-years/by-company/:companyId')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get fiscal years for a specific company' })
  @ApiParam({ name: 'companyId', type: String, description: 'UUID of the company' })
  @ApiOkResponse({ type: FiscalYearOptionListSuccessDto })
  async getFiscalYearsByCompany(
    @Param('companyId') companyId: string,
  ): Promise<MasterLookupSuccessResponse<FiscalYearOption[]>> {
    const data = await this.masterLookupService.getFiscalYearsByCompany(companyId);
    return { success: true, message: `Fiscal years fetched for company ${companyId}`, data };
  }
  @Get('customer-detail')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Resolve a customer into a single detail row (legacy iflag=7 customer-detail cursor): identity, address, GST, credit-control flags, price level and billed-date summary. salesman_id is cus_default_salesman and salesman_name is joined from employee_master; tcs_company/local_sales are derived against the requested company; regional returns the regional-language name/address.',
  })
  @ApiQuery({ name: 'cus_id', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'company_id', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'branch_id', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({
    name: 'regional',
    required: false,
    description: 'When true, name/address use the regional-language fields, else English.',
    schema: { type: 'boolean' },
  })
  @ApiOkResponse({ type: CustomerDetailSuccessDto })
  async getCustomerDetail(
    @Query() query: CustomerDetailQueryDto,
  ): Promise<MasterLookupSuccessResponse<CustomerDetail>> {
    const data = await this.masterLookupService.getCustomerDetail(query);
    return { success: true, message: 'Customer detail fetched successfully', data };
  }
  @Get('freight-charges/charge')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Get the freight-charge slabs matching a distance (legacy iflag=9): distance BETWEEN fr_from_km AND fr_to_km.',
  })
  @ApiQuery({ name: 'distance', required: true, schema: { type: 'integer', minimum: 0 } })
  @ApiOkResponse({ type: FreightChargeListSuccessDto })
  async getFreightChargesForDistance(
    @Query() query: FreightChargeQueryDto,
  ): Promise<MasterLookupSuccessResponse<FreightChargeOption[]>> {
    const data = await this.masterLookupService.getFreightChargesForDistance(query.distance);
    return {
      success: true,
      message: `Freight charges fetched for distance ${query.distance} km`,
      data,
    };
  }
  @Get('item-by-barcode')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Resolve a scanned barcode into its item and selling unit (legacy iflag=10). Matches item_ean_codes.ean_code case-insensitively; returns allow_sales, item_status, batch_config and weigh_scale flags.',
  })
  @ApiQuery({ name: 'barcode', required: true, schema: { type: 'string', maxLength: 64 } })
  @ApiOkResponse({ type: BarcodeItemLookupSuccessDto })
  async getItemByBarcode(
    @Query() query: BarcodeLookupQueryDto,
  ): Promise<MasterLookupSuccessResponse<BarcodeItemLookup>> {
    const data = await this.masterLookupService.getItemByBarcode(query.barcode);
    return {
      success: true,
      message: `Item fetched successfully for barcode ${query.barcode}`,
      data,
    };
  }
  @Get('item-price')
  @Version(API_VERSION)
  @CacheTTL(60)
  @ApiOperation({
    summary:
      'Resolve an item into a single sale-lookup row: effective price for the requested price level, tax block, stock, reorder and quantity-wise rates. unit_id selects the unit rate, else the unit-slno rule applies (retail item → highest unit, else base unit); customer_id applies a customer rate to price levels 1–4; godown_id overrides the sale godown; enable_loading sums stock across all godowns; regional returns the local-language name; acccyear scopes stock.',
  })
  @ApiQuery({ name: 'item_id', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'company_id', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'branch_id', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({
    name: 'unit_id',
    required: false,
    description:
      'Selects the unit rate. When omitted, the unit-slno rule applies: retail item → highest unit, else base unit (slno 0).',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({
    name: 'customer_id',
    required: false,
    description: 'Applies the customer rate discount to price levels 1–4 only (A/B/C/D).',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({
    name: 'godown_id',
    required: false,
    description: "Sale godown override. Resolves the godown row and scopes stock to this godown instead of the rate's own godown.",
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({ name: 'acccyear', required: false, schema: { type: 'string', maxLength: 9 } })
  @ApiQuery({
    name: 'enable_loading',
    required: false,
    description: 'Loading mode. When true, stock is summed across ALL godowns; when false/absent it is scoped to the resolved godown.',
    schema: { type: 'boolean' },
  })
  @ApiQuery({
    name: 'regional',
    required: false,
    description: 'When true, item_name is the regional name (item_name_ta), else the English name.',
    schema: { type: 'boolean' },
  })
  @ApiQuery({
    name: 'price_level',
    required: false,
    description: '1=A, 2=B, 3=C, 4=D, 5=MRP/max, 6=min, 7=cost (defaults to 1)',
    schema: { type: 'integer', minimum: 1, maximum: 7, default: 1 },
  })
  @ApiOkResponse({ type: ItemPriceLookupSuccessDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async getItemPriceLookup(
    @Query() query: ItemPriceLookupQueryDto,
  ): Promise<MasterLookupSuccessResponse<ItemPriceLookupPayload>> {
    const data = await this.masterLookupService.getItemPriceLookup(query);
    return {
      success: true,
      message: 'Item price lookup fetched successfully',
      data,
    };
  }
  @Get('dropdown/:dropdownId')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Run dropdown SQL query by dropdown ID and return results' })
  @ApiParam({ name: 'dropdownId', type: Number, description: 'ID of the dropdown to execute' })
  @ApiOkResponse({ type: NameIdOptionListSuccessDto })
  async getDropdownSqlData(
    @Param('dropdownId', ParseIntPipe) dropdownId: number,
  ): Promise<MasterLookupSuccessResponse<NameIdOption[]>> {
    const data = await this.masterLookupService.getDropdownSqlData(dropdownId);
    return { success: true, message: `Dropdown ${dropdownId} data fetched successfully`, data };
  }
}