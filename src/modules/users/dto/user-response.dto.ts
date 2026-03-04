import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  user_id!: string;

  @ApiProperty({ format: 'string' })
  user_code!: string;

  @ApiProperty({ format: 'string' })
  user_phone!: string;

  @ApiProperty({ format: 'string' })
  user_name!: string;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;
}
