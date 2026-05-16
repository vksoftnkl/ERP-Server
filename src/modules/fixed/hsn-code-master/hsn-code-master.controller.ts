import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { GetHsnCodeMasterQueryDto } from './dto/get-hsn-code-master-query.dto';
import {
  HsnCodeMasterErrorResponseDto,
  HsnCodeMasterSuccessGetDto,
} from './dto/hsn-code-master-response.dto';
import { HsnCodeMasterService } from './hsn-code-master.service';
import {
  HsnCodeMasterGetMeta,
  HsnCodeMasterPayload,
  HsnCodeMasterSuccessResponse,
} from './types/hsn-code-master-api.types';

@ApiTags('HSN Code Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(86400)
@Controller('hsn-code-masters')
export class HsnCodeMasterController {
  constructor(private readonly hsnCodeMasterService: HsnCodeMasterService) {}

  @Get('get')
  @Version('1')
  @ApiOperation({
    summary:
      'Get HSN code records from fixed.hsn_master by hsnId/hsnCode or filters. Defaults to active records only.',
  })
  @ApiOkResponse({ type: HsnCodeMasterSuccessGetDto })
  @ApiBadRequestResponse({ type: HsnCodeMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: HsnCodeMasterErrorResponseDto })
  async get(
    @Query() queryDto: GetHsnCodeMasterQueryDto,
  ): Promise<HsnCodeMasterSuccessResponse<HsnCodeMasterPayload[], HsnCodeMasterGetMeta>> {
    const result = await this.hsnCodeMasterService.get(queryDto);

    return {
      success: true,
      message:
        queryDto.hsnId !== undefined || Boolean(queryDto.hsnCode)
          ? 'HSN code fetched successfully'
          : 'HSN codes fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
}
