import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FixedErrorFieldDto,
  FixedErrorResponseDto,
  FixedListMetaDto,
} from 'src/common/utils/module-response.dto';
export { FixedErrorFieldDto as UserLoginSessionsErrorFieldDto };
export { FixedErrorResponseDto as UserLoginSessionsErrorResponseDto };
export { FixedListMetaDto as UserLoginSessionsListMetaDto };

export class UserLoginSessionsPayloadDto {
  @ApiProperty({ format: 'uuid' })
  ulsId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ulsCompanyId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ulsBranchId!: string | null;

  @ApiProperty({ format: 'uuid' })
  ulsUserId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ulsDeviceId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ulsSessionId!: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  ulsSessionToken!: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  ulsRefreshTokenId!: string | null;

  @ApiProperty()
  ulsLoginOn!: string;

  @ApiPropertyOptional({ nullable: true })
  ulsLogoutOn!: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  ulsLogoutType!: string | null;

  @ApiProperty({ maxLength: 20, example: 'SUCCESS' })
  ulsLoginStatus!: string;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  ulsFailReason!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '192.168.1.22' })
  ulsIpAddress!: string | null;

  @ApiPropertyOptional({ nullable: true })
  ulsUserAgent!: string | null;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  ulsAppVersion!: string | null;

  @ApiProperty({ example: true })
  ulsIsActiveSession!: boolean;

  @ApiProperty({ example: true })
  ulsIsActive!: boolean;

  @ApiProperty({ example: false })
  ulsIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  ulsSyncDate!: string | null;

  @ApiProperty()
  ulsCreatedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  ulsCreatedBy!: string | null;

  @ApiProperty()
  ulsModifiedOn!: string;

  @ApiPropertyOptional({ nullable: true })
  ulsModifiedBy!: string | null;
}

export class UserLoginSessionsDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  ulsId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class UserLoginSessionsSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'User login session fetched successfully' })
  message!: string;

  @ApiProperty({ type: UserLoginSessionsPayloadDto })
  data!: UserLoginSessionsPayloadDto;
}

export class UserLoginSessionsSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'User login sessions fetched successfully' })
  message!: string;

  @ApiProperty({ type: UserLoginSessionsPayloadDto, isArray: true })
  data!: UserLoginSessionsPayloadDto[];

  @ApiProperty({ type: FixedListMetaDto })
  meta!: FixedListMetaDto;
}

export class UserLoginSessionsSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'User login session deleted successfully' })
  message!: string;

  @ApiProperty({ type: UserLoginSessionsDeleteResultDto })
  data!: UserLoginSessionsDeleteResultDto;
}
