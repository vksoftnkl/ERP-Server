import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableStringStrict,
  OptionalTrimmedString,
  RequiredNumber,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
/// One credit the customer already holds, set off against this bill.
///
/// Two fields carry the contract — which credit, and how much of it. Everything
/// else that reaches acc_bill_adjustment is derived server-side from the
/// credit's own acc_bill_balance row, which is what stops a client that
/// mislabels an advance as a credit note from posting one.
///
/// Header context (company, branch, accYear, party, bill date, user, session)
/// is NOT repeated here: it rides on the bill this array is nested in.
export class SaveBillAdjustmentDto {
  @ApiProperty({
    description:
      'accounts.acc_bill_balance.abl_id of the credit being adjusted, taken straight from ' +
      'GET /transactions/party-balance. Must be an open CR credit belonging to this bill’s customer.',
  })
  @RequiredUuid()
  againstBillId!: string;
  @ApiProperty({
    minLength: 9,
    maxLength: 9,
    description:
      'The credit’s OWN accounting year (its billAccYear from the same list) — not this bill’s. ' +
      'acc_bill_balance is partitioned by year and keyed on (abl_id, abl_acc_year), so the pair is ' +
      'what the foreign key needs; ck_abj_against_bill_pair rejects one without the other.',
  })
  @TrimmedString(9)
  againstBillAccYear!: string;
  @ApiProperty({
    minimum: 0.01,
    description:
      'How much of the credit this bill takes off it. Must be positive and no more than the ' +
      'credit’s pendingAmount at the moment of saving — which the server re-reads under a row ' +
      'lock, because another counter may have spent it since the panel was fetched.',
  })
  @RequiredNumber(0.01)
  amount!: number;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  remarks?: string | null;
  // The three below are echoes of what the open-credits list said, kept so a
  // stored payload can be reconciled against acc_bill_adjustment without a
  // join. They are ACCEPTED AND IGNORED: the server derives all three from the
  // credit's own abl_bill_type (see deriveRouting in bill-adjustment.helper).
  //
  // Declared rather than dropped because the global ValidationPipe runs with
  // forbidNonWhitelisted, so an undeclared property is a 400 — and the client
  // sends all three.
  @ApiPropertyOptional({
    maxLength: 20,
    description: 'Echo of the credit’s billType. Ignored — the server reads it off the credit.',
  })
  @OptionalTrimmedString(20)
  billType?: string;
  @ApiPropertyOptional({
    maxLength: 20,
    description: 'Echo of the derived adjType. Ignored — the server derives it.',
  })
  @OptionalTrimmedString(20)
  adjType?: string;
  @ApiPropertyOptional({
    maxLength: 20,
    description: 'Echo of the derived settlementMode. Ignored — the server derives it.',
  })
  @OptionalTrimmedString(20)
  settlementMode?: string;
}
