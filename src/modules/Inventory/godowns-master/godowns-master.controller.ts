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
  GodownSuccessListDto,
  GodownSuccessSingleDto,
} from './dto/godown-response.dto';
import { ListOrGetGodownQueryDto } from './dto/list-or-get-godown-query.dto';
import { SaveGodownDto } from './dto/save-godown.dto';
import { GodownExceptionFilter } from './godown-exception.filter';
import { GodownsMasterService } from './godowns-master.service';
import {
  GodownListItem,
  GodownListMeta,
  GodownPayload,
  GodownSuccessResponse,
} from './types/godown-api.types';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';

@ApiTags('Godowns')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
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
    summary: 'List godown locations or get single location when gdl_id query is provided',
  })
  @ApiOkResponse({ type: GodownSuccessListDto })
  @ApiBadRequestResponse({ type: GodownErrorResponseDto })
  @ApiNotFoundResponse({ type: GodownErrorResponseDto })
  async listOrGet(
    @Query() queryDto: ListOrGetGodownQueryDto,
  ): Promise<GodownSuccessResponse<GodownPayload | GodownListItem[], GodownListMeta>> {
    if (queryDto.gdl_id) {
      const data = await this.godownsMasterService.getById(queryDto.gdl_id);
      return {
        success: true,
        message: 'Godown location fetched successfully',
        data,
      };
    }

    const result = await this.godownsMasterService.list(queryDto);

    return {
      success: true,
      message: 'Godown locations fetched successfully',
      data: result.items,
      meta: result.meta,
      styles: result.styles ?? [],
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

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List godown locations' })
  @ApiOkResponse({ type: GodownSuccessListDto })
  @ApiBadRequestResponse({ type: GodownErrorResponseDto })
  async getList(
    @Query() queryDto: ListOrGetGodownQueryDto,
  ): Promise<GodownSuccessResponse<GodownListItem[], GodownListMeta>> {
    const result = await this.godownsMasterService.getList(queryDto);

    return {
      success: true,
      message: 'Godown locations fetched successfully',
      data: result.items,
      meta: result.meta,
      styles: result.styles ?? [],
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
