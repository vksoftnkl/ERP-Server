import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { numericOverflowOf } from 'src/common/utils/module-shared.utils';
import { SellingPriceBulkExceptionFilter } from '../selling-price-bulk/selling-price-bulk-exception.filter';
import { COST_BULK } from './types/cost-price-bulk.types';

/** The house code a numeric overflow goes out with (ModuleExceptionFilter's own). */
export const VALUE_TOO_LARGE = 'VALUE_TOO_LARGE';

/**
 * Change Selling Price's filter (the same table, the same constraints worded
 * the same way), plus the BACKSTOP for a figure a numeric column cannot hold
 * (SQLSTATE 22003). planRow refuses the usual case first — a markup over
 * numeric(9,3)'s 999,999.999 from a mistyped tiny cost, COST_BULK_COST_TOO_LOW
 * — so what reaches here is a price, cost or MRP past numeric(18,6), or a
 * markup the pre-check missed. Either way a 422 the screen can word, never a
 * 500. An ORM error names the column's precision; a raw one does not, and
 * then the code is the house VALUE_TOO_LARGE.
 */
@Catch()
export class CostPriceBulkExceptionFilter extends SellingPriceBulkExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    super.catch(overflowRefusal(exception) ?? exception, host);
  }
}

/** A numeric overflow as the module's 422, or null for anything else. */
export function overflowRefusal(exception: unknown): HttpException | null {
  if (exception instanceof HttpException) {
    return null;
  }
  const detail = numericOverflowOf(exception);
  if (detail === null) {
    return null;
  }
  const markup = /precision 9, scale 3/.test(detail);
  const message = markup
    ? 'A new cost is so low that the profit on its prices cannot be stored. Check the New Cost.'
    : 'A price, cost or MRP is too large to save. Check the figures you typed.';
  return new HttpException(
    {
      success: false,
      message,
      errors: [
        {
          field: 'rows',
          code: markup ? COST_BULK.COST_TOO_LOW : VALUE_TOO_LARGE,
          message: `${message} (${detail})`,
        },
      ],
    },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}
