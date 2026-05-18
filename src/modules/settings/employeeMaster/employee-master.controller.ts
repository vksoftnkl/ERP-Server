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
import { ListEmployeeMasterQueryDto } from './dto/list-employee-master-query.dto';
import {
  EmployeeMasterErrorResponseDto,
  EmployeeMasterSuccessDeleteDto,
  EmployeeMasterSuccessListDto,
  EmployeeMasterSuccessSingleDto,
} from './dto/employee-master-response.dto';
import { SaveEmployeeMasterDto } from './dto/save-employee-master.dto';
import { EmployeeMasterExceptionFilter } from './employee-master-exception.filter';
import { EmployeeMasterService } from './employee-master.service';
import {
  EmployeeMasterListItem,
  EmployeeMasterListMeta,
  EmployeeMasterPayload,
  EmployeeMasterSuccessResponse,
} from './types/employee-master-api.types';

@ApiTags('Employee Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('employee-masters')
@UseFilters(EmployeeMasterExceptionFilter)
export class EmployeeMasterController {
  constructor(private readonly employeeMasterService: EmployeeMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update employee (by empId presence)' })
  @ApiCreatedResponse({ type: EmployeeMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: EmployeeMasterErrorResponseDto })
  @ApiConflictResponse({ type: EmployeeMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: EmployeeMasterErrorResponseDto })
  async save(
    @Body() saveEmployeeMasterDto: SaveEmployeeMasterDto,
  ): Promise<EmployeeMasterSuccessResponse<EmployeeMasterPayload>> {
    const data = await this.employeeMasterService.save(saveEmployeeMasterDto);

    return {
      success: true,
      message: saveEmployeeMasterDto.empId
        ? 'Employee updated successfully'
        : 'Employee created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List employees with filter/search/pagination' })
  @ApiOkResponse({ type: EmployeeMasterSuccessListDto })
  @ApiBadRequestResponse({ type: EmployeeMasterErrorResponseDto })
  async list(
    @Query() queryDto: ListEmployeeMasterQueryDto,
  ): Promise<EmployeeMasterSuccessResponse<EmployeeMasterListItem[], EmployeeMasterListMeta>> {
    const result = await this.employeeMasterService.list(queryDto);

    return {
      success: true,
      message: 'Employees fetched successfully',
      data: result.items,
      meta: result.meta,
      styles: result.styles ?? [],
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get employee by id' })
  @ApiQuery({ name: 'empId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: EmployeeMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: EmployeeMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: EmployeeMasterErrorResponseDto })
  async getById(
    @Query('empId', new ParseUUIDPipe({ version: '7' })) empId: string,
  ): Promise<EmployeeMasterSuccessResponse<EmployeeMasterPayload>> {
    const [data, styles] = await Promise.all([
      this.employeeMasterService.getById(empId),
      this.employeeMasterService.getStyles(),
    ]);

    return {
      success: true,
      message: 'Employee fetched successfully',
      data,
      styles,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete employee by id' })
  @ApiQuery({ name: 'empId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: EmployeeMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: EmployeeMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: EmployeeMasterErrorResponseDto })
  async remove(
    @Query('empId', new ParseUUIDPipe({ version: '7' })) empId: string,
  ): Promise<EmployeeMasterSuccessResponse<{ empId: string; deleted: true }>> {
    const data = await this.employeeMasterService.softDelete(empId);

    return {
      success: true,
      message: 'Employee deleted successfully',
      data,
    };
  }
}
