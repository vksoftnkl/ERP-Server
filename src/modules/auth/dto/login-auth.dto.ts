import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginAuthDto {
  @ApiProperty({ example: 'john.doe', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  user_name!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @IsNotEmpty()
  user_password!: string;
}
