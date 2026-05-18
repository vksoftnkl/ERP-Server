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
import { CompanyMasterExceptionFilter } from './company-master-exception.filter';
import {
  CompanyMasterErrorResponseDto,
  CompanyMasterSuccessDeleteDto,
  CompanyMasterSuccessListDto,
  CompanyMasterSuccessSingleDto,
} from './dto/company-master-response.dto';
import { ListCompanyMasterQueryDto } from './dto/list-company-master-query.dto';
import { SaveCompanyMasterDto } from './dto/save-company-master.dto';
import { CompanyMasterService } from './company-master.service';
import {
  CompanyMasterListItem,
  CompanyMasterListMeta,
  CompanyMasterPayload,
  CompanyMasterSuccessResponse,
} from './types/company-master-api.types';

@ApiTags('Company Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('company-masters')
@UseFilters(CompanyMasterExceptionFilter)
export class CompanyMasterController {
  constructor(private readonly companyMasterService: CompanyMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update company (by compId presence)' })
  @ApiCreatedResponse({ type: CompanyMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: CompanyMasterErrorResponseDto })
  @ApiConflictResponse({ type: CompanyMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: CompanyMasterErrorResponseDto })
  async save(
    @Body() saveCompanyMasterDto: SaveCompanyMasterDto,
  ): Promise<CompanyMasterSuccessResponse<CompanyMasterPayload>> {
    const data = await this.companyMasterService.save(saveCompanyMasterDto);

    return {
      success: true,
      message: saveCompanyMasterDto.compId
        ? 'Company updated successfully'
        : 'Company created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List companies with filter/search/pagination' })
  @ApiOkResponse({ type: CompanyMasterSuccessListDto })
  @ApiBadRequestResponse({ type: CompanyMasterErrorResponseDto })
  async list(
    @Query() queryDto: ListCompanyMasterQueryDto,
  ): Promise<CompanyMasterSuccessResponse<CompanyMasterListItem[], CompanyMasterListMeta>> {
    const result = await this.companyMasterService.list(queryDto);

    return {
      success: true,
      message: 'Companies fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get company by id' })
  @ApiQuery({ name: 'compId', type: String, example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c' })
  @ApiOkResponse({ type: CompanyMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: CompanyMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: CompanyMasterErrorResponseDto })
  async getById(
    @Query('compId', ParseUUIDPipe) compId: string,
  ): Promise<CompanyMasterSuccessResponse<CompanyMasterPayload>> {
    const data = await this.companyMasterService.getById(compId);

    return {
      success: true,
      message: 'Company fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete company by id' })
  @ApiQuery({ name: 'compId', type: String, example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c' })
  @ApiOkResponse({ type: CompanyMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: CompanyMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: CompanyMasterErrorResponseDto })
  async remove(
    @Query('compId', ParseUUIDPipe) compId: string,
  ): Promise<CompanyMasterSuccessResponse<{ compId: string; deleted: true }>> {
    const data = await this.companyMasterService.softDelete(compId);

    return {
      success: true,
      message: 'Company deleted successfully',
      data,
    };
  }
}
