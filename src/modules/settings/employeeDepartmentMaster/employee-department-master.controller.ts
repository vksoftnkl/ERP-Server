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
  EmployeeDepartmentMasterErrorResponseDto,
  EmployeeDepartmentMasterSuccessDeleteDto,
  EmployeeDepartmentMasterSuccessSingleDto,
} from './dto/employee-department-master-response.dto';
import { SaveEmployeeDepartmentMasterDto } from './dto/save-employee-department-master.dto';
import { EmployeeDepartmentMasterExceptionFilter } from './employee-department-master-exception.filter';
import { EmployeeDepartmentMasterService } from './employee-department-master.service';
import {
  EmployeeDepartmentMasterPayload,
  EmployeeDepartmentMasterSuccessResponse,
} from './types/employee-department-master-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Employee Department Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('employee-department-masters')
@UseFilters(EmployeeDepartmentMasterExceptionFilter)
export class EmployeeDepartmentMasterController {
  constructor(private readonly employeeDepartmentMasterService: EmployeeDepartmentMasterService) { }
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update employee department (by edptId presence)' })
  @ApiCreatedResponse({ type: EmployeeDepartmentMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: EmployeeDepartmentMasterErrorResponseDto })
  @ApiConflictResponse({ type: EmployeeDepartmentMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: EmployeeDepartmentMasterErrorResponseDto })
  async save(
    @Body() saveEmployeeDepartmentMasterDto: SaveEmployeeDepartmentMasterDto,
  ): Promise<EmployeeDepartmentMasterSuccessResponse<EmployeeDepartmentMasterPayload>> {
    const data = await this.employeeDepartmentMasterService.save(saveEmployeeDepartmentMasterDto);
    return {
      success: true,
      message: saveEmployeeDepartmentMasterDto.edptId
        ? 'Employee department updated successfully'
        : 'Employee department created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get employee department by id' })
  @ApiQuery({ name: 'edptId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: EmployeeDepartmentMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: EmployeeDepartmentMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: EmployeeDepartmentMasterErrorResponseDto })
  async getById(
    @Query('edptId', new ParseUUIDPipe({ version: '7' })) edptId: string,
  ): Promise<EmployeeDepartmentMasterSuccessResponse<EmployeeDepartmentMasterPayload>> {
    const data = await this.employeeDepartmentMasterService.getById(edptId);
    return {
      success: true,
      message: 'Employee department fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete employee department by id' })
  @ApiQuery({ name: 'edptId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: EmployeeDepartmentMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: EmployeeDepartmentMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: EmployeeDepartmentMasterErrorResponseDto })
  async remove(
    @Query('edptId', new ParseUUIDPipe({ version: '7' })) edptId: string,
  ): Promise<EmployeeDepartmentMasterSuccessResponse<{ edptId: string; deleted: true }>> {
    const data = await this.employeeDepartmentMasterService.softDelete(edptId);
    return {
      success: true,
      message: 'Employee department deleted successfully',
      data,
    };
  }
}
