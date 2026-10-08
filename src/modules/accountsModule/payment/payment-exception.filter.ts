import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type { PaymentErrorDetail, PaymentErrorResponse } from './types/payment-api.types';

/**
 * Turns class-validator's flat message list back into field errors the screen
 * can put beside the box that is wrong — the receipt's filter with the
 * payment's two extra shapes (`cheque.chequeBookId`, `beneficiary.accountNo`).
 */
@Catch()
export class PaymentExceptionFilter extends AccountsExceptionFilter<
  PaymentErrorDetail,
  PaymentErrorResponse
> {
  constructor() {
    super(
      /\b(avh[A-Z][a-zA-Z0-9]*|td[A-Z][a-zA-Z0-9]*|abl[A-Z][a-zA-Z0-9]*|abj[A-Z][a-zA-Z0-9]*|allocations(\.\d+)?(\.[a-zA-Z]+)?|creditsApplied(\.\d+)?(\.[a-zA-Z]+)?|otherLines(\.\d+)?(\.[a-zA-Z]+)?|otherLineBills|tenders(\.\d+)?(\.[a-zA-Z.]+)?|cheque(\.[a-zA-Z]+)?|beneficiary(\.[a-zA-Z]+)?|onAccount|companyId|branchId|accYear|partyId|billId|billAccYear|onDate|reason|editRemark|baseRevision)\b/,
    );
  }
}
