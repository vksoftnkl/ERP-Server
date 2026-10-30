import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({ description: 'User type (e.g. ADMIN, USER)' })
  user_type!: string | null;
  @ApiProperty({ description: 'User display name' })
  user_name!: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Device identifier' })
  device_id!: string | null;
  @ApiPropertyOptional({ description: 'Device name' })
  device_name!: string | null;
  @ApiPropertyOptional({ format: 'uuid', description: 'Company ID linked to the device' })
  dev_company_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', description: 'Branch ID linked to the device' })
  dev_branch_id!: string | null;
  @ApiPropertyOptional({ format: 'uuid', description: 'User ID linked to the device' })
  dev_user_id!: string | null;
  @ApiPropertyOptional({ description: 'Device type (e.g. Desktop, Mobile)' })
  device_type!: string | null;
}
