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
import { EmployeeDesignationMasterExceptionFilter } from './employee-designation-master-exception.filter';
import {
  EmployeeDesignationMasterErrorResponseDto,
  EmployeeDesignationMasterSuccessDeleteDto,
  EmployeeDesignationMasterSuccessSingleDto,
} from './dto/employee-designation-master-response.dto';
import { SaveEmployeeDesignationMasterDto } from './dto/save-employee-designation-master.dto';
import { EmployeeDesignationMasterService } from './employee-designation-master.service';
import {
  EmployeeDesignationMasterPayload,
  EmployeeDesignationMasterSuccessResponse,
} from './types/employee-designation-master-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Employee Designation Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('employee-designation-masters')
@UseFilters(EmployeeDesignationMasterExceptionFilter)
export class EmployeeDesignationMasterController {
  constructor(
    private readonly employeeDesignationMasterService: EmployeeDesignationMasterService,
  ) { }

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update employee designation (by edId presence)' })
  @ApiCreatedResponse({ type: EmployeeDesignationMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: EmployeeDesignationMasterErrorResponseDto })
  @ApiConflictResponse({ type: EmployeeDesignationMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: EmployeeDesignationMasterErrorResponseDto })
  async save(
    @Body() saveEmployeeDesignationMasterDto: SaveEmployeeDesignationMasterDto,
  ): Promise<EmployeeDesignationMasterSuccessResponse<EmployeeDesignationMasterPayload>> {
    const data = await this.employeeDesignationMasterService.save(saveEmployeeDesignationMasterDto);

    return {
      success: true,
      message: saveEmployeeDesignationMasterDto.edId
        ? 'Employee designation updated successfully'
        : 'Employee designation created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get employee designation by id' })
  @ApiQuery({ name: 'edId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: EmployeeDesignationMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: EmployeeDesignationMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: EmployeeDesignationMasterErrorResponseDto })
  async getById(
    @Query('edId', new ParseUUIDPipe({ version: '7' })) edId: string,
  ): Promise<EmployeeDesignationMasterSuccessResponse<EmployeeDesignationMasterPayload>> {
    const data = await this.employeeDesignationMasterService.getById(edId);

    return {
      success: true,
      message: 'Employee designation fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete employee designation by id' })
  @ApiQuery({ name: 'edId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: EmployeeDesignationMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: EmployeeDesignationMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: EmployeeDesignationMasterErrorResponseDto })
  async remove(
    @Query('edId', new ParseUUIDPipe({ version: '7' })) edId: string,
  ): Promise<EmployeeDesignationMasterSuccessResponse<{ edId: string; deleted: true }>> {
    const data = await this.employeeDesignationMasterService.softDelete(edId);

    return {
      success: true,
      message: 'Employee designation deleted successfully',
      data,
    };
  }
}
