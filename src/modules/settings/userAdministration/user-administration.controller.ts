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

@ApiTags('User Administration')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('user-administration')
@UseFilters(UserAdministrationExceptionFilter)
export class UserAdministrationController {
  constructor(private readonly userAdministrationService: UserAdministrationService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update user with menu permissions (by usrId presence)',
    description:
      'Omit usrId to create a new user. Provide usrId to update. ' +
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
  @ApiOperation({ summary: 'Get user by id including all active menu permissions' })
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
  @ApiOperation({ summary: 'Soft delete user and all their menu assignments by usrId' })
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
