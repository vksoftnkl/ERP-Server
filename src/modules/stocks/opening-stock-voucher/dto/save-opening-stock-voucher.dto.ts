import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { SaveStockVoucherItemDto } from '../../stock-voucher/dto/save-stock-voucher-item.dto';
import { SaveStockVoucherHeaderDto } from '../../stock-voucher/dto/save-stock-voucher.dto';

/**
 * THE VOUCHER TYPE IS NEVER TAKEN FROM THE PAYLOAD.
 *
 * The controller pins 'OPENING'. This property exists only so that a payload
 * carrying something else is REJECTED with a field-level message rather than
 * silently ignored — a client that thinks it is raising a TRANSFER_OUT through
 * this route needs to be told that it is not. Honouring it would post a
 * transfer with no stock_transit row and leave the receiving branch waiting for
 * a document that never arrives.
 *
 * WHY `toGodownId` IS NOT RE-DECLARED REQUIRED HERE, even though an OPENING
 * cannot be posted without one. class-validator merges a subclass's metadata
 * with the base's, and the base carries @IsOptional() on that property —
 * @IsOptional() whitelists undefined for EVERY validator on the property, so a
 * @RequiredUuid() added here would never fire and the DTO would advertise a
 * guarantee it does not make. The check therefore lives where it can actually
 * refuse: StockVoucherService.assertPayloadRules, driven off
 * StockVoucherTypeRules.requiresToGodown, which answers 422 alongside every
 * other per-line problem instead of one field error at a time.
 */
export class SaveOpeningStockVoucherHeaderDto extends SaveStockVoucherHeaderDto {
  @ApiPropertyOptional({
    enum: ['OPENING'],
    description: 'Optional, and only ever "OPENING". The route decides the type.',
  })
  @IsOptional()
  @IsIn(['OPENING'], {
    message:
      'voucherType must be OPENING on this route. Other document types have their own routes because they write tables this one does not.',
  })
  voucherType?: 'OPENING';
}

/**
 * Declared standalone rather than extending SaveStockVoucherDto: the only
 * difference is which class `header` is transformed into, and re-declaring an
 * inherited field to change its @Type() is a TS2612 that has to be silenced
 * with a fake initializer. Two properties are not worth that.
 *
 * Structurally assignable to SaveStockVoucherDto, which is what
 * StockVoucherService.save takes.
 */
export class SaveOpeningStockVoucherDto {
  @ApiProperty({ type: SaveOpeningStockVoucherHeaderDto })
  @ValidateNested()
  @Type(() => SaveOpeningStockVoucherHeaderDto)
  header!: SaveOpeningStockVoucherHeaderDto;

  @ApiProperty({
    type: SaveStockVoucherItemDto,
    isArray: true,
    description:
      'A full replace on update. Merging by row number over a grid the user can insert into is where line numbers drift, and a DRAFT has no history worth preserving.',
  })
  @IsArray()
  @ArrayMaxSize(2000, { message: 'lines may not exceed 2000 rows in one document' })
  @ValidateNested({ each: true })
  @Type(() => SaveStockVoucherItemDto)
  lines!: SaveStockVoucherItemDto[];
}
