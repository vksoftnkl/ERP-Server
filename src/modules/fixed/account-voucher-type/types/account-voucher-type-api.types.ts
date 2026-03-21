import { AvtDrcrType, AvtTallyReservedVch } from '@prisma/client';

export interface AccountVoucherTypeErrorDetail {
  field: string;
  message: string;
}

export interface AccountVoucherTypeErrorResponse {
  success: false;
  message: string;
  errors: AccountVoucherTypeErrorDetail[];
}

export interface AccountVoucherTypeSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: TMeta;
  styles?: TStyles;
}

export interface AccountVoucherTypePayload {
  avtId: string;
  avtShort: string;
  avtDesc: string;
  avtDrcr: AvtDrcrType;
  avtPrintEnabled: boolean;
  avtPrintStyle: string | null;
  avtSortOrder: number;
  avtTallyName: string;
  avtTallyReservedType: AvtTallyReservedVch | null;
  avtIsActive: boolean;
  avtIsDeleted: boolean;
  avtSyncDate: string | null;
  avtCreatedOn: string;
  avtCreatedBy: string | null;
  avtModifiedOn: string;
  avtModifiedBy: string | null;
}

export type AccountVoucherTypeListItem = AccountVoucherTypePayload | Record<string, unknown>;

export interface AccountVoucherTypeListMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
