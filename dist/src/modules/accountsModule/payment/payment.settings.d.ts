import { Prisma } from '@prisma/client';
import type { AppSettingEffectiveItem } from "../../settings/appSettings/types/app-settings-api.types";
import { PdcPostingMode, ReceiptBillSort } from './types/payment-enum';
export interface PaymentSettings {
    pdcPostingMode: PdcPostingMode;
    billSort: ReceiptBillSort;
    salesmanMandatory: boolean;
    writeoffApprovalAbove: Prisma.Decimal;
    allowPostedAmend: boolean;
}
export declare const PAYMENT_SETTING_DEFAULTS: PaymentSettings;
export declare function readPaymentSettings(effective: readonly AppSettingEffectiveItem[]): PaymentSettings;
