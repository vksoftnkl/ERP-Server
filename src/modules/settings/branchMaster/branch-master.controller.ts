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
import { BranchMasterExceptionFilter } from './branch-master-exception.filter';
import {
  BranchMasterErrorResponseDto,
  BranchMasterSuccessDeleteDto,
  BranchMasterSuccessListDto,
  BranchMasterSuccessSingleDto,
} from './dto/branch-master-response.dto';
import { ListBranchMasterQueryDto } from './dto/list-branch-master-query.dto';
import { SaveBranchMasterDto } from './dto/save-branch-master.dto';
import { BranchMasterService } from './branch-master.service';
import {
  BranchMasterListItem,
  BranchMasterListMeta,
  BranchMasterPayload,
  BranchMasterSuccessResponse,
} from './types/branch-master-api.types';

@ApiTags('Branch Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(3600)
@Controller('branch-masters')
@UseFilters(BranchMasterExceptionFilter)
export class BranchMasterController {
  constructor(private readonly branchMasterService: BranchMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update branch (by brId presence)' })
  @ApiCreatedResponse({ type: BranchMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: BranchMasterErrorResponseDto })
  @ApiConflictResponse({ type: BranchMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: BranchMasterErrorResponseDto })
  async save(
    @Body() saveBranchMasterDto: SaveBranchMasterDto,
  ): Promise<BranchMasterSuccessResponse<BranchMasterPayload>> {
    const data = await this.branchMasterService.save(saveBranchMasterDto);

    return {
      success: true,
      message: saveBranchMasterDto.brId
        ? 'Branch updated successfully'
        : 'Branch created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List branches with filter/search/pagination' })
  @ApiOkResponse({ type: BranchMasterSuccessListDto })
  @ApiBadRequestResponse({ type: BranchMasterErrorResponseDto })
  async list(
    @Query() queryDto: ListBranchMasterQueryDto,
  ): Promise<BranchMasterSuccessResponse<BranchMasterListItem[], BranchMasterListMeta>> {
    const result = await this.branchMasterService.list(queryDto);

    return {
      success: true,
      message: 'Branches fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get branch by id' })
  @ApiQuery({ name: 'brId', type: String, example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c' })
  @ApiOkResponse({ type: BranchMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: BranchMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: BranchMasterErrorResponseDto })
  async getById(
    @Query('brId', ParseUUIDPipe) brId: string,
  ): Promise<BranchMasterSuccessResponse<BranchMasterPayload>> {
    const data = await this.branchMasterService.getById(brId);

    return {
      success: true,
      message: 'Branch fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete branch by id' })
  @ApiQuery({ name: 'brId', type: String, example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c' })
  @ApiOkResponse({ type: BranchMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: BranchMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: BranchMasterErrorResponseDto })
  async remove(
    @Query('brId', ParseUUIDPipe) brId: string,
  ): Promise<BranchMasterSuccessResponse<{ brId: string; deleted: true }>> {
    const data = await this.branchMasterService.softDelete(brId);

    return {
      success: true,
      message: 'Branch deleted successfully',
      data,
    };
  }
}
