import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Purchase refusals, in the house shape `{ success, message, errors[] }` so the
 * global filter passes them through untouched and the client reads
 * `errors[0].code` (notes 119 / 120).
 */
export const PUR = {
  NOT_FOUND: 'PUR_NOT_FOUND',
  SUPPLIER_NOT_FOUND: 'PUR_SUPPLIER_NOT_FOUND',
  ITEM_NOT_FOUND: 'PUR_ITEM_NOT_FOUND',
  UNIT_NOT_FOUND: 'PUR_UNIT_NOT_FOUND',
  CHARGE_NOT_FOUND: 'PUR_CHARGE_NOT_FOUND',
  NO_LINES: 'PUR_NO_LINES',
  QTY_INVALID: 'PUR_QTY_INVALID',
  ALLOC_SUM_MISMATCH: 'PUR_ALLOC_SUM_MISMATCH',
  DUPLICATE_SUPPLIER_INVOICE: 'PUR_DUPLICATE_SUPPLIER_INVOICE',
  INVOICE_AMOUNT_MISMATCH: 'PUR_INVOICE_AMOUNT_MISMATCH',
  NOT_DRAFT: 'PUR_NOT_DRAFT',
  NOT_POSTED: 'PUR_NOT_POSTED',
  EDIT_LOCKED_PAID: 'PUR_EDIT_LOCKED_PAID',
  OFFBILL_NO_PAYEE: 'PUR_OFFBILL_NO_PAYEE',
  OFFBILL_GTA_REFUSED: 'PUR_OFFBILL_GTA_REFUSED',
  MODE_NOT_SUPPORTED: 'PUR_MODE_NOT_SUPPORTED',
  VOUCHER_TYPE_MISSING: 'PUR_VOUCHER_TYPE_MISSING',
  STOCK_QTY_MISMATCH: 'PUR_STOCK_QTY_MISMATCH',
  SERIAL_COUNT: 'PUR_SERIAL_COUNT',
  GRN_MISMATCH: 'PUR_GRN_MISMATCH',
  GRN_LINE_BILLED: 'PUR_GRN_LINE_BILLED',
  GRN_NOT_BUILT: 'PUR_GRN_NOT_BUILT',
  GRN_OFFBILL_REFUSED: 'PUR_GRN_OFFBILL_REFUSED',
} as const;

export interface PurErrorDetail {
  field: string;
  code: string;
  message: string;
}

function body(message: string, errors: PurErrorDetail[]) {
  return { success: false, message, errors };
}

export function purRefuse(message: string, code: string, field = 'request', status = HttpStatus.UNPROCESSABLE_ENTITY): never {
  throw new HttpException(body(message, [{ field, code, message }]), status);
}

export function purRefuseMany(message: string, errors: PurErrorDetail[], status = HttpStatus.UNPROCESSABLE_ENTITY): never {
  throw new HttpException(body(message, errors), status);
}

export function purNotFound(message: string, code: string = PUR.NOT_FOUND, field = 'id'): never {
  throw new HttpException(body(message, [{ field, code, message }]), HttpStatus.NOT_FOUND);
}

export function purConflict(message: string, code: string, field = 'request'): never {
  throw new HttpException(body(message, [{ field, code, message }]), HttpStatus.CONFLICT);
}
