import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmpty, IsNotEmpty } from 'class-validator';
import {
  NullableString,
  OptionalBoolean,
  OptionalUuid,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';

/**
 * Create-or-update, the house way: the presence of `almId` selects.
 *
 * The shape is deliberately narrow. `almCompanyId`, `almBranchId` and
 * `almSupplyNature` are RESERVED columns — the schema keeps the door open for
 * per-company overrides and for the GST roles that resolve differently on an
 * inter-state supply, and this API does not open it. Sending one is a 400
 * naming the field rather than a silently ignored value, so the day the
 * override IS built nothing already depends on a half-built one.
 */
export class SaveLedgerMapDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, the request re-points that existing mapping instead of adding one',
  })
  @OptionalUuid()
  almId?: string;

  @ApiProperty({
    maxLength: 30,
    example: 'DISCOUNT_ALLOWED',
    description: 'accounts.acc_ledger_role.alr_role — one of the codes /ledger-map/roles lists',
  })
  @UpperMaxString(30)
  @IsNotEmpty()
  role!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'The ledger the role posts to. Must be a live, global ledger of the type the role demands',
  })
  @RequiredUuid()
  ledgerId!: string;

  @ApiPropertyOptional({
    description: 'Defaults to true. False keeps the row but stops it resolving',
  })
  @OptionalBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  remarks?: string | null;

  // ── Reserved, and refused ─────────────────────────────────────────────────
  // Declared so the refusal names the field and says why. Left out of the DTO
  // entirely they would still be refused — the global pipe is whitelisting —
  // but with "property almCompanyId should not exist", which reads like a typo
  // rather than like a decision.
  @ApiHideProperty()
  @IsEmpty({
    message:
      'almCompanyId is not accepted — /ledger-map manages the shared mapping only, ' +
      'the one every company uses',
  })
  almCompanyId?: never;

  @ApiHideProperty()
  @IsEmpty({
    message:
      'almBranchId is not accepted — /ledger-map manages the shared mapping only, ' +
      'the one every branch uses',
  })
  almBranchId?: never;

  @ApiHideProperty()
  @IsEmpty({
    message:
      'almSupplyNature is not accepted — a mapping here answers for INTRA and INTER alike; ' +
      'a per-rate answer belongs on the tax rate, in inventory.tax_rate_ledger',
  })
  almSupplyNature?: never;
}

/** `DELETE /ledger-map/delete?almId=`. */
export class DeleteLedgerMapQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  almId!: string;
}
