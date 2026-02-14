import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'john.doe' })
  @IsString()
  user_name!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  user_password!: string;
}
