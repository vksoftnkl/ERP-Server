import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Version,
} from '@nestjs/common';
import { UserMaster } from '@prisma/client';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { throwForbidden } from '../../common/utils/module-shared.utils';
import { PrismaService } from '../../database/prisma/prisma.service';
import { callerIsSuperAdmin } from '../settings/userAdministration/super-admin';
import { UserAdminErrorCode } from '../settings/userAdministration/types/user-administration.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';
import { API_VERSION } from '../../common/constants/api-version';
/**
 * The bare user rows (login name, mobile, password). Notes 125 §3: these were
 * @Public — anyone, logged in or not, could list every user, create one, or set
 * any user's password (a SUPER ADMIN's included). No client calls them (both
 * use /user-administration), so they are now VK Softwares' own: a login token
 * and a SUPER ADMIN caller, else 403 USER_ROLE_RESERVED.
 */
@ApiTags('Users')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'USER_ROLE_RESERVED' })
@CacheTTL(0)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}
  @Post()
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create user' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    await this.assertSuperAdmin();
    const user = await this.usersService.create(createUserDto);
    return this.toResponse(user);
  }
  @Get()
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List users' })
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  async findAll(): Promise<UserResponseDto[]> {
    await this.assertSuperAdmin();
    const users = await this.usersService.findAll();
    return users.map((user) => this.toResponse(user));
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get user by id' })
  @ApiQuery({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async findOne(@Query('id', new ParseUUIDPipe()) id: string): Promise<UserResponseDto> {
    await this.assertSuperAdmin();
    const user = await this.usersService.findOne(id);
    return this.toResponse(user);
  }
  @Patch(':id')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Update user by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    await this.assertSuperAdmin();
    const user = await this.usersService.update(id, updateUserDto);
    return this.toResponse(user);
  }
  @Delete('delete')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user by id' })
  @ApiQuery({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async remove(@Query('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.assertSuperAdmin();
    await this.usersService.remove(id);
  }
  private async assertSuperAdmin(): Promise<void> {
    if (!(await callerIsSuperAdmin(this.prisma, this.requestContext.getUserId()))) {
      throwForbidden('User role reserved', [
        {
          field: 'userId',
          code: UserAdminErrorCode.ROLE_RESERVED,
          message: '/users is for a SUPER ADMIN only: manage users on /user-administration',
        },
      ]);
    }
  }

  private toResponse(user: UserMaster): UserResponseDto {
    return {
      usrId: user.usrId,
      usrLoginName: user.usrLoginName,
      usrMobileNo: user.usrMobileNo,
      usrIsActive: user.usrIsActive,
      usrCreatedOn: user.usrCreatedOn.toISOString(),
      usrModifiedOn: user.usrModifiedOn?.toISOString() ?? null,
    };
  }
}
