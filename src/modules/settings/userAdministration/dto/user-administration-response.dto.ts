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

  @ApiProperty({ description: 'May /post. Transaction screens only.' })
  umCanPost!: boolean;

  @ApiProperty({ description: 'May /cancel a posted document.' })
  umCanCancel!: boolean;

  @ApiProperty({ description: 'May /amend a posted document.' })
  umCanAmend!: boolean;

  @ApiProperty({ description: 'May pass a WARN-level guard.' })
  umCanOverride!: boolean;

  @ApiProperty({ description: 'May re-tender a posted bill. Sales Entry only.' })
  umCanRetender!: boolean;

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

  @ApiPropertyOptional({
    nullable: true,
    example: 'Ravi',
    description: 'Name of the linked employee (resolved on the get endpoint)',
  })
  usrEmployeeName?: string | null;

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

  @ApiProperty({ description: 'A till PIN is set. The hash is never returned.' })
  usrPinSet!: boolean;

  @ApiPropertyOptional({ enum: UserType, enumName: 'UserType', nullable: true })
  usrType!: UserType | null;

  @ApiProperty()
  usrEditDate!: boolean;

  @ApiProperty()
  usrEditEntry!: boolean;

  @ApiProperty({ description: 'Screen label "Allow rate / discount change" (review step 6)' })
  usrEditRate!: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '12.50',
    description: 'Max discount % on a Sale Bill (each line and the bill discount); null = no limit',
  })
  usrMaxDiscPerc!: string | null;

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

/** POST /user-administration/reset-password — review step 6 (U8). */
export class UserAdminResetPasswordResultDto {
  @ApiProperty({ format: 'uuid' })
  usrId!: string;

  @ApiProperty()
  usrLoginName!: string;

  @ApiProperty({ example: true, description: 'Always true: the user changes it at the next login' })
  usrMustChangePassword!: true;

  @ApiProperty({ format: 'date-time' })
  usrPasswordChangedOn!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'k7Hq2mXa',
    description:
      'Only when generate: true — the new password, answered this ONCE (never stored, logged or ' +
      'audited; nobody can read it back). null when the administrator typed it.',
  })
  generatedPassword!: string | null;
}

/** POST /user-administration/unlock — review step 6. */
export class UserAdminUnlockResultDto {
  @ApiProperty({ format: 'uuid' })
  usrId!: string;

  @ApiProperty({ example: false })
  usrIsLocked!: false;

  @ApiProperty({ example: 0 })
  usrFailedLoginCount!: 0;

  @ApiProperty({ type: String, nullable: true, example: null })
  usrLockedOn!: null;

  @ApiProperty({ type: String, nullable: true, example: null })
  usrLockedBy!: null;

  @ApiProperty({
    description:
      'false = it was neither locked nor counting failed logins: nothing changed, no audit row',
  })
  changed!: boolean;
}

/** POST /user-administration/restore — review step 6 (U10). */
export class UserAdminRestoreResultDto {
  @ApiProperty({ format: 'uuid' })
  usrId!: string;

  @ApiProperty()
  usrLoginName!: string;

  @ApiProperty({ example: false })
  usrIsDeleted!: false;

  @ApiProperty({ example: false, description: 'A restored user always comes back INACTIVE' })
  usrIsActive!: false;

  @ApiProperty({
    example: 12,
    description:
      'How many menu rights rows came back: exactly the ones the delete removed (a row of a ' +
      'menu that is no longer active is left out)',
  })
  menuCount!: number;
}

export class UserAdminSuccessResetPasswordDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Password reset' })
  message!: string;

  @ApiProperty({ type: UserAdminResetPasswordResultDto })
  data!: UserAdminResetPasswordResultDto;
}

export class UserAdminSuccessUnlockDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'User unlocked' })
  message!: string;

  @ApiProperty({ type: UserAdminUnlockResultDto })
  data!: UserAdminUnlockResultDto;
}

export class UserAdminSuccessRestoreDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'User restored' })
  message!: string;

  @ApiProperty({ type: UserAdminRestoreResultDto })
  data!: UserAdminRestoreResultDto;
}
