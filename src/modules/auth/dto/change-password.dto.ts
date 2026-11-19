import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * POST /auth/change-password (review list 11-19, task 1). The user is the one
 * the access token names, never a body key: a `usrId` (or any other key) is
 * refused by the house ValidationPipe as VALIDATION_WHITELIST.
 *
 * Both values are taken exactly as sent (no trim), as /auth/login takes the
 * password, so what is stored is what the user types at the next login. The
 * length rule (U7) and every refusal are the service's, with their own codes;
 * the DTO only insists on two strings.
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: "The caller's password today, checked the way /auth/login checks it.",
    example: 'OldPassword1',
  })
  @IsString()
  currentPassword!: string;

  @ApiProperty({
    description:
      'The new password: at least 4 characters (leading and trailing spaces not counted), ' +
      'no other rule (U7). Must differ from the current one.',
    example: 'NewPassword1',
  })
  @IsString()
  newPassword!: string;
}

export class ChangePasswordResultDto {
  @ApiProperty({ format: 'uuid', description: 'The signed-in user whose password changed' })
  usrId!: string;

  @ApiProperty({ format: 'date-time', description: 'When the new password was stored (UTC ISO)' })
  usrPasswordChangedOn!: string;

  @ApiProperty({ example: false, description: 'Always false after a change' })
  usrMustChangePassword!: boolean;
}

export class ChangePasswordResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Password changed' })
  message!: string;

  @ApiProperty({ type: ChangePasswordResultDto })
  data!: ChangePasswordResultDto;
}
