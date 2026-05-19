import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  OptionalQueryBoolean,
  OptionalQueryInt,
  OptionalTrimmedString,
} from 'src/common/dto/dtoDecorators';
import { UserType } from '../types/user-administration.enum';

export class ListUserAdministrationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  usrCompanyId?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  usrIsActive?: boolean;

  @ApiPropertyOptional({ enum: UserType, enumName: 'UserType' })
  @IsOptional()
  @IsEnum(UserType)
  usrType?: UserType;

  @ApiPropertyOptional({ maxLength: 200, description: 'Search login name, display name, email, mobile' })
  @OptionalTrimmedString(200)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @OptionalQueryInt(1, 100)
  limit?: number;
}
