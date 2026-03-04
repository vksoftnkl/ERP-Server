import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty({ example: 'Bearer' })
  token_type!: string;
}
