import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Delete, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
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
  StateCodeMasterErrorResponseDto,
  StateCodeMasterSuccessDeleteDto,
  StateCodeMasterSuccessListDto,
  StateCodeMasterSuccessSingleDto,
} from './dto/state-code-master-response.dto';
import { ListStateCodeMasterQueryDto } from './dto/list-state-code-master-query.dto';
import { SaveStateCodeMasterDto } from './dto/save-state-code-master.dto';
import { StateCodeMasterExceptionFilter } from './state-code-master-exception.filter';
import { StateCodeMasterService } from './state-code-master.service';
import {
  StateCodeMasterListItem,
  StateCodeMasterListMeta,
  StateCodeMasterPayload,
  StateCodeMasterSuccessResponse,
} from './types/state-code-master-api.types';

@ApiTags('State Code Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(86400)
@Controller('state-code-masters')
@UseFilters(StateCodeMasterExceptionFilter)
export class StateCodeMasterController {
  constructor(private readonly stateCodeMasterService: StateCodeMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update state code' })
  @ApiCreatedResponse({ type: StateCodeMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: StateCodeMasterErrorResponseDto })
  @ApiConflictResponse({ type: StateCodeMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: StateCodeMasterErrorResponseDto })
  async save(
    @Body() saveStateCodeMasterDto: SaveStateCodeMasterDto,
  ): Promise<StateCodeMasterSuccessResponse<StateCodeMasterPayload>> {
    const data = await this.stateCodeMasterService.save(saveStateCodeMasterDto);

    return {
      success: true,
      message: 'State code saved successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List state codes with filter/search/pagination' })
  @ApiOkResponse({ type: StateCodeMasterSuccessListDto })
  @ApiBadRequestResponse({ type: StateCodeMasterErrorResponseDto })
  async list(
    @Query() queryDto: ListStateCodeMasterQueryDto,
  ): Promise<StateCodeMasterSuccessResponse<StateCodeMasterListItem[], StateCodeMasterListMeta>> {
    const result = await this.stateCodeMasterService.list(queryDto);

    return {
      success: true,
      message: 'State codes fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get state code by code' })
  @ApiQuery({ name: 'stateCode', description: '2-character state code', example: 'MH' })
  @ApiOkResponse({ type: StateCodeMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: StateCodeMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: StateCodeMasterErrorResponseDto })
  async getById(
    @Query('stateCode') stateCode: string,
  ): Promise<StateCodeMasterSuccessResponse<StateCodeMasterPayload>> {
    const data = await this.stateCodeMasterService.getById(stateCode);

    return {
      success: true,
      message: 'State code fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete state code by code' })
  @ApiQuery({ name: 'stateCode', description: '2-character state code', example: 'MH' })
  @ApiOkResponse({ type: StateCodeMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: StateCodeMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: StateCodeMasterErrorResponseDto })
  async remove(
    @Query('stateCode') stateCode: string,
  ): Promise<StateCodeMasterSuccessResponse<{ stateCode: string; deleted: true }>> {
    const data = await this.stateCodeMasterService.softDelete(stateCode);

    return {
      success: true,
      message: 'State code deleted successfully',
      data,
    };
  }
}
