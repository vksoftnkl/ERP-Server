import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { RequiredNumber, UpperMaxString } from 'src/common/dto/dtoDecorators';
import {
  PostReceiptAllocationDto,
  PostReceiptCreditDto,
  PostReceiptOtherLinePinDto,
  ReceiptKeysDto,
} from '../../receipt/dto/post-receipt.dto';

/**
 * §4.4 — `POST /payments/post`. The receipt's post body, key for key: the
 * allocation, credit and pin rows ARE the receipt's DTO classes, so a rule
 * added to one reaches the payment with no edit here.
 */

/** The four keys every route that acts on an existing payment takes. */
export class PaymentKeysDto extends ReceiptKeysDto {}

export {
  PostReceiptAllocationDto as PostPaymentAllocationDto,
  PostReceiptCreditDto as PostPaymentCreditDto,
  PostReceiptOtherLinePinDto as PostPaymentOtherLinePinDto,
};

export class PostPaymentDto extends PaymentKeysDto {
  @ApiProperty({
    type: () => PostReceiptAllocationDto,
    isArray: true,
    description:
      'IN ORDER — the order money fills the bills, which is the order /payments/open-items ' +
      'returned them in. On a TDS-applicable party the amounts are GROSS: the deduction settles ' +
      'its share of each bill without leaving as money.',
  })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PostReceiptAllocationDto)
  allocations!: PostReceiptAllocationDto[];

  @ApiPropertyOptional({
    type: () => PostReceiptCreditDto,
    isArray: true,
    description: 'The debits we hold being applied — an advance paid, a debit note.',
  })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PostReceiptCreditDto)
  creditsApplied: PostReceiptCreditDto[] = [];

  @ApiPropertyOptional({ type: () => PostReceiptOtherLinePinDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PostReceiptOtherLinePinDto)
  otherLineBills: PostReceiptOtherLinePinDto[] = [];

  @ApiProperty({
    example: 0,
    minimum: 0,
    description:
      'What is left over and will be held as an ADVANCE (DR) bill on the party. Recomputed ' +
      'server-side and refused if it disagrees.',
  })
  @RequiredNumber(0)
  onAccount!: number;
}

export class CancelPaymentDto extends PaymentKeysDto {
  @ApiProperty({
    maxLength: 250,
    description: 'Why. ck_avh_cancel refuses a CANCELLED voucher without one.',
  })
  @UpperMaxString(250)
  reason!: string;
}

export class GetPaymentQueryDto extends PaymentKeysDto {}

export class DeletePaymentDto extends PaymentKeysDto {}
