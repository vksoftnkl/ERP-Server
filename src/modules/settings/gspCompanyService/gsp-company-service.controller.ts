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
  GspCompanyServiceErrorResponseDto,
  GspCompanyServiceSuccessDeleteDto,
  GspCompanyServiceSuccessSingleDto,
} from './dto/gsp-company-service-response.dto';
import { SaveGspCompanyServiceDto } from './dto/save-gsp-company-service.dto';
import { GspCompanyServiceExceptionFilter } from './gsp-company-service-exception.filter';
import { GspCompanyServiceService } from './gsp-company-service.service';
import {
  GspCompanyServicePayload,
  GspCompanyServiceSuccessResponse,
} from './types/gsp-company-service-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('GSP Company Service')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('gsp-company-services')
@UseFilters(GspCompanyServiceExceptionFilter)
export class GspCompanyServiceController {
  constructor(private readonly gspCompanyServiceService: GspCompanyServiceService) { }
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update GSP company service (by csgCompanyServiceId presence)',
  })
  @ApiCreatedResponse({ type: GspCompanyServiceSuccessSingleDto })
  @ApiBadRequestResponse({ type: GspCompanyServiceErrorResponseDto })
  @ApiConflictResponse({ type: GspCompanyServiceErrorResponseDto })
  @ApiNotFoundResponse({ type: GspCompanyServiceErrorResponseDto })
  async save(
    @Body() saveGspCompanyServiceDto: SaveGspCompanyServiceDto,
  ): Promise<GspCompanyServiceSuccessResponse<GspCompanyServicePayload>> {
    const data = await this.gspCompanyServiceService.save(saveGspCompanyServiceDto);
    return {
      success: true,
      message: saveGspCompanyServiceDto.csgCompanyServiceId
        ? 'GSP company service updated successfully'
        : 'GSP company service created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get GSP company service by id' })
  @ApiQuery({ name: 'csgCompanyServiceId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: GspCompanyServiceSuccessSingleDto })
  @ApiBadRequestResponse({ type: GspCompanyServiceErrorResponseDto })
  @ApiNotFoundResponse({ type: GspCompanyServiceErrorResponseDto })
  async getById(
    @Query('csgCompanyServiceId', new ParseUUIDPipe({ version: '7' })) csgCompanyServiceId: string,
  ): Promise<GspCompanyServiceSuccessResponse<GspCompanyServicePayload>> {
    const data = await this.gspCompanyServiceService.getById(csgCompanyServiceId);
    return {
      success: true,
      message: 'GSP company service fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete GSP company service by id' })
  @ApiQuery({ name: 'csgCompanyServiceId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: GspCompanyServiceSuccessDeleteDto })
  @ApiBadRequestResponse({ type: GspCompanyServiceErrorResponseDto })
  @ApiNotFoundResponse({ type: GspCompanyServiceErrorResponseDto })
  async remove(
    @Query('csgCompanyServiceId', new ParseUUIDPipe({ version: '7' })) csgCompanyServiceId: string,
  ): Promise<GspCompanyServiceSuccessResponse<{ csgCompanyServiceId: string; deleted: true }>> {
    const data = await this.gspCompanyServiceService.softDelete(csgCompanyServiceId);
    return {
      success: true,
      message: 'GSP company service deleted successfully',
      data,
    };
  }
}
