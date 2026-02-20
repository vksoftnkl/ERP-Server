import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'john.doe' })
  @IsString()
  user_name!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  user_password!: string;
}
