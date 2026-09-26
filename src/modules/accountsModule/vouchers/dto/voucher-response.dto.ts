import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger envelopes. The payloads are documented as free objects: they are
 * typed in ../types/vouchers-api.types.ts and change with the derivation, and a
 * mirror class per shape here would be the second copy that drifts.
 */
export class VoucherErrorDetailDto {
  @ApiProperty() field!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ example: 'VCH_UNBALANCED' }) code!: string;
  @ApiProperty({ required: false }) line?: number;
}

export class VoucherErrorResponseDto {
  @ApiProperty({ example: false }) success!: false;
  @ApiProperty() message!: string;
  @ApiProperty({ type: [VoucherErrorDetailDto] }) errors!: VoucherErrorDetailDto[];
}

abstract class SuccessEnvelopeDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
}

export class VoucherTypesSuccessDto extends SuccessEnvelopeDto {
  @ApiProperty({ type: Object }) data!: unknown;
}
export class LedgerPickSuccessDto extends SuccessEnvelopeDto {
  @ApiProperty({ type: Object }) data!: unknown;
}
export class LedgerBalanceSuccessDto extends SuccessEnvelopeDto {
  @ApiProperty({ type: Object }) data!: unknown;
}
export class PartyFactsSuccessDto extends SuccessEnvelopeDto {
  @ApiProperty({ type: Object }) data!: unknown;
}
export class OpenBillsSuccessDto extends SuccessEnvelopeDto {
  @ApiProperty({ type: Object }) data!: unknown;
}
export class TaxRatesSuccessDto extends SuccessEnvelopeDto {
  @ApiProperty({ type: Object }) data!: unknown;
}
export class DraftSavedSuccessDto extends SuccessEnvelopeDto {
  @ApiProperty({ type: Object }) data!: unknown;
}
export class ValidateSuccessDto extends SuccessEnvelopeDto {
  @ApiProperty({ type: Object }) data!: unknown;
}
export class VoucherSuccessDto extends SuccessEnvelopeDto {
  @ApiProperty({ type: Object }) data!: unknown;
}
export class CancelSuccessDto extends SuccessEnvelopeDto {
  @ApiProperty({ type: Object }) data!: unknown;
}
export class DeleteSuccessDto extends SuccessEnvelopeDto {
  @ApiProperty({ type: Object }) data!: unknown;
}
export class AdjacentVoucherSuccessDto extends SuccessEnvelopeDto {
  @ApiProperty({ type: Object }) data!: unknown;
}
