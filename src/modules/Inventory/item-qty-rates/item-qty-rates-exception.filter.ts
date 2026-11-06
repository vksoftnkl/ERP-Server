import { ArgumentsHost, BadRequestException, Catch, HttpException } from '@nestjs/common';
import { frameworkValidationCode } from 'src/common/validation/house-validation';
import { SellingPriceBulkExceptionFilter } from '../../stocks/selling-price-bulk/selling-price-bulk-exception.filter';

/**
 * The paths a save-with-rates / get-with-rates validation message can name
 * (review fix C-e): a slab's `slabs.<i>.<field>`, a card row's
 * `rates.rows.<i>[.<field>…]`, `deleteSlabIds.<i>`, a bare slab column
 * (`iqp_…`), then /stock/price-bulk's own fields. First match wins, so the
 * longest path is tried first.
 */
export const QTY_RATES_FIELD_PATTERN =
  /\b(slabs\.\d+\.[A-Za-z0-9_]+|rates\.rows\.\d+(?:\.[A-Za-z0-9_]+)*|deleteSlabIds\.\d+|iqp_[A-Za-z0-9_]+|ipm[A-Za-z0-9_]+|scope|confirmed|bucketId|uomId|itemId|priceScope|companyId|branchId|slabs|rates|deleteSlabIds)\b/;

/** The field a validation sentence names, `request` when it names none of ours. */
export function qtyRatesFieldOf(message: string): string {
  return QTY_RATES_FIELD_PATTERN.exec(message)?.[1] ?? 'request';
}

/**
 * Qty-wise Prices + card rate (menu 244). The card rows are
 * inventory.item_price_master writes, so their constraint SQLSTATEs
 * (ex_ipm_overlap, ck_ipm_*) are worded by Change Selling Price's filter, which
 * this extends. The slab writes translate their own (uq_iqp_slab → 409
 * ITEM_QTY_PRICE_DUPLICATE, a foreign key → 400 _REFERENCE_NOT_FOUND) inside
 * ItemsQtyPriceMasterService.save, before they reach a filter; every refusal
 * this module throws itself is already the house body. A numeric overflow is
 * the house 422 VALUE_TOO_LARGE.
 *
 * What it adds (C-e): a 400 that is NOT the house body — Nest's `{ message:
 * [...] }` list, which the house ValidationPipe never sends but a pipe or an
 * e2e app without it does — is filed under the path its sentence names, a slab
 * as `slabs.<i>.<field>`. Change Selling Price's pattern knows no iqp_ field
 * and would file it under `request`.
 */
@Catch()
export class ItemQtyRatesExceptionFilter extends SellingPriceBulkExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    super.catch(this.houseValidation(exception) ?? exception, host);
  }

  private houseValidation(exception: unknown): HttpException | null {
    if (!(exception instanceof HttpException) || exception.getStatus() !== 400) {
      return null;
    }
    const body = exception.getResponse();
    if (typeof body !== 'object' || body === null) {
      return null;
    }
    const { errors, message } = body as { errors?: unknown; message?: unknown };
    if (Array.isArray(errors)) {
      // Already the house body: its own fields stand.
      return null;
    }
    const messages = Array.isArray(message)
      ? message.filter((entry): entry is string => typeof entry === 'string')
      : typeof message === 'string'
        ? [message]
        : [];
    if (!messages.length) {
      return null;
    }
    return new BadRequestException({
      success: false,
      message: 'Validation failed',
      errors: messages.map((entry) => ({
        field: qtyRatesFieldOf(entry),
        code: frameworkValidationCode(entry),
        message: entry,
      })),
    });
  }
}
