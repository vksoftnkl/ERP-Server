import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type { VoucherApiErrorDetail, VoucherErrorResponse } from './types/vouchers-api.types';

/**
 * Turns class-validator's flat message list back into field errors the screen
 * can put beside the box that is wrong. The pattern lists every field this
 * module's DTOs carry, including the nested paths (`lines.2.amount`,
 * `allocations.0.billId`, `header.date`).
 */
@Catch()
export class VouchersExceptionFilter extends AccountsExceptionFilter<
  VoucherApiErrorDetail,
  VoucherErrorResponse
> {
  constructor() {
    super(
      /\b(header(\.[a-zA-Z]+)?|lines(\.\d+)?(\.[a-zA-Z]+)?(\.[a-zA-Z]+)?|allocations(\.\d+)?(\.[a-zA-Z]+)?|newBill(\.[a-zA-Z]+)?|overrides(\.\d+)?|companyId|branchId|accYear|voucherId|typeCode|menuId|side|q|limit|ledgerId|asOn|partyId|reason|includeInactive|userId|document)\b/,
    );
  }
}
