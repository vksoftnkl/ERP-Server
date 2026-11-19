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
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  UserAdminErrorResponseDto,
  UserAdminSuccessDeleteDto,
  UserAdminSuccessSingleDto,
} from './dto/user-administration-response.dto';
import { SaveUserAdministrationDto } from './dto/save-user-administration.dto';
import { UserAdministrationExceptionFilter } from './user-administration-exception.filter';
import { UserAdministrationService } from './user-administration.service';
import { UserAdminPayload, UserAdminSuccessResponse } from './types/user-administration-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

// Notes 125 §3: no longer @Public — the SUPER ADMIN guard has to know who is calling, and an
// anonymous caller could create users. Both clients send the login token on these routes.
// Review list 11-19 S2: every route is also judged on the caller's Users & Rights (menu 58) row:
// create = Create, update = Edit, delete = Delete, get = View (except the caller's own row).
@ApiTags('User Administration')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({
  type: UserAdminErrorResponseDto,
  description:
    'USER_RIGHT_CREATE / USER_RIGHT_EDIT / USER_RIGHT_DELETE / USER_RIGHT_VIEW (field userId) — the ' +
    'caller lacks that right on Users & Rights (menu 58). ' +
    'USER_ROLE_RESERVED — only a SUPER ADMIN makes a user SUPER ADMIN, or changes / deletes one',
})
@CacheTTL(1)
@Controller('user-administration')
@UseFilters(UserAdministrationExceptionFilter)
export class UserAdministrationController {
  constructor(private readonly userAdministrationService: UserAdministrationService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update user with menu permissions (by usrId presence)',
    description:
      'Omit usrId to create a new user (menu 58 Create right). Provide usrId to update (menu 58 Edit ' +
      "right, the caller's own row included: a user changes their own password through " +
      'POST /auth/change-password). ' +
      'The menus array fully replaces existing menu assignments: omit the field entirely to leave menus unchanged on update.',
  })
  @ApiCreatedResponse({ type: UserAdminSuccessSingleDto })
  @ApiBadRequestResponse({ type: UserAdminErrorResponseDto })
  @ApiConflictResponse({ type: UserAdminErrorResponseDto })
  @ApiNotFoundResponse({ type: UserAdminErrorResponseDto })
  async save(
    @Body() dto: SaveUserAdministrationDto,
  ): Promise<UserAdminSuccessResponse<UserAdminPayload>> {
    const data = await this.userAdministrationService.save(dto);
    return {
      success: true,
      message: dto.usrId ? 'User updated successfully' : 'User created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get user by id including all active menu permissions',
    description: "The caller's own row needs no right; any other user's needs menu 58 View.",
  })
  @ApiQuery({ name: 'usrId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: UserAdminSuccessSingleDto })
  @ApiBadRequestResponse({ type: UserAdminErrorResponseDto })
  @ApiNotFoundResponse({ type: UserAdminErrorResponseDto })
  async getById(
    @Query('usrId', new ParseUUIDPipe({ version: '7' })) usrId: string,
  ): Promise<UserAdminSuccessResponse<UserAdminPayload>> {
    const data = await this.userAdministrationService.getById(usrId);
    return {
      success: true,
      message: 'User fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete user and all their menu assignments by usrId',
    description: 'Needs menu 58 Delete right.',
  })
  @ApiQuery({ name: 'usrId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: UserAdminSuccessDeleteDto })
  @ApiBadRequestResponse({ type: UserAdminErrorResponseDto })
  @ApiNotFoundResponse({ type: UserAdminErrorResponseDto })
  async remove(
    @Query('usrId', new ParseUUIDPipe({ version: '7' })) usrId: string,
  ): Promise<UserAdminSuccessResponse<{ usrId: string; deleted: true }>> {
    const data = await this.userAdministrationService.softDelete(usrId);
    return {
      success: true,
      message: 'User deleted successfully',
      data,
    };
  }
}
