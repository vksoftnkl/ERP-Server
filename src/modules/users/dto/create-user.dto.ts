import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
export class CreateUserDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  user_phone!: string;
  @ApiProperty({ example: 'john.doe' })
  @IsString()
  user_name!: string;
  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  user_password!: string;
}
