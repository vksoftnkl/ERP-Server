import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type { ReceiptErrorDetail, ReceiptErrorResponse } from './types/receipt-api.types';

/**
 * Turns class-validator's flat message list back into field errors the screen
 * can put beside the box that is wrong.
 *
 * The pattern lists every field name this module reports on: the header's
 * `avh*`, the tender rows' `td*`, the bill rows' `abl*`, the array paths the
 * post uses (`allocations.0.amount`, `creditsApplied.1.billId`,
 * `otherLines.2.role`), and the few bare scope keys the reads take.
 */
@Catch()
export class ReceiptExceptionFilter extends AccountsExceptionFilter<
  ReceiptErrorDetail,
  ReceiptErrorResponse
> {
  constructor() {
    super(
      /\b(avh[A-Z][a-zA-Z0-9]*|td[A-Z][a-zA-Z0-9]*|abl[A-Z][a-zA-Z0-9]*|abj[A-Z][a-zA-Z0-9]*|allocations(\.\d+)?(\.[a-zA-Z]+)?|creditsApplied(\.\d+)?(\.[a-zA-Z]+)?|otherLines(\.\d+)?(\.[a-zA-Z]+)?|otherLineBills|tenders(\.\d+)?(\.[a-zA-Z]+)?|onAccount|companyId|branchId|accYear|partyId|customerId|billId|billAccYear|onDate|reason|editRemark|asOf)\b/,
    );
  }
}
