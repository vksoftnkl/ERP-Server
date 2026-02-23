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
import { AreaExceptionFilter } from './area-exception.filter';
import { AreaService } from './area.service';
import { ListAreaQueryDto } from './dto/list-area-query.dto';
import { SaveAreaDto } from './dto/save-area.dto';
import {
  AreaErrorResponseDto,
  AreaSuccessDeleteDto,
  AreaSuccessListDto,
  AreaSuccessSingleDto,
} from './dto/area-response.dto';
import {
  AreaListItem,
  AreaListMeta,
  AreaPayload,
  AreaSuccessResponse,
} from './types/area-api.types';

@ApiTags('Areas')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('areas')
@UseFilters(AreaExceptionFilter)
export class AreaController {
  constructor(private readonly areaService: AreaService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update area (by armId presence)' })
  @ApiCreatedResponse({ type: AreaSuccessSingleDto })
  @ApiBadRequestResponse({ type: AreaErrorResponseDto })
  @ApiConflictResponse({ type: AreaErrorResponseDto })
  @ApiNotFoundResponse({ type: AreaErrorResponseDto })
  async save(@Body() saveAreaDto: SaveAreaDto): Promise<AreaSuccessResponse<AreaPayload>> {
    const data = await this.areaService.save(saveAreaDto);

    return {
      success: true,
      message: saveAreaDto.armId ? 'Area updated successfully' : 'Area created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List areas with filter/search/pagination' })
  @ApiOkResponse({ type: AreaSuccessListDto })
  @ApiBadRequestResponse({ type: AreaErrorResponseDto })
  async list(
    @Query() queryDto: ListAreaQueryDto,
  ): Promise<AreaSuccessResponse<AreaListItem[], AreaListMeta>> {
    const result = await this.areaService.list(queryDto);

    return {
      success: true,
      message: 'Areas fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get/:armId')
  @Version('1')
  @ApiOperation({ summary: 'Get area by id' })
  @ApiParam({ name: 'armId', format: 'uuid' })
  @ApiOkResponse({ type: AreaSuccessSingleDto })
  @ApiBadRequestResponse({ type: AreaErrorResponseDto })
  @ApiNotFoundResponse({ type: AreaErrorResponseDto })
  async getById(
    @Param('armId', new ParseUUIDPipe({ version: '7' })) armId: string,
  ): Promise<AreaSuccessResponse<AreaPayload>> {
    const data = await this.areaService.getById(armId);

    return {
      success: true,
      message: 'Area fetched successfully',
      data,
    };
  }

  @Delete('delete/:armId')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete area by id' })
  @ApiParam({ name: 'armId', format: 'uuid' })
  @ApiOkResponse({ type: AreaSuccessDeleteDto })
  @ApiBadRequestResponse({ type: AreaErrorResponseDto })
  @ApiNotFoundResponse({ type: AreaErrorResponseDto })
  async remove(
    @Param('armId', new ParseUUIDPipe({ version: '7' })) armId: string,
  ): Promise<AreaSuccessResponse<{ armId: string; deleted: true }>> {
    const data = await this.areaService.softDelete(armId);

    return {
      success: true,
      message: 'Area deleted successfully',
      data,
    };
  }
}
