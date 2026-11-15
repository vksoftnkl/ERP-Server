import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional } from 'class-validator';
import { OptionalTrimmedString, RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';

/**
 * GET /bills/voucher-type-choices (Voucher Types plan §7.1 / §5.3): the bill
 * header's Voucher Type pick.
 */
export class BillVoucherTypeChoicesQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  accYear!: string;

  @ApiPropertyOptional({
    description:
      'The device (fixed.device_master id, as sbDeviceId): its sales.bill_voucher_type is the default.',
  })
  @OptionalTrimmedString(100)
  deviceId?: string;

  @ApiPropertyOptional({
    enum: ['POS', 'WHOLESALE'],
    description:
      "Which counter Sales Bill (3) itself numbers from: the device's when POS and sales.pos_series_per_device. " +
      'Default WHOLESALE. A child type always uses the branch counter.',
  })
  @IsOptional()
  @IsIn(['POS', 'WHOLESALE'])
  billMode?: 'POS' | 'WHOLESALE';
}
