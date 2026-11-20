import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerPayloadDto } from 'src/modules/sales/customer/dto/customer-response.dto';
import { PARTY_GST_TYPES } from 'src/common/party/party-gst-type';

const BALANCE_STATUSES = ['OUTSTANDING', 'OVER_LIMIT', 'ADVANCE', 'SETTLED'];

export class MobileSidedAmountDto {
  @ApiProperty({ example: '124500.00', description: 'Magnitude, two decimals, as text' })
  amount!: string;

  @ApiProperty({ enum: ['DR', 'CR'], description: 'DR = the party owes us' })
  side!: 'DR' | 'CR';
}

export class MobileCustomerListItemDto {
  @ApiProperty({ format: 'uuid' }) cusId!: string;
  @ApiProperty({ nullable: true, type: String }) cusName!: string | null;
  @ApiProperty({ nullable: true, type: String }) cusShort!: string | null;
  @ApiProperty({ nullable: true, type: String }) cusCode!: string | null;
  @ApiProperty({ nullable: true, type: String }) cusCity!: string | null;
  @ApiProperty({ nullable: true, type: String }) cusAreaName!: string | null;
  @ApiProperty({ nullable: true, type: String }) cusPhone1!: string | null;
  @ApiProperty({ nullable: true, type: String }) cusWhatsappNo!: string | null;
  @ApiProperty({ nullable: true, type: String }) cusGstNo!: string | null;
  @ApiProperty({ nullable: true, type: String, enum: PARTY_GST_TYPES }) cusGstType!: string | null;
  @ApiProperty() cusIsActive!: boolean;

  @ApiProperty({ example: '0.00', description: 'Credit amount limit, two decimals; 0.00 = none' })
  cusCreditAmtLimit!: string;

  @ApiProperty({
    type: MobileSidedAmountDto,
    nullable: true,
    description:
      'Closing today in the login company (this year opening set + posted legs, all branches). ' +
      'null when the login has no company or no financial year holds today.',
  })
  balance!: MobileSidedAmountDto | null;

  @ApiProperty({ enum: BALANCE_STATUSES, nullable: true })
  balanceStatus!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '12350.00',
    description:
      "What the customer's unpaid bills still owe today, two decimals, never negative: the Party " +
      'Outstanding report\'s "owed" (Receivable side, login company, all branches). Unlike the ' +
      'balance, credits the customer holds do not lower it. null when the balance is null.',
  })
  outstanding!: string | null;

  @ApiProperty({ nullable: true, type: Number, example: 3, description: 'Unpaid DR bills' })
  outstandingBills!: number | null;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date',
    description: 'Bill date of the oldest unpaid bill; null when none',
  })
  oldestBillDate!: string | null;
}

export class MobileCustomerCountsDto {
  @ApiProperty() all!: number;
  @ApiProperty() outstanding!: number;
  @ApiProperty() unregistered!: number;
  @ApiProperty() inactive!: number;
}

export class MobileCustomerListPayloadDto {
  @ApiProperty({ type: [MobileCustomerListItemDto] }) items!: MobileCustomerListItemDto[];
  @ApiProperty({
    type: MobileCustomerCountsDto,
    description: 'Chip counts: search applied, filter not',
  })
  counts!: MobileCustomerCountsDto;
  @ApiProperty({ description: 'Rows matching search and filter' }) total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() hasMore!: boolean;
  @ApiProperty({ nullable: true, type: String, format: 'date' }) balanceAsOn!: string | null;
  @ApiProperty({ nullable: true, type: String, example: '2026-2027' }) accYear!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description: 'The company the balances and outstanding are read in (the login company)',
  })
  companyId!: string | null;
}

export class MobileCustomerListSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileCustomerListPayloadDto }) data!: MobileCustomerListPayloadDto;
}

export class MobileCustomerDetailDto extends CustomerPayloadDto {
  @ApiProperty({ type: MobileSidedAmountDto, nullable: true })
  balance!: MobileSidedAmountDto | null;

  @ApiProperty({ enum: BALANCE_STATUSES, nullable: true })
  balanceStatus!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '12350.00',
    description:
      "What the customer's unpaid bills still owe today, two decimals, never negative: the Party " +
      'Outstanding report\'s "owed" (Receivable side, login company, all branches). Unlike the ' +
      'balance, credits the customer holds do not lower it. null when the balance is null.',
  })
  outstanding!: string | null;

  @ApiProperty({ nullable: true, type: Number, example: 3, description: 'Unpaid DR bills' })
  outstandingBills!: number | null;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date',
    description: 'Bill date of the oldest unpaid bill; null when none',
  })
  oldestBillDate!: string | null;
}

export class MobileCustomerDetailSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileCustomerDetailDto }) data!: MobileCustomerDetailDto;
}

class MobileOptionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}

class MobileAreaOptionDto extends MobileOptionDto {
  @ApiProperty({
    format: 'uuid',
    description:
      "area_master.arm_city_id (since 2026-11-19): the phone's offer engine matches CITY " +
      "scheme rows through the customer's beat",
  })
  cityId!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) cityName!: string | null;
}

class MobilePriceLevelOptionDto {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
}

class MobileStateOptionDto {
  @ApiProperty({ example: '33' }) code!: string;
  @ApiProperty({ example: 'Tamil Nadu' }) name!: string;
}

export class MobileCustomerFormOptionsDto {
  @ApiProperty({ type: [MobileAreaOptionDto], description: 'cusAreaId picker' })
  areas!: MobileAreaOptionDto[];
  @ApiProperty({ type: [MobileOptionDto], description: 'cusGroupId picker (Category)' })
  groups!: MobileOptionDto[];
  @ApiProperty({ type: [MobilePriceLevelOptionDto], description: 'cusPriceLevelId picker' })
  priceLevels!: MobilePriceLevelOptionDto[];
  @ApiProperty({ type: [MobileStateOptionDto], description: 'cusStateCode / cusStateName picker' })
  states!: MobileStateOptionDto[];
  @ApiProperty({ type: [String], enum: PARTY_GST_TYPES, description: 'cusGstType choices' })
  gstTypes!: string[];
}

export class MobileCustomerFormOptionsSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileCustomerFormOptionsDto }) data!: MobileCustomerFormOptionsDto;
}
