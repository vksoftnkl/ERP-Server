import { Catch } from '@nestjs/common';
import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
} from 'src/common/types/module-api.types';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';

/**
 * The house error body for /tender-settlement/*: class-validator's flat list
 * turned back into field errors, and a refusal's `code` (SETTLEMENT_*,
 * NONCASH_*) passed through where the client reads it.
 */
@Catch()
export class TenderSettlementExceptionFilter extends AccountsExceptionFilter<
  ModuleApiErrorDetail & { code?: string },
  ModuleApiErrorResponse<ModuleApiErrorDetail & { code?: string }>
> {
  constructor() {
    super(
      /\b(companyId|branchId|accYear|asiId|aslId|tdId|tdAccYear|tenderId|payoutRef|payoutDate|notes|reason|resolution|reasonId|incomeLedgerId|recoveryLedgerId|treatment|format(\.[a-zA-Z]+)*|file)\b/,
    );
  }
}
