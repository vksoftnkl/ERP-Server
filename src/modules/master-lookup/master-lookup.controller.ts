import { Controller, Get, Query, Version } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import {
  LOOKUP_MODULE_KEYS,
  MasterLookupDataPayload,
  MasterLookupSuccessResponse,
} from './types/master-lookup-api.types';
import { MasterLookupSuccessDto } from './dto/master-lookup-response.dto';
import { MasterLookupService } from './master-lookup.service';
import { MasterLookupQueryDto } from './dto/master-lookup-query.dto';

@ApiTags('Master Lookup')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('master-lookups')
export class MasterLookupController {
  constructor(private readonly masterLookupService: MasterLookupService) {}

  @Get('name-id/all-accounts-and-masters')
  @Version('1')
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

    return {
      success: true,
      message,
      data,
    };
  }
}
