import type { StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';
export declare const STOCK_ADJUSTMENT_KINDS: readonly ["ADJUSTMENT", "ISSUE", "DAMAGE", "EXPIRY_WRITEOFF"];
export type StockAdjustmentKind = (typeof STOCK_ADJUSTMENT_KINDS)[number];
export declare function isStockAdjustmentKind(value: unknown): value is StockAdjustmentKind;
export declare const STOCK_ADJUSTMENT_RULES: Readonly<Record<StockAdjustmentKind, StockVoucherTypeRules>>;
export declare const RELOT_OUT_CODE = "RELOT_OUT";
export declare const RELOT_IN_CODE = "RELOT_IN";
export declare const EXPIRY_GRACE_SETTING_KEY = "stock.expiry_writeoff_grace_days";
