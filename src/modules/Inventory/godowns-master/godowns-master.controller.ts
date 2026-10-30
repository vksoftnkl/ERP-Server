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
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Godowns')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('godowns')
@UseFilters(GodownExceptionFilter)
export class GodownsMasterController {
  constructor(private readonly godownsMasterService: GodownsMasterService) {}
  @Post('create')
  @Version(API_VERSION)
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
  @Get()
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get godown location by gdl_id query parameter (alias of /godowns/get)',
  })
  @ApiOkResponse({ type: GodownSuccessSingleDto })
  @ApiBadRequestResponse({ type: GodownErrorResponseDto })
  @ApiNotFoundResponse({ type: GodownErrorResponseDto })
  async getByQuery(
    @Query() queryDto: DeleteGodownQueryDto,
  ): Promise<GodownSuccessResponse<GodownPayload>> {
    return this.listOrGet(queryDto);
  }
  @Get('get')
  @Version(API_VERSION)
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
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete a godown location by gdl_id query parameter',
    description:
      'Deletes only — it is not a toggle: an already deleted location is a 409 (use POST ' +
      '/godowns/restore). Refused with 409 while child locations, stock on hand, or a ' +
      "branch's default godown still point at it.",
  })
  @ApiOkResponse({ type: GodownSuccessDeleteDto })
  @ApiBadRequestResponse({ type: GodownErrorResponseDto })
  @ApiNotFoundResponse({ type: GodownErrorResponseDto })
  @ApiConflictResponse({ type: GodownErrorResponseDto })
  async remove(
    @Query() queryDto: DeleteGodownQueryDto,
  ): Promise<GodownSuccessResponse<{ gdl_id: string; deleted: boolean }>> {
    const data = await this.godownsMasterService.softDelete(queryDto.gdl_id);
    return { success: true, message: 'Godown location deleted successfully', data };
  }

  @Post('restore')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Restore a soft-deleted godown location by gdl_id query parameter',
    description: '409 when the location is not deleted, or when its parent location is.',
  })
  @ApiCreatedResponse({ type: GodownSuccessDeleteDto })
  @ApiBadRequestResponse({ type: GodownErrorResponseDto })
  @ApiNotFoundResponse({ type: GodownErrorResponseDto })
  @ApiConflictResponse({ type: GodownErrorResponseDto })
  async restore(
    @Query() queryDto: DeleteGodownQueryDto,
  ): Promise<GodownSuccessResponse<{ gdl_id: string; deleted: boolean }>> {
    const data = await this.godownsMasterService.restore(queryDto.gdl_id);
    return { success: true, message: 'Godown location restored successfully', data };
  }
}
