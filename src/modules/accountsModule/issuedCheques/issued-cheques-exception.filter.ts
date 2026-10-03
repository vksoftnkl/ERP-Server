import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type {
  VoucherApiErrorDetail,
  VoucherErrorResponse,
} from '../vouchers/types/vouchers-api.types';

/**
 * notes (55): the Issued Cheques and cheque-book routes answer in the Voucher
 * Register's envelope (`{field, message, code}`) — they are its instruments,
 * and they refuse with its VCH_* codes — and map validation messages onto
 * their own fields.
 */
@Catch()
export class IssuedChequesExceptionFilter extends AccountsExceptionFilter<
  VoucherApiErrorDetail,
  VoucherErrorResponse
> {
  constructor() {
    super(
      /\b(apdId|apdAccYear|companyId|branchId|chequeBookId|bankLedgerId|bookNo|leafFrom|leafTo|leafWidth|format|remarks|reason|date|instrumentDate|favouring|acPayee|charges|userId|lines(\.\d+)?(\.[a-zA-Z]+)?(\.[a-zA-Z]+)?|allocations(\.\d+)?(\.[a-zA-Z]+)?|header(\.[a-zA-Z]+)?)\b/,
    );
  }
}
