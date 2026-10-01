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
  BranchMasterSuccessSingleDto,
} from './dto/branch-master-response.dto';
import { SaveBranchMasterDto } from './dto/save-branch-master.dto';
import { BranchMasterService } from './branch-master.service';
import { BranchMasterPayload, BranchMasterSuccessResponse } from './types/branch-master-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Branch Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('branch-masters')
@UseFilters(BranchMasterExceptionFilter)
export class BranchMasterController {
  constructor(private readonly branchMasterService: BranchMasterService) {}

  @Post('create')
  @Version(API_VERSION)
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

  @Get('get')
  @Version(API_VERSION)
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
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete branch by id',
    description:
      '409 while the branch has any document, stock row, user or device, and for the ' +
      "company's default branch while the company has other live branches.",
  })
  @ApiQuery({ name: 'brId', type: String, example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c' })
  @ApiOkResponse({ type: BranchMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: BranchMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: BranchMasterErrorResponseDto })
  @ApiConflictResponse({ type: BranchMasterErrorResponseDto })
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

  @Post('restore')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Restore a soft-deleted branch',
    description:
      'It comes back active. 409 when the branch is not deleted, when its company is deleted, ' +
      'or when a live branch of the company now has its name.',
  })
  @ApiQuery({ name: 'brId', type: String, example: '018e1b2c-3d4e-7f8a-9b0c-1d2e3f4a5b6c' })
  @ApiCreatedResponse({ type: BranchMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: BranchMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: BranchMasterErrorResponseDto })
  @ApiConflictResponse({ type: BranchMasterErrorResponseDto })
  async restore(
    @Query('brId', ParseUUIDPipe) brId: string,
  ): Promise<BranchMasterSuccessResponse<{ brId: string; deleted: false }>> {
    const data = await this.branchMasterService.restore(brId);

    return {
      success: true,
      message: 'Branch restored successfully',
      data,
    };
  }
}
