import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserType } from '../types/user-administration.enum';

export class UserAdminErrorFieldDto {
  @ApiProperty({ example: 'usrLoginName' })
  field!: string;

  @ApiProperty({ example: 'Duplicate login name is not allowed' })
  message!: string;
}

export class UserAdminErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: UserAdminErrorFieldDto, isArray: true })
  errors!: UserAdminErrorFieldDto[];
}

export class UserMenuPayloadDto {
  @ApiProperty({ format: 'uuid' })
  umId!: string;

  @ApiProperty({ format: 'uuid' })
  umUserId!: string;

  @ApiProperty()
  umMenuId!: number;

  @ApiProperty()
  umCanView!: boolean;

  @ApiProperty()
  umCanCreate!: boolean;

  @ApiProperty()
  umCanEdit!: boolean;

  @ApiProperty()
  umCanDelete!: boolean;

  @ApiProperty()
  umCanPrint!: boolean;

  @ApiProperty()
  umCanExport!: boolean;

  @ApiProperty()
  umVisibility!: boolean;

  @ApiProperty()
  umIsFavourite!: boolean;

  @ApiProperty()
  umIsPinned!: boolean;

  @ApiProperty()
  umSortOrder!: number;

  @ApiProperty()
  umIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  umSyncDate!: string | null;

  @ApiProperty()
  umCreatedOn!: string;

  @ApiProperty({ format: 'uuid' })
  umCreatedBy!: string;

  @ApiPropertyOptional({ nullable: true })
  umModifiedOn!: string | null;

  @ApiPropertyOptional({ nullable: true })
  umModifiedBy!: string | null;
}

export class UserAdminPayloadDto {
  @ApiProperty({ format: 'uuid' })
  usrId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  usrCompanyId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Acme Pvt Ltd',
    description: 'Name of the linked company (resolved on the get endpoint)',
  })
  usrCompanyName?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  usrBranchId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Main Branch',
    description: 'Name of the linked branch (resolved on the get endpoint)',
  })
  usrBranchName?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  usrEmployeeId!: string | null;

  @ApiProperty()
  usrLoginName!: string;

  @ApiProperty()
  usrDisplayName!: string;

  @ApiPropertyOptional({ nullable: true })
  usrFullName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  usrMobileNo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  usrEmail!: string | null;

  @ApiPropertyOptional({ nullable: true })
  usrAvatarUrl!: string | null;

  @ApiProperty()
  usrTimezone!: string;

  @ApiProperty()
  usrLanguage!: string;

  @ApiProperty()
  usrMustChangePassword!: boolean;

  @ApiPropertyOptional({ nullable: true })
  usrPasswordExpiresOn!: string | null;

  @ApiPropertyOptional({ nullable: true })
  usrPasswordChangedOn!: string | null;

  @ApiPropertyOptional({ enum: UserType, enumName: 'UserType', nullable: true })
  usrType!: UserType | null;

  @ApiProperty()
  usrEditDate!: boolean;

  @ApiProperty()
  usrEditEntry!: boolean;

  @ApiProperty()
  usrEditRate!: boolean;

  @ApiProperty()
  usrDesktopLogin!: boolean;

  @ApiProperty()
  usrWebLogin!: boolean;

  @ApiProperty()
  usrMobileLogin!: boolean;

  @ApiProperty()
  usrIsActive!: boolean;

  @ApiProperty()
  usrIsLocked!: boolean;

  @ApiProperty()
  usrFailedLoginCount!: number;

  @ApiPropertyOptional({ nullable: true })
  usrLastFailedLoginOn!: string | null;

  @ApiPropertyOptional({ nullable: true })
  usrLockedOn!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  usrLockedBy!: string | null;

  @ApiPropertyOptional({ nullable: true })
  usrLastLoginOn!: string | null;

  @ApiProperty()
  usrIsDeleted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  usrNotes!: string | null;

  @ApiPropertyOptional({ nullable: true })
  usrSyncDate!: string | null;

  @ApiProperty()
  usrCreatedOn!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  usrCreatedBy!: string | null;

  @ApiPropertyOptional({ nullable: true })
  usrModifiedOn!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  usrModifiedBy!: string | null;

  @ApiProperty({ type: UserMenuPayloadDto, isArray: true })
  menus!: UserMenuPayloadDto[];
}

export class UserAdminDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  usrId!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class UserAdminSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'User fetched successfully' })
  message!: string;

  @ApiProperty({ type: UserAdminPayloadDto })
  data!: UserAdminPayloadDto;
}

export class UserAdminSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'User deleted successfully' })
  message!: string;

  @ApiProperty({ type: UserAdminDeleteResultDto })
  data!: UserAdminDeleteResultDto;
}
