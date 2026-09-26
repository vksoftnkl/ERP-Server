import { Prisma } from '@prisma/client';
import type { AppSettingEffectiveItem } from "../../settings/appSettings/types/app-settings-api.types";
import { type PpdSlab } from './ppd-slab';
import { PdcPostingMode, ReceiptBillSort, TcsBasis } from './types/receipt-enum';
export interface ReceiptSettings {
    pdcPostingMode: PdcPostingMode;
    billSort: ReceiptBillSort;
    salesmanMandatory: boolean;
    writeoffApprovalAbove: Prisma.Decimal;
    tcsBasis: TcsBasis;
    ppdSlabs: PpdSlab[];
    allowPostedAmend: boolean;
}
export declare const RECEIPT_SETTING_DEFAULTS: ReceiptSettings;
export declare function readReceiptSettings(effective: readonly AppSettingEffectiveItem[]): ReceiptSettings;
