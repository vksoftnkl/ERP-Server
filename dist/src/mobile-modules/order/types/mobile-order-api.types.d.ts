import type { UserWording } from '../../../common/error-wording/error-wording';
import type { WaPostBlock } from '../../../modules/whatsapp/hook/wa-post-hook';
import type { ReservationShort } from '../../../modules/sales/posting/stock-reservation.service';
export interface MobileOrderConfirmRefusal {
    code: string;
    field: string | null;
    message: string;
    user?: UserWording;
}
export interface MobileOrderCreateResult {
    soId: string;
    soOrderRefno: string;
    soStatus: string;
    soAccYear: string;
    duplicate: boolean;
    soIsDeleted: boolean;
    confirmRefused: MobileOrderConfirmRefusal | null;
    warnings: ReservationShort[];
    whatsapp?: WaPostBlock;
}
