import { ApiProperty } from '@nestjs/swagger';
export class LoginResponseDto {
  @ApiProperty()
  access_token!: string;
  @ApiProperty()
  refresh_token!: string;
  @ApiProperty({ example: 'Bearer' })
  token_type!: string;
  @ApiProperty({
    example: '7a9a4d16-9940-4b65-a7bc-57e83887a112',
    description: 'Authenticated user identifier',
  })
  usrId!: string;
}
