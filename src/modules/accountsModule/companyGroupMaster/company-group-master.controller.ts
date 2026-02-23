import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { CompanyGroupMasterExceptionFilter } from './company-group-master-exception.filter';
import {
  CompanyGroupMasterErrorResponseDto,
  CompanyGroupMasterSuccessDeleteDto,
  CompanyGroupMasterSuccessListDto,
  CompanyGroupMasterSuccessSingleDto,
} from './dto/company-group-master-response.dto';
import { ListCompanyGroupMasterQueryDto } from './dto/list-company-group-master-query.dto';
import { SaveCompanyGroupMasterDto } from './dto/save-company-group-master.dto';
import { CompanyGroupMasterService } from './company-group-master.service';
import {
  CompanyGroupMasterListItem,
  CompanyGroupMasterListMeta,
  CompanyGroupMasterPayload,
  CompanyGroupMasterSuccessResponse,
} from './types/company-group-master-api.types';

@ApiTags('Company Group Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('company-group-masters')
@UseFilters(CompanyGroupMasterExceptionFilter)
export class CompanyGroupMasterController {
  constructor(private readonly companyGroupMasterService: CompanyGroupMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update company group (by cogGroupId presence)' })
  @ApiCreatedResponse({ type: CompanyGroupMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: CompanyGroupMasterErrorResponseDto })
  @ApiConflictResponse({ type: CompanyGroupMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: CompanyGroupMasterErrorResponseDto })
  async save(
    @Body() saveCompanyGroupMasterDto: SaveCompanyGroupMasterDto,
  ): Promise<CompanyGroupMasterSuccessResponse<CompanyGroupMasterPayload>> {
    const data = await this.companyGroupMasterService.save(saveCompanyGroupMasterDto);

    return {
      success: true,
      message: saveCompanyGroupMasterDto.cogGroupId
        ? 'Company group updated successfully'
        : 'Company group created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List company groups with filter/search/pagination' })
  @ApiOkResponse({ type: CompanyGroupMasterSuccessListDto })
  @ApiBadRequestResponse({ type: CompanyGroupMasterErrorResponseDto })
  async list(
    @Query() queryDto: ListCompanyGroupMasterQueryDto,
  ): Promise<CompanyGroupMasterSuccessResponse<CompanyGroupMasterListItem[], CompanyGroupMasterListMeta>> {
    const result = await this.companyGroupMasterService.list(queryDto);

    return {
      success: true,
      message: 'Company groups fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get/:cogGroupId')
  @Version('1')
  @ApiOperation({ summary: 'Get company group by id' })
  @ApiParam({ name: 'cogGroupId', format: 'uuid' })
  @ApiOkResponse({ type: CompanyGroupMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: CompanyGroupMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: CompanyGroupMasterErrorResponseDto })
  async getById(
    @Param('cogGroupId', new ParseUUIDPipe({ version: '7' })) cogGroupId: string,
  ): Promise<CompanyGroupMasterSuccessResponse<CompanyGroupMasterPayload>> {
    const data = await this.companyGroupMasterService.getById(cogGroupId);

    return {
      success: true,
      message: 'Company group fetched successfully',
      data,
    };
  }

  @Delete('delete/:cogGroupId')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete company group by id' })
  @ApiParam({ name: 'cogGroupId', format: 'uuid' })
  @ApiOkResponse({ type: CompanyGroupMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: CompanyGroupMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: CompanyGroupMasterErrorResponseDto })
  async remove(
    @Param('cogGroupId', new ParseUUIDPipe({ version: '7' })) cogGroupId: string,
  ): Promise<CompanyGroupMasterSuccessResponse<{ cogGroupId: string; deleted: true }>> {
    const data = await this.companyGroupMasterService.softDelete(cogGroupId);

    return {
      success: true,
      message: 'Company group deleted successfully',
      data,
    };
  }
}
