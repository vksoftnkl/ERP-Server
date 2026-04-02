/**
 * Application-level enums for opening-stock module.
 * These replace the former Prisma DB enum types that were removed from the
 * inventory schema. The columns are now plain VARCHAR(20); validation is
 * enforced here and via @IsEnum() decorators in the DTOs.
 */
export const OpeningStockStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
} as const;
export type OpeningStockStatus = (typeof OpeningStockStatus)[keyof typeof OpeningStockStatus];
export const OpeningStockDeviceType = {
  PC: 'PC',
  MOBILE: 'MOBILE',
  WEB: 'WEB',
} as const;
export type OpeningStockDeviceType = (typeof OpeningStockDeviceType)[keyof typeof OpeningStockDeviceType];
export const OpeningStockDetailTrackingType = {
  NONE: 'NONE',
  BATCH: 'BATCH',
  LOT: 'LOT',
} as const;
export type OpeningStockDetailTrackingType =
  (typeof OpeningStockDetailTrackingType)[keyof typeof OpeningStockDetailTrackingType];
export const OpeningStockDetailCessType = {
  NONE: 'NONE',
  PERCENT: 'PERCENT',
  PER_UNIT: 'PER_UNIT',
} as const;
export type OpeningStockDetailCessType =
  (typeof OpeningStockDetailCessType)[keyof typeof OpeningStockDetailCessType];