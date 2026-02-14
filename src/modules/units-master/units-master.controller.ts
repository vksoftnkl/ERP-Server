import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseFilters,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ListUnitQueryDto } from './dto/list-unit-query.dto';
import { SaveUnitDto } from './dto/save-unit.dto';
import {
  UnitErrorResponseDto,
  UnitSuccessDeleteDto,
  UnitSuccessListDto,
  UnitSuccessSingleDto,
} from './dto/unit-response.dto';
import { UnitExceptionFilter } from './unit-exception.filter';
import { UnitListMeta, UnitPayload, UnitSuccessResponse } from './types/unit-api.types';
import { UnitsMasterService } from './units-master.service';

@ApiTags('Units')
@Controller('units')
@UseFilters(UnitExceptionFilter)
export class UnitsMasterController {
  constructor(private readonly unitsMasterService: UnitsMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update unit (by unit_id presence)' })
  @ApiCreatedResponse({ type: UnitSuccessSingleDto })
  @ApiBadRequestResponse({ type: UnitErrorResponseDto })
  @ApiConflictResponse({ type: UnitErrorResponseDto })
  @ApiNotFoundResponse({ type: UnitErrorResponseDto })
  async save(@Body() saveUnitDto: SaveUnitDto): Promise<UnitSuccessResponse<UnitPayload>> {
    const data = await this.unitsMasterService.save(saveUnitDto);

    return {
      success: true,
      message: saveUnitDto.unit_id ? 'Unit updated successfully' : 'Unit created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List units with filter/search/pagination' })
  @ApiOkResponse({ type: UnitSuccessListDto })
  @ApiBadRequestResponse({ type: UnitErrorResponseDto })
  async list(
    @Query() queryDto: ListUnitQueryDto,
  ): Promise<UnitSuccessResponse<UnitPayload[], UnitListMeta>> {
    const result = await this.unitsMasterService.list(queryDto);

    return {
      success: true,
      message: 'Units fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get/:unit_id')
  @Version('1')
  @ApiOperation({ summary: 'Get unit by id' })
  @ApiParam({ name: 'unit_id', type: Number })
  @ApiOkResponse({ type: UnitSuccessSingleDto })
  @ApiBadRequestResponse({ type: UnitErrorResponseDto })
  @ApiNotFoundResponse({ type: UnitErrorResponseDto })
  async getById(
    @Param('unit_id', ParseIntPipe) unitId: number,
  ): Promise<UnitSuccessResponse<UnitPayload>> {
    const data = await this.unitsMasterService.getById(unitId);

    return {
      success: true,
      message: 'Unit fetched successfully',
      data,
    };
  }

  @Delete('delete/:unit_id')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete unit by id' })
  @ApiParam({ name: 'unit_id', type: Number })
  @ApiOkResponse({ type: UnitSuccessDeleteDto })
  @ApiBadRequestResponse({ type: UnitErrorResponseDto })
  @ApiNotFoundResponse({ type: UnitErrorResponseDto })
  async remove(
    @Param('unit_id', ParseIntPipe) unitId: number,
  ): Promise<UnitSuccessResponse<{ unit_id: number; deleted: true }>> {
    const data = await this.unitsMasterService.softDelete(unitId);

    return {
      success: true,
      message: 'Unit deleted successfully',
      data,
    };
  }
}
