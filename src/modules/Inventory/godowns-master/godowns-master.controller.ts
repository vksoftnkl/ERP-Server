import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Post,
  Query,
  Res,
  UseFilters,
  Version,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DeleteGodownQueryDto } from './dto/delete-godown-query.dto';
import {
  GodownErrorResponseDto,
  GodownSuccessDeleteDto,
  GodownSuccessSingleDto,
} from './dto/godown-response.dto';
import { SaveGodownDto } from './dto/save-godown.dto';
import { GodownExceptionFilter } from './godown-exception.filter';
import { GodownsMasterService } from './godowns-master.service';
import { GodownPayload, GodownSuccessResponse } from './types/godown-api.types';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';

@ApiTags('Godowns')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('godowns')
@UseFilters(GodownExceptionFilter)
export class GodownsMasterController {
  constructor(private readonly godownsMasterService: GodownsMasterService) {}

  @Post()
  @Version('1')
  @ApiOperation({
    summary: 'Create or update godown location (by gdl_id presence in request body)',
  })
  @ApiCreatedResponse({ type: GodownSuccessSingleDto })
  @ApiOkResponse({ type: GodownSuccessSingleDto })
  @ApiBadRequestResponse({ type: GodownErrorResponseDto })
  @ApiConflictResponse({ type: GodownErrorResponseDto })
  @ApiNotFoundResponse({ type: GodownErrorResponseDto })
  async save(
    @Body() saveGodownDto: SaveGodownDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<GodownSuccessResponse<GodownPayload>> {
    const isUpdate = Boolean(saveGodownDto.gdl_id);
    response.status(isUpdate ? HttpStatus.OK : HttpStatus.CREATED);

    const data = await this.godownsMasterService.save(saveGodownDto);

    return {
      success: true,
      message: isUpdate
        ? 'Godown location updated successfully'
        : 'Godown location created successfully',
      data,
    };
  }

  @Post('create')
  @Version('1')
  @ApiOperation({
    summary: 'Create or update godown location (by gdl_id presence in request body)',
  })
  @ApiCreatedResponse({ type: GodownSuccessSingleDto })
  @ApiOkResponse({ type: GodownSuccessSingleDto })
  @ApiBadRequestResponse({ type: GodownErrorResponseDto })
  @ApiConflictResponse({ type: GodownErrorResponseDto })
  @ApiNotFoundResponse({ type: GodownErrorResponseDto })
  async create(
    @Body() saveGodownDto: SaveGodownDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<GodownSuccessResponse<GodownPayload>> {
    return this.save(saveGodownDto, response);
  }

  @Get()
  @Version('1')
  @ApiOperation({
    summary: 'Get godown location by gdl_id query parameter',
  })
  @ApiOkResponse({ type: GodownSuccessSingleDto })
  @ApiBadRequestResponse({ type: GodownErrorResponseDto })
  @ApiNotFoundResponse({ type: GodownErrorResponseDto })
  async listOrGet(
    @Query() queryDto: DeleteGodownQueryDto,
  ): Promise<GodownSuccessResponse<GodownPayload>> {
    const data = await this.godownsMasterService.getById(queryDto.gdl_id);
    return {
      success: true,
      message: 'Godown location fetched successfully',
      data,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get godown location by gdl_id query parameter' })
  @ApiOkResponse({ type: GodownSuccessSingleDto })
  @ApiBadRequestResponse({ type: GodownErrorResponseDto })
  @ApiNotFoundResponse({ type: GodownErrorResponseDto })
  async getByIdByQuery(
    @Query() queryDto: DeleteGodownQueryDto,
  ): Promise<GodownSuccessResponse<GodownPayload>> {
    const data = await this.godownsMasterService.getById(queryDto.gdl_id);

    return {
      success: true,
      message: 'Godown location fetched successfully',
      data,
    };
  }

  @Delete()
  @Version('1')
  @ApiOperation({ summary: 'Soft delete godown location by gdl_id query parameter' })
  @ApiOkResponse({ type: GodownSuccessDeleteDto })
  @ApiBadRequestResponse({ type: GodownErrorResponseDto })
  @ApiNotFoundResponse({ type: GodownErrorResponseDto })
  async remove(
    @Query() queryDto: DeleteGodownQueryDto,
  ): Promise<GodownSuccessResponse<{ gdl_id: string; deleted: true }>> {
    const data = await this.godownsMasterService.softDelete(queryDto.gdl_id);

    return {
      success: true,
      message: 'Godown location deleted successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete godown location by gdl_id query parameter' })
  @ApiOkResponse({ type: GodownSuccessDeleteDto })
  @ApiBadRequestResponse({ type: GodownErrorResponseDto })
  @ApiNotFoundResponse({ type: GodownErrorResponseDto })
  async removeByQuery(
    @Query() queryDto: DeleteGodownQueryDto,
  ): Promise<GodownSuccessResponse<{ gdl_id: string; deleted: true }>> {
    return this.remove(queryDto);
  }
}
