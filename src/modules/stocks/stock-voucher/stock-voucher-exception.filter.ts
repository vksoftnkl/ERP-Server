import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { StockExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { buildStockErrorResponse } from 'src/common/utils/module-service.utils';
import type { StockErrorDetail, StockErrorResponse } from './types/stock-voucher.types';
import {
  NEGATIVE_STOCK_MESSAGE_FRAGMENT,
  STOCK_ENGINE_SQLSTATE_STATUS,
} from './types/stock-voucher.types';

/** What a Prisma raw-query failure carries when a function RAISEd inside it. */
interface RawQueryErrorMeta {
  code?: unknown;
  message?: unknown;
}

/**
 * Translates the stock engine's deliberate SQLSTATEs into the HTTP answers of
 * §12 of the plan, then hands the result to the shared module filter.
 *
 * WHY THIS EXISTS AT ALL. `fn_svh_post`, `fn_svh_cancel`, `fn_slt_resolve` and
 * `fn_sml_apply` all report their refusals with a chosen SQLSTATE and a message
 * that already names the refno and the line number. None of that survives the
 * trip through Prisma untouched: a RAISE from inside a function arrives as a
 * PrismaClientKnownRequestError with **code `P2010`**, and P2010 is the code
 * for every one of them. Switching on `error.code` therefore collapses eight
 * distinct, actionable failures into one 500 that says "raw query failed".
 *
 * The real SQLSTATE is in `error.meta.code` and the engine's own text in
 * `error.meta.message`. Both are used verbatim — the wording in the SQL is the
 * wording the screen should show, and paraphrasing it in TypeScript is how the
 * message the user reads and the message in the server log drift apart.
 */
@Catch()
export class StockVoucherExceptionFilter extends StockExceptionFilter<
  StockErrorDetail,
  StockErrorResponse
> {
  constructor() {
    // Field prefixes reachable from a stock voucher request: the header (svh*),
    // its lines (svi*, reported by class-validator as `lines.0.sviX`) and the
    // camelCase payload keys the DTO actually uses (`toGodownId`, `accYear`).
    super(/\b((?:svh|svi)[A-Za-z0-9]+|accYear|toGodownId|deviceId|voucherType)\b/);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const translated = this.translateEngineError(exception);
    super.catch(translated ?? exception, host);
  }

  /**
   * Returns an HttpException carrying the engine's own message when the
   * exception is a raw-query failure with a SQLSTATE this module recognises,
   * and null for everything else — an unrecognised failure must keep falling
   * through to the 500 path, stack and all, rather than being dressed up as a
   * clean 4xx the client will retry for ever.
   */
  private translateEngineError(exception: unknown): HttpException | null {
    if (exception instanceof HttpException) {
      return null;
    }
    const meta = this.readMeta(exception);
    if (!meta) {
      return null;
    }
    const sqlState = typeof meta.code === 'string' ? meta.code : null;
    if (!sqlState) {
      return null;
    }
    const engineMessage =
      typeof meta.message === 'string' && meta.message.trim()
        ? meta.message.trim()
        : `The stock engine refused this document (SQLSTATE ${sqlState}).`;

    const status = this.resolveStatus(sqlState, engineMessage);
    if (status === null) {
      return null;
    }
    return new HttpException(
      buildStockErrorResponse<StockErrorDetail, StockErrorResponse>(engineMessage, [
        { field: 'request', message: engineMessage },
      ]),
      status,
    );
  }

  private resolveStatus(sqlState: string, engineMessage: string): number | null {
    // fn_sml_apply's negative-stock refusal comes through as a check_violation,
    // which the table maps to 422. It is not a malformed document though — it
    // is a correct refusal to let a cancellation drive a holding below zero,
    // and the caller's fix is an ADJUSTMENT, not an edit. 409 says "the state
    // of the world is wrong", which is the truth here.
    if (
      sqlState === '23514' &&
      engineMessage.toLowerCase().includes(NEGATIVE_STOCK_MESSAGE_FRAGMENT)
    ) {
      return 409;
    }
    return STOCK_ENGINE_SQLSTATE_STATUS[sqlState] ?? null;
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
