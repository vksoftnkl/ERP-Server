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
  GspCompanyServiceSuccessListDto,
  GspCompanyServiceSuccessSingleDto,
} from './dto/gsp-company-service-response.dto';
import { ListGspCompanyServiceQueryDto } from './dto/list-gsp-company-service-query.dto';
import { SaveGspCompanyServiceDto } from './dto/save-gsp-company-service.dto';
import { GspCompanyServiceExceptionFilter } from './gsp-company-service-exception.filter';
import { GspCompanyServiceService } from './gsp-company-service.service';
import {
  GspCompanyServiceListItem,
  GspCompanyServiceListMeta,
  GspCompanyServicePayload,
  GspCompanyServiceSuccessResponse,
} from './types/gsp-company-service-api.types';
@ApiTags('GSP Company Service')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('gsp-company-services')
@UseFilters(GspCompanyServiceExceptionFilter)
export class GspCompanyServiceController {
  constructor(private readonly gspCompanyServiceService: GspCompanyServiceService) {}
  @Post('create')
  @Version('1')
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
  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List GSP company services with filter/search/pagination' })
  @ApiOkResponse({ type: GspCompanyServiceSuccessListDto })
  @ApiBadRequestResponse({ type: GspCompanyServiceErrorResponseDto })
  async list(
    @Query() queryDto: ListGspCompanyServiceQueryDto,
  ): Promise<
    GspCompanyServiceSuccessResponse<GspCompanyServiceListItem[], GspCompanyServiceListMeta>
  > {
    const result = await this.gspCompanyServiceService.list(queryDto);
    return {
      success: true,
      message: 'GSP company services fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }
  @Get('get')
  @Version('1')
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
  @Version('1')
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
