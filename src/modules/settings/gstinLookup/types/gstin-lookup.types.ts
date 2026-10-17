import type { ModuleErrorDetail, ModuleErrorResponse } from 'src/common/utils/module-shared.utils';
import type { GstRegType } from '../../shared/gst-registration';

export type GstinLookupErrorDetail = ModuleErrorDetail;
export type GstinLookupErrorResponse = ModuleErrorResponse<GstinLookupErrorDetail>;

/** The taxpayer's principal place of business, from the provider's `pradr.addr`. */
export interface GstinLookupAddress {
  building: string | null;
  street: string | null;
  locality: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pin: string | null;
}

/**
 * What GET /gst/search answers with: the fields a company, branch, customer
 * or supplier form fills, read from the provider's taxpayer record, plus that
 * record as the provider sent it (`raw`).
 */
export interface GstinLookupPayload {
  gstin: string;
  legalName: string | null;
  tradeName: string | null;
  /** The provider's status text, e.g. "Active", "Cancelled". */
  status: string | null;
  /** The provider's registration type text (`dty`), e.g. "Regular". */
  registrationType: string | null;
  /** registrationType as a GST_REG_TYPES value, or null when it is none of them. */
  gstRegType: GstRegType | null;
  /** GSTIN characters 1-2. */
  stateCode: string;
  /** GSTIN characters 3-12. */
  panNo: string;
  registeredOn: string | null;
  address: GstinLookupAddress | null;
  raw: Record<string, unknown>;
}
