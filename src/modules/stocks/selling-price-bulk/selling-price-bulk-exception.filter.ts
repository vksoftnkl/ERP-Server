import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { StockExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { buildStockErrorResponse } from 'src/common/utils/module-service.utils';
import { STOCK_ENGINE_SQLSTATE_STATUS } from '../stock-voucher/types/stock-voucher.types';
import type { StockErrorDetail, StockErrorResponse } from './types/selling-price-bulk.types';

/** What a Prisma raw-query failure carries when a function RAISEd inside it. */
interface RawQueryErrorMeta {
  code?: unknown;
  message?: unknown;
}

/**
 * A sentence per SQLSTATE, for the constraints §9 names.
 *
 * The database is the LAST line, not a fallback: a save the screen failed to
 * validate aborts whole, and that is the design. What it must not do is abort
 * with the database's own wording — "conflicting key value violates exclusion
 * constraint ex_smp_overlap" tells a shopkeeper nothing at all, and this is
 * the only place in the chain that knows the constraint's name means "another
 * price already covers this bucket for this period".
 *
 * The engine's own message is still appended wherever it says something the
 * constraint name does not.
 */
const CONSTRAINT_MESSAGES: Readonly<Record<string, string>> = {
  ex_smp_overlap:
    'Another price already covers this bucket at this scope for an overlapping period. ' +
    'Reload the row and try again — someone else may have priced it a moment ago.',
  ck_smp_not_above_mrp: 'A selling price cannot be above the MRP of the bucket it prices.',
  ck_smp_prices_nonneg: 'A selling price cannot be negative.',
  ck_smp_identity:
    'A bucket must carry an MRP or a sale price. An item that tracks neither is priced on its ' +
    'headline row, not on a bucket.',
};

/**
 * §9 — the SQLSTATEs of `stock.stock_mrp_price`, translated.
 *
 * THE SAME TRAP as the voucher filter, and the reason this is not a switch on
 * `error.code`: a RAISE from inside a PL/pgSQL function does not reach Prisma
 * as its own SQLSTATE. It arrives as a PrismaClientKnownRequestError whose
 * `code` is **P2010** for every one of them, with the real SQLSTATE in
 * `error.meta.code` and the text in `error.meta.message`. A filter that reads
 * `error.code` answers every distinct failure with one useless message.
 *
 * The map itself is the SHARED one in stock-voucher.types.ts, including the
 * `23P01` this screen was the first to need. Keeping a private copy here would
 * mean the transfer screens meet `ex_smp_overlap`'s cousin and get a 500.
 */
@Catch()
export class SellingPriceBulkExceptionFilter extends StockExceptionFilter<
  StockErrorDetail,
  StockErrorResponse
> {
  constructor() {
    // Field prefixes reachable from a price request: the smp columns, the
    // fan-out's ipm columns, and the camelCase payload keys the DTOs use.
    super(/\b((?:smp|ipm)[A-Za-z0-9_]+|scope|confirmed|bucketId|uomId|itemId|priceScope)\b/);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    super.catch(this.translateEngineError(exception) ?? exception, host);
  }

  private translateEngineError(exception: unknown): HttpException | null {
    if (exception instanceof HttpException) {
      return null;
    }
    const meta = this.readMeta(exception);
    const sqlState = typeof meta?.code === 'string' ? meta.code : null;
    if (!sqlState) {
      return null;
    }
    const status = STOCK_ENGINE_SQLSTATE_STATUS[sqlState];
    if (status === undefined) {
      // Unrecognised failures keep falling through to the 500 path, stack and
      // all. Dressing one up as a clean 4xx is how a client is taught to retry
      // for ever against a bug it cannot fix.
      return null;
    }
    const engineMessage =
      typeof meta?.message === 'string' && meta.message.trim()
        ? meta.message.trim()
        : `The database refused this price (SQLSTATE ${sqlState}).`;

    const named = Object.keys(CONSTRAINT_MESSAGES).find((constraint) =>
      engineMessage.includes(constraint),
    );
    const message = named ? CONSTRAINT_MESSAGES[named] : engineMessage;

    return new HttpException(
      buildStockErrorResponse<StockErrorDetail, StockErrorResponse>(message, [
        { field: named ?? 'request', message: named ? `${message} (${engineMessage})` : message },
      ]),
      status,
    );
  }

  private readMeta(exception: unknown): RawQueryErrorMeta | null {
    if (typeof exception !== 'object' || exception === null || !('meta' in exception)) {
      return null;
    }
    const { meta } = exception as { meta?: unknown };
    if (typeof meta !== 'object' || meta === null) {
      return null;
    }
    return meta as RawQueryErrorMeta;
  }
}
