import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { OptionalInteger, OptionalTrimmedString, RequiredUuid } from 'src/common/dto/dtoDecorators';
import { SaveCustomerDto } from 'src/modules/sales/customer/dto/save-customer.dto';
import {
  MOBILE_CUSTOMER_FILTERS,
  type MobileCustomerFilter,
} from '../types/mobile-customer-api.types';

export const MOBILE_CUSTOMER_DEFAULT_PAGE_SIZE = 50;
export const MOBILE_CUSTOMER_MAX_PAGE_SIZE = 200;

/** GET /mobile/customers/list */
export class ListMobileCustomersQueryDto {
  @ApiPropertyOptional({
    maxLength: 100,
    description:
      'Matches name, short name, code, city, GSTIN and the phone / WhatsApp numbers (any case). ' +
      'A number typed with spaces ("98431 23456") still matches.',
  })
  @OptionalTrimmedString(100)
  search?: string;

  @ApiPropertyOptional({ enum: MOBILE_CUSTOMER_FILTERS, default: 'ALL' })
  @IsOptional()
  @IsIn(MOBILE_CUSTOMER_FILTERS)
  filter?: MobileCustomerFilter;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MOBILE_CUSTOMER_MAX_PAGE_SIZE,
    default: MOBILE_CUSTOMER_DEFAULT_PAGE_SIZE,
  })
  @OptionalInteger(1, MOBILE_CUSTOMER_MAX_PAGE_SIZE)
  pageSize?: number;
}

/**
 * POST /mobile/customers/create: the desktop save payload without cusId, so a
 * create can never turn into an update (the house pipe 400s an unknown key,
 * VALIDATION_WHITELIST). cusLinkLedId stays: a supplier's ledger can still be
 * made a customer from the phone.
 */
export class CreateMobileCustomerDto extends OmitType(SaveCustomerDto, ['cusId'] as const) {}

/**
 * PUT /mobile/customers/update: the desktop save payload with cusId required.
 * cusLinkLedId is create-only, so it is not accepted here.
 */
export class UpdateMobileCustomerDto extends OmitType(SaveCustomerDto, [
  'cusId',
  'cusLinkLedId',
] as const) {
  @ApiProperty({ format: 'uuid', description: 'The customer to update' })
  @RequiredUuid()
  cusId!: string;
}
