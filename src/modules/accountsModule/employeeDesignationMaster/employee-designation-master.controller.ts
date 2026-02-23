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
import { EmployeeDesignationMasterExceptionFilter } from './employee-designation-master-exception.filter';
import {
  EmployeeDesignationMasterErrorResponseDto,
  EmployeeDesignationMasterSuccessDeleteDto,
  EmployeeDesignationMasterSuccessListDto,
  EmployeeDesignationMasterSuccessSingleDto,
} from './dto/employee-designation-master-response.dto';
import { ListEmployeeDesignationMasterQueryDto } from './dto/list-employee-designation-master-query.dto';
import { SaveEmployeeDesignationMasterDto } from './dto/save-employee-designation-master.dto';
import { EmployeeDesignationMasterService } from './employee-designation-master.service';
import {
  EmployeeDesignationMasterListItem,
  EmployeeDesignationMasterListMeta,
  EmployeeDesignationMasterPayload,
  EmployeeDesignationMasterSuccessResponse,
} from './types/employee-designation-master-api.types';

@ApiTags('Employee Designation Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('employee-designation-masters')
@UseFilters(EmployeeDesignationMasterExceptionFilter)
export class EmployeeDesignationMasterController {
  constructor(
    private readonly employeeDesignationMasterService: EmployeeDesignationMasterService,
  ) {}

  @Post('create')
  @Version('1')
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

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List employee designations with filter/search/pagination' })
  @ApiOkResponse({ type: EmployeeDesignationMasterSuccessListDto })
  @ApiBadRequestResponse({ type: EmployeeDesignationMasterErrorResponseDto })
  async list(
    @Query() queryDto: ListEmployeeDesignationMasterQueryDto,
  ): Promise<
    EmployeeDesignationMasterSuccessResponse<
      EmployeeDesignationMasterListItem[],
      EmployeeDesignationMasterListMeta
    >
  > {
    const result = await this.employeeDesignationMasterService.list(queryDto);

    return {
      success: true,
      message: 'Employee designations fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get/:edId')
  @Version('1')
  @ApiOperation({ summary: 'Get employee designation by id' })
  @ApiParam({ name: 'edId', format: 'uuid' })
  @ApiOkResponse({ type: EmployeeDesignationMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: EmployeeDesignationMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: EmployeeDesignationMasterErrorResponseDto })
  async getById(
    @Param('edId', new ParseUUIDPipe({ version: '7' })) edId: string,
  ): Promise<EmployeeDesignationMasterSuccessResponse<EmployeeDesignationMasterPayload>> {
    const data = await this.employeeDesignationMasterService.getById(edId);

    return {
      success: true,
      message: 'Employee designation fetched successfully',
      data,
    };
  }

  @Delete('delete/:edId')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete employee designation by id' })
  @ApiParam({ name: 'edId', format: 'uuid' })
  @ApiOkResponse({ type: EmployeeDesignationMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: EmployeeDesignationMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: EmployeeDesignationMasterErrorResponseDto })
  async remove(
    @Param('edId', new ParseUUIDPipe({ version: '7' })) edId: string,
  ): Promise<EmployeeDesignationMasterSuccessResponse<{ edId: string; deleted: true }>> {
    const data = await this.employeeDesignationMasterService.softDelete(edId);

    return {
      success: true,
      message: 'Employee designation deleted successfully',
      data,
    };
  }
}
