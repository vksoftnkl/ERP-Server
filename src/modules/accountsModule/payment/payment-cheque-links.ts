/**
 * "What belongs to this payment?" — the receipt's two answers, unchanged.
 *
 * `receiptChequeFilter` finds a document's register rows by the tender row
 * they were written on AS WELL AS by the voucher they currently hang off, and
 * `receiptPdcVoucherWhere` finds the post-dated cheque vouchers a document
 * RAISED by their type. Neither cares which way the money went: an issued
 * cheque's row names its tender row and its voucher exactly as a received
 * one does, and a replacement (`/issued-cheques/replace`) is a separate row
 * of the cheques module's own, just as `/cheques/replace` is. See
 * `receipt-cheque-links.ts` for the two measured defects these close.
 */
export {
  receiptChequeFilter as paymentChequeFilter,
  receiptPdcVoucherWhere as paymentPdcVoucherWhere,
  type ReceiptChequeScope as PaymentChequeScope,
} from '../receipt/receipt-cheque-links';
