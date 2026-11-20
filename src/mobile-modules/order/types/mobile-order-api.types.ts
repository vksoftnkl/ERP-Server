import type { UserWording } from '../../../common/error-wording/error-wording';
import type { WaPostBlock } from '../../../modules/whatsapp/hook/wa-post-hook';
import type { ReservationShort } from '../../../modules/sales/posting/stock-reservation.service';

/**
 * Why a new phone order was kept as a DRAFT: the first coded error the
 * confirm (SaleOrderLifecycleService.postInTx) refused with, in the house
 * error-detail shape. `user` is the catalogue's plain words for the code
 * (fixed.error_message), absent when it has none.
 */
export interface MobileOrderConfirmRefusal {
  code: string;
  field: string | null;
  message: string;
  user?: UserWording;
}

/** The answer to POST /mobile/orders/create, for a new order and a resend alike. */
export interface MobileOrderCreateResult {
  soId: string;
  soOrderRefno: string;
  /**
   * The order's status NOW: CONFIRMED when the upload confirmed it, DRAFT
   * when the confirm was refused (see confirmRefused); a resend reads the
   * stored one.
   */
  soStatus: string;
  soAccYear: string;
  /** true = this client uuid was saved before: nothing was written this time. */
  duplicate: boolean;
  /** A resend of an order the office has since deleted. */
  soIsDeleted: boolean;
  /** Why the new order stayed DRAFT; null when it was confirmed, and on a resend. */
  confirmRefused: MobileOrderConfirmRefusal | null;
  /**
   * The confirm's reservation shortfalls (SALES_RESERVE_SHORT), as
   * /sale-orders/post answers them: a warning, never a refusal. [] on a resend.
   */
  warnings: ReservationShort[];
  /**
   * WhatsApp on Post, as the desktop /sale-orders/post answers it: present only
   * when this upload confirmed the order AND the company's
   * whatsapp.on_post_types lists Sales Order (4). Never on a resend or a DRAFT.
   */
  whatsapp?: WaPostBlock;
}
