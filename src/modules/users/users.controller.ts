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
import { User } from '@prisma/client';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@Public()
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Version('1')
  @ApiOperation({ summary: 'Create user' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(createUserDto);
    return this.toResponse(user);
  }

  @Get()
  @Version('1')
  @ApiOperation({ summary: 'List users' })
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersService.findAll();
    return users.map((user) => this.toResponse(user));
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get user by id' })
  @ApiQuery({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async findOne(@Query('id', new ParseUUIDPipe()) id: string): Promise<UserResponseDto> {
    const user = await this.usersService.findOne(id);
    return this.toResponse(user);
  }

  @Patch(':id')
  @Version('1')
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
    const user = await this.usersService.update(id, updateUserDto);
    return this.toResponse(user);
  }

  @Delete('delete')
  @Version('1')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user by id' })
  @ApiQuery({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async remove(@Query('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.usersService.remove(id);
  }

  private toResponse(user: User): UserResponseDto {
    return {
      user_id: user.user_id,
      user_code: user.user_code,
      user_phone: user.user_phone,
      user_name: user.user_name,
      created_at: user.created_at.toISOString(),
      updated_at: user.updated_at.toISOString(),
    };
  }
}
