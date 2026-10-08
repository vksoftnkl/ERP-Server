import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import {
  OptionalTrimmedString,
  RequiredUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { ChequeRefDto } from './cheque-keys.dto';

/**
 * §4.2 — `POST /cheques/deposit`.
 *
 * A BATCH, because a deposit slip is a batch: one bank, one date, one slip
 * number, many cheques. That is the piece of paper the operator is filling in,
 * and the payload is shaped like it.
 *
 * All or nothing. A slip that half-committed would print lines for cheques the
 * register does not think were deposited, and the bank would hold paper this
 * system says is still in the drawer.
 */
export class DepositChequesDto {
  @ApiProperty({
    type: () => ChequeRefDto,
    isArray: true,
    description: 'The cheques on this slip. Every one must be HELD.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ChequeRefDto)
  cheques!: ChequeRefDto[];

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  apdCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  apdBranchId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'A live BANK ledger of this company. Overwrites apd_bank_ledger_id: the bank a cheque ' +
      'actually went into may not be the one the receipt guessed when it was taken.',
  })
  @RequiredUuid()
  bankLedgerId!: string;

  @ApiProperty({
    example: '2026-09-15',
    description:
      "On or after every cheque's own instrument date, and not in the future. Banking a cheque " +
      'before the day written on it is how one comes back marked "post-dated presented early".',
  })
  @UpperMaxString(10)
  depositDate!: string;

  @ApiProperty({
    maxLength: 50,
    example: 'D-121',
    description: "The bank's own slip number. Also the key /cheques/deposit-slip prints from.",
  })
  @TrimmedString(50)
  slipNo!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @OptionalTrimmedString(500)
  remarks?: string | null;
}
