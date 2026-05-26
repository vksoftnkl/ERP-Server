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
import { GspProviderMasterExceptionFilter } from './gsp-provider-master-exception.filter';
import {
  GspProviderMasterErrorResponseDto,
  GspProviderMasterSuccessDeleteDto,
  GspProviderMasterSuccessSingleDto,
} from './dto/gsp-provider-master-response.dto';
import { SaveGspProviderMasterDto } from './dto/save-gsp-provider-master.dto';
import { GspProviderMasterService } from './gsp-provider-master.service';
import {
  GspProviderMasterPayload,
  GspProviderMasterSuccessResponse,
} from './types/gsp-provider-master-api.types';

@ApiTags('GSP Provider Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('gsp-provider-masters')
@UseFilters(GspProviderMasterExceptionFilter)
export class GspProviderMasterController {
  constructor(private readonly gspProviderMasterService: GspProviderMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update GSP provider (by gspProviderId presence)' })
  @ApiCreatedResponse({ type: GspProviderMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: GspProviderMasterErrorResponseDto })
  @ApiConflictResponse({ type: GspProviderMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: GspProviderMasterErrorResponseDto })
  async save(
    @Body() saveGspProviderMasterDto: SaveGspProviderMasterDto,
  ): Promise<GspProviderMasterSuccessResponse<GspProviderMasterPayload>> {
    const data = await this.gspProviderMasterService.save(saveGspProviderMasterDto);

    return {
      success: true,
      message: saveGspProviderMasterDto.gspProviderId
        ? 'GSP provider updated successfully'
        : 'GSP provider created successfully',
      data,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get GSP provider by id' })
  @ApiQuery({ name: 'gspProviderId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: GspProviderMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: GspProviderMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: GspProviderMasterErrorResponseDto })
  async getById(
    @Query('gspProviderId', new ParseUUIDPipe({ version: '7' })) gspProviderId: string,
  ): Promise<GspProviderMasterSuccessResponse<GspProviderMasterPayload>> {
    const data = await this.gspProviderMasterService.getById(gspProviderId);

    return {
      success: true,
      message: 'GSP provider fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete GSP provider by id' })
  @ApiQuery({ name: 'gspProviderId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: GspProviderMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: GspProviderMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: GspProviderMasterErrorResponseDto })
  async remove(
    @Query('gspProviderId', new ParseUUIDPipe({ version: '7' })) gspProviderId: string,
  ): Promise<GspProviderMasterSuccessResponse<{ gspProviderId: string; deleted: true }>> {
    const data = await this.gspProviderMasterService.softDelete(gspProviderId);

    return {
      success: true,
      message: 'GSP provider deleted successfully',
      data,
    };
  }
}
