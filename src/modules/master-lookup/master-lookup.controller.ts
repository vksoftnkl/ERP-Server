import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Param, ParseIntPipe, Query, Version } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import {
  LOOKUP_MODULE_KEYS,
  MasterLookupDataPayload,
  MasterLookupSuccessResponse,
  NameIdOption,
} from './types/master-lookup-api.types';
import { MasterLookupSuccessDto, NameIdOptionListSuccessDto } from './dto/master-lookup-response.dto';
import { MasterLookupService } from './master-lookup.service';
import { DropdownSqlQueryDto, MasterLookupQueryDto } from './dto/master-lookup-query.dto';
import { API_VERSION } from '../../common/constants/api-version';
@ApiTags('Master Lookup')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
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
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Case-insensitive search text. Best used with module for fast dropdown search.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum items per module (1-100). Defaults to 20 when search is provided.',
  })
  @ApiOkResponse({ type: MasterLookupSuccessDto })
  async getAllAccountsAndMasterNameIds(
    @Query() queryDto: MasterLookupQueryDto,
  ): Promise<MasterLookupSuccessResponse<MasterLookupDataPayload>> {
    const data = await this.masterLookupService.getAllAccountsAndMasterNameIds(
      queryDto.module,
      queryDto.search,
      queryDto.limit,
    );
    const message = queryDto.module
      ? `Name-id data fetched successfully for module ${queryDto.module}`
      : 'Name-id data fetched successfully';
    return { success: true, message, data };
  }
  @Get('branches/by-company/:companyId')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get branches for a specific company' })
  @ApiParam({ name: 'companyId', type: String, description: 'UUID of the company' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Case-insensitive search on branch name' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum records to return (1-100)' })
  @ApiOkResponse({ type: NameIdOptionListSuccessDto })
  async getBranchesByCompany(
    @Param('companyId') companyId: string,
    @Query() query: DropdownSqlQueryDto,
  ): Promise<MasterLookupSuccessResponse<NameIdOption[]>> {
    const data = await this.masterLookupService.getBranchesByCompany(companyId, query.search, query.limit);
    return { success: true, message: `Branches fetched for company ${companyId}`, data };
  }
  @Get('dropdown/:dropdownId')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Run dropdown SQL query by dropdown ID and return results' })
  @ApiParam({ name: 'dropdownId', type: Number, description: 'ID of the dropdown to execute' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Case-insensitive filter applied to results' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum records to return (1-100)' })
  @ApiOkResponse({ type: NameIdOptionListSuccessDto })
  async getDropdownSqlData(
    @Param('dropdownId', ParseIntPipe) dropdownId: number,
    @Query() query: DropdownSqlQueryDto,
  ): Promise<MasterLookupSuccessResponse<NameIdOption[]>> {
    const data = await this.masterLookupService.getDropdownSqlData(dropdownId, query.search, query.limit);
    return { success: true, message: `Dropdown ${dropdownId} data fetched successfully`, data };
  }
}