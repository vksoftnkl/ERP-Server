import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  UserAdminSuccessResetPasswordDto,
  UserAdminSuccessRestoreDto,
  UserAdminSuccessSingleDto,
  UserAdminSuccessUnlockDto,
} from './dto/user-administration-response.dto';
import {
  ResetUserPasswordDto,
  SaveUserAdministrationDto,
} from './dto/save-user-administration.dto';
import { UserAdministrationExceptionFilter } from './user-administration-exception.filter';
import { UserAdministrationService } from './user-administration.service';
import {
  UserAdminPayload,
  UserAdminResetPasswordResult,
  UserAdminRestoreResult,
  UserAdminSuccessResponse,
  UserAdminUnlockResult,
} from './types/user-administration-api.types';
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

  // Review step 6 (U8). The password travels in the body, never a query string.
  @Post('reset-password')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reset a user's password (typed or generated); the user must change it at next login",
    description:
      'Menu 58 Edit right (403 USER_RIGHT_EDIT). Send newPassword (at least 4 characters, ' +
      'spaces at either end not counted: 400 USER_PASSWORD_TOO_SHORT) or generate: true (8 ' +
      'random characters, answered ONCE in generatedPassword); both = 400 ' +
      'USER_RESET_PASSWORD_CHOICE. Sets usrMustChangePassword: the next login answers ' +
      'mustChangePassword: true. 404 USER_NOT_FOUND (no live user), 403 USER_ROLE_RESERVED ' +
      '(a SUPER ADMIN user, caller not one). The lock and the failed-login count are left as ' +
      'they are (POST /unlock). The audit row names the administrator, never the password.',
  })
  @ApiOkResponse({ type: UserAdminSuccessResetPasswordDto })
  @ApiBadRequestResponse({ type: UserAdminErrorResponseDto })
  @ApiNotFoundResponse({ type: UserAdminErrorResponseDto })
  async resetPassword(
    @Body() dto: ResetUserPasswordDto,
  ): Promise<UserAdminSuccessResponse<UserAdminResetPasswordResult>> {
    const data = await this.userAdministrationService.resetPassword(dto);
    return { success: true, message: 'Password reset', data };
  }

  // Review step 6.
  @Post('unlock')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unlock a user: clear the lock and the failed-login count',
    description:
      'Menu 58 Edit right (403 USER_RIGHT_EDIT). Clears usrIsLocked, usrLockedOn, usrLockedBy ' +
      'and usrFailedLoginCount; one audit row. Nothing to clear = changed: false, no row. ' +
      '404 USER_NOT_FOUND (no live user), 403 USER_ROLE_RESERVED (a SUPER ADMIN user).',
  })
  @ApiQuery({ name: 'usrId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: UserAdminSuccessUnlockDto })
  @ApiBadRequestResponse({ type: UserAdminErrorResponseDto })
  @ApiNotFoundResponse({ type: UserAdminErrorResponseDto })
  async unlock(
    @Query('usrId', new ParseUUIDPipe({ version: '7' })) usrId: string,
  ): Promise<UserAdminSuccessResponse<UserAdminUnlockResult>> {
    const data = await this.userAdministrationService.unlock(usrId);
    return { success: true, message: data.changed ? 'User unlocked' : 'Nothing to unlock', data };
  }

  // Review step 6 (U10).
  @Post('restore')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restore a deleted user (it comes back inactive, with the rights the delete removed)',
    description:
      'Menu 58 Delete right (403 USER_RIGHT_DELETE). The user comes back INACTIVE, with the ' +
      'menu rights its delete removed (menuCount; rights an earlier save removed, and rows of a ' +
      'menu no longer active, stay removed). 404 USER_NOT_FOUND, 409 ' +
      'USER_NOT_DELETED, 409 USER_RESTORE_LOGIN_TAKEN (a live user now has the login name; ' +
      'detail loginName), 403 USER_ROLE_RESERVED (a SUPER ADMIN user). One audit row.',
  })
  @ApiQuery({ name: 'usrId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: UserAdminSuccessRestoreDto })
  @ApiBadRequestResponse({ type: UserAdminErrorResponseDto })
  @ApiNotFoundResponse({ type: UserAdminErrorResponseDto })
  @ApiConflictResponse({ type: UserAdminErrorResponseDto })
  async restore(
    @Query('usrId', new ParseUUIDPipe({ version: '7' })) usrId: string,
  ): Promise<UserAdminSuccessResponse<UserAdminRestoreResult>> {
    const data = await this.userAdministrationService.restore(usrId);
    return { success: true, message: 'User restored', data };
  }
}
