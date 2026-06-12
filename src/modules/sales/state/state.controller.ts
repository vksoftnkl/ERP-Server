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
import { StateExceptionFilter } from './state-exception.filter';
import { StateService } from './state.service';
import { SaveStateDto } from './dto/save-state.dto';
import {
  StateErrorResponseDto,
  StateSuccessDeleteDto,
  StateSuccessSingleDto,
} from './dto/state-response.dto';
import {
  StatePayload,
  StateSuccessResponse,
} from './types/state-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('States')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('states')
@UseFilters(StateExceptionFilter)
export class StateController {
  constructor(private readonly stateService: StateService) { }

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update state (by stmId presence)' })
  @ApiCreatedResponse({ type: StateSuccessSingleDto })
  @ApiBadRequestResponse({ type: StateErrorResponseDto })
  @ApiConflictResponse({ type: StateErrorResponseDto })
  @ApiNotFoundResponse({ type: StateErrorResponseDto })
  async save(@Body() saveStateDto: SaveStateDto): Promise<StateSuccessResponse<StatePayload>> {
    const data = await this.stateService.save(saveStateDto);

    return {
      success: true,
      message: saveStateDto.stmId ? 'State updated successfully' : 'State created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get state by id' })
  @ApiQuery({ name: 'stmId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: StateSuccessSingleDto })
  @ApiBadRequestResponse({ type: StateErrorResponseDto })
  @ApiNotFoundResponse({ type: StateErrorResponseDto })
  async getById(
    @Query('stmId', new ParseUUIDPipe({ version: '7' })) stmId: string,
  ): Promise<StateSuccessResponse<StatePayload>> {
    const data = await this.stateService.getById(stmId);

    return {
      success: true,
      message: 'State fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete state by id' })
  @ApiQuery({ name: 'stmId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: StateSuccessDeleteDto })
  @ApiBadRequestResponse({ type: StateErrorResponseDto })
  @ApiNotFoundResponse({ type: StateErrorResponseDto })
  async remove(
    @Query('stmId', new ParseUUIDPipe({ version: '7' })) stmId: string,
  ): Promise<StateSuccessResponse<{ stmId: string; deleted: true }>> {
    const data = await this.stateService.softDelete(stmId);

    return {
      success: true,
      message: 'State deleted successfully',
      data,
    };
  }
}
