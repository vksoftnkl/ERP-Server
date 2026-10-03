import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import {
  RequiredInteger,
  RequiredNumber,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import {
  PostReceiptAllocationDto,
  PostReceiptCreditDto,
  PostReceiptOtherLinePinDto,
} from '../../receipt/dto/post-receipt.dto';
import { SavePaymentDto } from './save-payment.dto';

/**
 * R20 — `POST /payments/amend`, editing a POSTED payment WHOLE. Exactly what
 * `/create` and `/post` take together, plus the keys, a `baseRevision` and an
 * `editRemark`. See `AmendReceiptDto` for why the full payload, why its own
 * route, and why `avhVoucherId` is initialised to `''` (TS2612 — `declare`
 * strips the decorators and `undefined` re-arms `@IsOptional`).
 */
export class AmendPaymentDto extends SavePaymentDto {
  @ApiProperty({
    format: 'uuid',
    required: true,
    description: 'The POSTED payment being restated. Its id, number and refno all survive.',
  })
  @RequiredUuid()
  avhVoucherId: string = '';

  @ApiProperty({ type: () => PostReceiptAllocationDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PostReceiptAllocationDto)
  allocations!: PostReceiptAllocationDto[];

  @ApiPropertyOptional({ type: () => PostReceiptCreditDto, isArray: true })
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

  @ApiProperty({ example: 0, minimum: 0 })
  @RequiredNumber(0)
  onAccount!: number;

  @ApiProperty({
    example: 0,
    minimum: 0,
    description:
      'The avhRevisionNo /payments/get returned. Refused with a 409 if it is no longer current.',
  })
  @RequiredInteger(0)
  baseRevision!: number;

  @ApiProperty({ maxLength: 250, example: 'paid to the wrong bank account' })
  @UpperMaxString(250)
  editRemark!: string;
}
