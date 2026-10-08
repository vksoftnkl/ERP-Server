import { Catch } from '@nestjs/common';
import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
} from 'src/common/types/module-api.types';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';

/**
 * The house error body for /expenses/*: class-validator's flat list turned back
 * into field errors (`lines.2.amount`, `tenders.0.tdAmount`, `gstBill.invoiceNo`),
 * and a refusal's `code` (EXPENSE_*, TILL_*) passed through where the client reads it.
 */
@Catch()
export class ExpenseExceptionFilter extends AccountsExceptionFilter<
  ModuleApiErrorDetail & { code?: string },
  ModuleApiErrorResponse<ModuleApiErrorDetail & { code?: string }>
> {
  constructor() {
    super(
      /\b(lines(\.\d+)?(\.[a-zA-Z]+)?|tenders(\.\d+)?(\.[a-zA-Z]+)?|gstBill(\.[a-zA-Z]+)?|td[A-Z][a-zA-Z0-9]*|companyId|branchId|tenantId|accYear|voucherId|voucherDate|partyId|usrRefno|remarks|reasonId|sessionId|reason|search)\b/,
    );
  }
}
