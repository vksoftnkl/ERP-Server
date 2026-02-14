import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  user_id!: string;

  @ApiProperty({ format: 'string' })
  user_name!: string;
}
