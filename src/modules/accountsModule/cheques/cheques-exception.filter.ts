import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type { ChequeErrorDetail, ChequeErrorResponse } from './types/cheque-api.types';

/**
 * Turns class-validator's flat message list back into field errors the screen
 * can put beside the box that is wrong.
 *
 * The pattern lists every field name this module reports on: the register's
 * `apd*`, the array paths the batch deposit uses (`cheques.0`,
 * `allocations.2.billId`), the nested replacement (`newCheque.amount`), and
 * the bare keys the single-cheque actions and the reads take.
 */
@Catch()
export class ChequesExceptionFilter extends AccountsExceptionFilter<
  ChequeErrorDetail,
  ChequeErrorResponse
> {
  constructor() {
    super(
      /\b(apd[A-Z][a-zA-Z0-9]*|abl[A-Z][a-zA-Z0-9]*|abj[A-Z][a-zA-Z0-9]*|cheques(\.\d+)?(\.[a-zA-Z]+)?|allocations(\.\d+)?(\.[a-zA-Z]+)?|newCheque(\.[a-zA-Z]+)?|bankLedgerId|depositDate|slipNo|clearDate|bankDate|bounceDate|bankCharge|partyCharge|reason|reasonText|action|remarks|status|from|to|partyId|search|limit|offset)\b/,
    );
  }
}
