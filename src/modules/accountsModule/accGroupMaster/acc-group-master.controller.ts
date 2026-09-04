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
import { AccGroupMasterExceptionFilter } from './acc-group-master-exception.filter';
import {
  AccGroupMasterErrorResponseDto,
  AccGroupMasterSuccessDeleteDto,
  AccGroupMasterSuccessSingleDto,
} from './dto/acc-group-master-response.dto';
import { SaveAccGroupMasterDto } from './dto/save-acc-group-master.dto';
import { AccGroupMasterService } from './acc-group-master.service';
import { AccGroupMasterPayload, AccGroupMasterSuccessResponse } from './types/acc-group-master-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Account Groups')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('account-groups')
@UseFilters(AccGroupMasterExceptionFilter)
export class AccGroupMasterController {
  constructor(private readonly accGroupMasterService: AccGroupMasterService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update account group (by accGroupId presence)' })
  @ApiCreatedResponse({ type: AccGroupMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: AccGroupMasterErrorResponseDto })
  @ApiConflictResponse({ type: AccGroupMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: AccGroupMasterErrorResponseDto })
  async save(
    @Body() saveAccGroupMasterDto: SaveAccGroupMasterDto,
  ): Promise<AccGroupMasterSuccessResponse<AccGroupMasterPayload>> {
    const data = await this.accGroupMasterService.save(saveAccGroupMasterDto);

    return {
      success: true,
      message: saveAccGroupMasterDto.accGroupId
        ? 'Account group updated successfully'
        : 'Account group created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get account group by id' })
  @ApiQuery({ name: 'accGroupId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: AccGroupMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: AccGroupMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: AccGroupMasterErrorResponseDto })
  async getById(
    @Query('accGroupId', new ParseUUIDPipe({ version: '7' })) accGroupId: string,
  ): Promise<AccGroupMasterSuccessResponse<AccGroupMasterPayload>> {
    const data = await this.accGroupMasterService.getById(accGroupId);

    return {
      success: true,
      message: 'Account group fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete account group by id' })
  @ApiQuery({ name: 'accGroupId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: AccGroupMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: AccGroupMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: AccGroupMasterErrorResponseDto })
  async remove(
    @Query('accGroupId', new ParseUUIDPipe({ version: '7' })) accGroupId: string,
  ): Promise<AccGroupMasterSuccessResponse<{ accGroupId: string; deleted: true }>> {
    const data = await this.accGroupMasterService.softDelete(accGroupId);

    return {
      success: true,
      message: 'Account group deleted successfully',
      data,
    };
  }
}
