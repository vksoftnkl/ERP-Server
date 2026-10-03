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
import { ListUserLoginSessionsQueryDto } from './dto/list-user-login-sessions-query.dto';
import { SaveUserLoginSessionDto } from './dto/save-user-login-session.dto';
import {
  UserLoginSessionsErrorResponseDto,
  UserLoginSessionsSuccessDeleteDto,
  UserLoginSessionsSuccessListDto,
  UserLoginSessionsSuccessSingleDto,
} from './dto/user-login-sessions-response.dto';
import { UserLoginSessionsExceptionFilter } from './user-login-sessions-exception.filter';
import { UserLoginSessionsService } from './user-login-sessions.service';
import {
  UserLoginSessionsListItem,
  UserLoginSessionsListMeta,
  UserLoginSessionsPayload,
  UserLoginSessionsSuccessResponse,
} from './types/user-login-sessions-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('User Login Sessions')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(60)
@Controller('user-login-sessions')
@UseFilters(UserLoginSessionsExceptionFilter)
export class UserLoginSessionsController {
  constructor(private readonly userLoginSessionsService: UserLoginSessionsService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update user login session (by ulsId presence)' })
  @ApiCreatedResponse({ type: UserLoginSessionsSuccessSingleDto })
  @ApiBadRequestResponse({ type: UserLoginSessionsErrorResponseDto })
  @ApiConflictResponse({ type: UserLoginSessionsErrorResponseDto })
  @ApiNotFoundResponse({ type: UserLoginSessionsErrorResponseDto })
  async save(
    @Body() saveUserLoginSessionDto: SaveUserLoginSessionDto,
  ): Promise<UserLoginSessionsSuccessResponse<UserLoginSessionsPayload>> {
    const data = await this.userLoginSessionsService.save(saveUserLoginSessionDto);

    return {
      success: true,
      message: saveUserLoginSessionDto.ulsId
        ? 'User login session updated successfully'
        : 'User login session created successfully',
      data,
    };
  }

  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List user login sessions with filter/search/pagination' })
  @ApiOkResponse({ type: UserLoginSessionsSuccessListDto })
  @ApiBadRequestResponse({ type: UserLoginSessionsErrorResponseDto })
  async list(
    @Query() queryDto: ListUserLoginSessionsQueryDto,
  ): Promise<
    UserLoginSessionsSuccessResponse<UserLoginSessionsListItem[], UserLoginSessionsListMeta>
  > {
    const result = await this.userLoginSessionsService.list(queryDto);

    return {
      success: true,
      message: 'User login sessions fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get user login session by id' })
  @ApiQuery({ name: 'ulsId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: UserLoginSessionsSuccessSingleDto })
  @ApiBadRequestResponse({ type: UserLoginSessionsErrorResponseDto })
  @ApiNotFoundResponse({ type: UserLoginSessionsErrorResponseDto })
  async getById(
    @Query('ulsId', new ParseUUIDPipe({ version: '7' })) ulsId: string,
  ): Promise<UserLoginSessionsSuccessResponse<UserLoginSessionsPayload>> {
    const data = await this.userLoginSessionsService.getById(ulsId);

    return {
      success: true,
      message: 'User login session fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete user login session by id' })
  @ApiQuery({ name: 'ulsId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: UserLoginSessionsSuccessDeleteDto })
  @ApiBadRequestResponse({ type: UserLoginSessionsErrorResponseDto })
  @ApiNotFoundResponse({ type: UserLoginSessionsErrorResponseDto })
  async remove(
    @Query('ulsId', new ParseUUIDPipe({ version: '7' })) ulsId: string,
  ): Promise<UserLoginSessionsSuccessResponse<{ ulsId: string; deleted: true }>> {
    const data = await this.userLoginSessionsService.softDelete(ulsId);

    return {
      success: true,
      message: 'User login session deleted successfully',
      data,
    };
  }
}
