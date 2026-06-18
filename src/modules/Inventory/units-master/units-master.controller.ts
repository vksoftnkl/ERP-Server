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
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { SaveUnitDto } from './dto/save-unit.dto';
import {
  UnitErrorResponseDto,
  UnitSuccessDeleteDto,
  UnitSuccessSingleDto,
} from './dto/unit-response.dto';
import { UnitExceptionFilter } from './unit-exception.filter';
import { UnitDetailPayload, UnitPayload, UnitSuccessResponse } from './types/unit-api.types';
import { UnitsMasterService } from './units-master.service';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Units')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('units')
@UseFilters(UnitExceptionFilter)
export class UnitsMasterController {
  constructor(private readonly unitsMasterService: UnitsMasterService) { }

  @Post('create')
  @Version(API_VERSION)
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

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get unit by id' })
  @ApiQuery({ name: 'unit_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: UnitSuccessSingleDto })
  @ApiBadRequestResponse({ type: UnitErrorResponseDto })
  @ApiNotFoundResponse({ type: UnitErrorResponseDto })
  async getById(
    @Query('unit_id', new ParseUUIDPipe({ version: '7' })) unitId: string,
  ): Promise<UnitSuccessResponse<UnitDetailPayload>> {
    const data = await this.unitsMasterService.getById(unitId);

    return {
      success: true,
      message: 'Unit fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete unit by id' })
  @ApiQuery({ name: 'unit_id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: UnitSuccessDeleteDto })
  @ApiBadRequestResponse({ type: UnitErrorResponseDto })
  @ApiNotFoundResponse({ type: UnitErrorResponseDto })
  async remove(
    @Query('unit_id', new ParseUUIDPipe({ version: '7' })) unitId: string,
  ): Promise<UnitSuccessResponse<{ unit_id: string; deleted: true }>> {
    const data = await this.unitsMasterService.softDelete(unitId);

    return {
      success: true,
      message: 'Unit deleted successfully',
      data,
    };
  }
}
