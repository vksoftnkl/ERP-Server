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
import { AccountGroupExceptionFilter } from './account-group-exception.filter';
import {
  AccountGroupErrorResponseDto,
  AccountGroupSuccessDeleteDto,
  AccountGroupSuccessSingleDto,
} from './dto/account-group-response.dto';
import { SaveAccountGroupDto } from './dto/save-account-group.dto';
import { AccountsGroupService } from './accounts-group.service';
import { AccountGroupPayload, AccountGroupSuccessResponse } from './types/account-group-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Account Groups')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('account-groups')
@UseFilters(AccountGroupExceptionFilter)
export class AccountsGroupController {
  constructor(private readonly accountsGroupService: AccountsGroupService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update account group (by accGroupId presence)' })
  @ApiCreatedResponse({ type: AccountGroupSuccessSingleDto })
  @ApiBadRequestResponse({ type: AccountGroupErrorResponseDto })
  @ApiConflictResponse({ type: AccountGroupErrorResponseDto })
  @ApiNotFoundResponse({ type: AccountGroupErrorResponseDto })
  async save(
    @Body() saveAccountGroupDto: SaveAccountGroupDto,
  ): Promise<AccountGroupSuccessResponse<AccountGroupPayload>> {
    const data = await this.accountsGroupService.save(saveAccountGroupDto);

    return {
      success: true,
      message: saveAccountGroupDto.accGroupId
        ? 'Account group updated successfully'
        : 'Account group created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get account group by id' })
  @ApiQuery({ name: 'accGroupId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: AccountGroupSuccessSingleDto })
  @ApiBadRequestResponse({ type: AccountGroupErrorResponseDto })
  @ApiNotFoundResponse({ type: AccountGroupErrorResponseDto })
  async getById(
    @Query('accGroupId', new ParseUUIDPipe({ version: '7' })) accGroupId: string,
  ): Promise<AccountGroupSuccessResponse<AccountGroupPayload>> {
    const data = await this.accountsGroupService.getById(accGroupId);

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
  @ApiOkResponse({ type: AccountGroupSuccessDeleteDto })
  @ApiBadRequestResponse({ type: AccountGroupErrorResponseDto })
  @ApiNotFoundResponse({ type: AccountGroupErrorResponseDto })
  async remove(
    @Query('accGroupId', new ParseUUIDPipe({ version: '7' })) accGroupId: string,
  ): Promise<AccountGroupSuccessResponse<{ accGroupId: string; deleted: true }>> {
    const data = await this.accountsGroupService.softDelete(accGroupId);

    return {
      success: true,
      message: 'Account group deleted successfully',
      data,
    };
  }
}
