import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppUpdateInfoDto } from '../../app-version/dto/check-update.dto';
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
  @ApiProperty({
    example: false,
    description:
      'Review step 6 (U8): true = an administrator reset this password. The session may call ' +
      'POST /auth/change-password only (every other guarded route answers 403 ' +
      'AUTH_PASSWORD_CHANGE_REQUIRED) until the user changes it. Open Change Password before ' +
      'the main window. On a refresh: still true while the password is not changed.',
  })
  mustChangePassword!: boolean;
  @ApiProperty({
    example: false,
    description:
      'Review step 6: the user\'s "Allow rate / discount change" (user_master.usr_edit_rate) at ' +
      'login / refresh. false = lock the line Rate, the discounts and the price level for this ' +
      'user (the server refuses them on save anyway: SALES_RATE_CHANGE_NOT_ALLOWED, ' +
      'SALES_DISC_NOT_ALLOWED, SALES_PRICE_LEVEL_NOT_ALLOWED).',
  })
  usrEditRate!: boolean;
  @ApiProperty({
    type: String,
    nullable: true,
    example: '7.50',
    description:
      "Review step 6: the user's max discount % on a Sale Bill (user_master.usr_max_disc_perc) " +
      'as a decimal string, at login / refresh. null = no limit. Over it the save answers ' +
      'SALES_LINE_DISC_OVER_USER_MAX / SALES_BILL_DISC_OVER_USER_MAX.',
  })
  usrMaxDiscPerc!: string | null;
  @ApiPropertyOptional({
    type: AppUpdateInfoDto,
    description:
      'Login only, and only when the request sent X-App-Platform + X-App-Build: whether a ' +
      'newer build is available. A notice only; the key is absent for every other client.',
  })
  appUpdate?: AppUpdateInfoDto;
}
