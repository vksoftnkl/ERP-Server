/**
 * Party master rules D4 (plan-party-master-rules.md §3.4) — THE one map of the party
 * details a customer, its supplier and their shared ledger hold alike. A save of either
 * role writes each key it carries to the other role's row and to the ledger. Every other
 * column stays with its own role (credit terms, flags, notes, group …) and is never synced.
 *
 * Keys are the Prisma field names (= the DTO keys). `cus` / `sup` null = that role has
 * no such column (the value goes role ↔ ledger only). `max` is the narrowest of the three
 * columns, which the DTOs' MaxLength follow, so a value saved on one side always fits the
 * other.
 *
 * Not here, handled by PartySyncService beside the map:
 *  - the GST type (cus_gst_type / sup_gst_type ↔ led_gst_party_reg_type + led_is_sez),
 *    see party-gst-type.ts;
 *  - name, state name and state code, which each master normalises first (required);
 *  - company and branch (Q7 = a): synced too, but a company change is refused once the
 *    party has books in its current company.
 */
export interface PartyDetailField {
  cus: string | null;
  sup: string | null;
  led: string;
  max: number | null;
}

export const PARTY_DETAIL_FIELDS: readonly PartyDetailField[] = [
  { cus: 'cusShort', sup: 'supShort', led: 'ledShort', max: 50 },
  { cus: 'cusAddr1', sup: 'supAddr1', led: 'ledAddr1', max: 200 },
  { cus: 'cusAddr2', sup: 'supAddr2', led: 'ledAddr2', max: 200 },
  { cus: 'cusAddr3', sup: 'supAddr3', led: 'ledAddr3', max: 200 },
  { cus: 'cusCity', sup: 'supCity', led: 'ledCity', max: 100 },
  { cus: 'cusDistrict', sup: 'supDistrict', led: 'ledDistrict', max: 100 },
  { cus: 'cusCountry', sup: 'supCountry', led: 'ledCountry', max: 60 },
  { cus: 'cusPin', sup: 'supPincode', led: 'ledPin', max: 10 },
  { cus: 'cusTel', sup: 'supTel', led: 'ledTel', max: 20 },
  { cus: 'cusPhone1', sup: 'supPhone', led: 'ledPhone1', max: 20 },
  { cus: 'cusPhone2', sup: null, led: 'ledPhone2', max: 20 },
  { cus: 'cusWhatsappNo', sup: 'supWhatsappNo', led: 'ledWhatsappNo', max: 20 },
  { cus: 'cusEmail', sup: 'supMailId', led: 'ledEmail', max: 120 },
  { cus: 'cusContactPerson', sup: null, led: 'ledContactPerson', max: 150 },
  { cus: 'cusAadharNo', sup: null, led: 'ledAadharNo', max: 12 },
  { cus: 'cusGstNo', sup: 'supGstNo', led: 'ledGstinNo', max: 15 },
  { cus: 'cusPanNo', sup: 'supPanNo', led: 'ledPanNo', max: 10 },
  { cus: 'cusEcommerceGstin', sup: null, led: 'ledEcommerceGstin', max: 15 },
  { cus: 'cusRegionName', sup: 'supRegionName', led: 'ledRegionName', max: 200 },
  { cus: 'cusRegionAddr1', sup: 'supRegionAddr1', led: 'ledRegionAddr1', max: 200 },
  { cus: 'cusRegionAddr2', sup: 'supRegionAddr2', led: 'ledRegionAddr2', max: 200 },
  { cus: 'cusRegionAddr3', sup: 'supRegionAddr3', led: 'ledRegionAddr3', max: 200 },
  { cus: 'cusRegionCity', sup: 'supRegionCity', led: 'ledRegionCity', max: 100 },
  { cus: 'cusRegionDistrict', sup: 'supRegionDistrict', led: 'ledRegionDistrict', max: 100 },
  { cus: 'cusRegionStateName', sup: 'supRegionStateName', led: 'ledRegionStateName', max: 100 },
  { cus: 'cusRegionCountry', sup: 'supRegionCountry', led: 'ledRegionCountry', max: 60 },
  // Q7 = a: one company and branch on all three rows.
  { cus: 'cusCompanyId', sup: 'supCompanyId', led: 'ledCompanyId', max: null },
  { cus: 'cusBranchId', sup: 'supBranchId', led: 'ledBranchId', max: null },
];

/** The required trio each master normalises before the sync (never blank). */
export const PARTY_REQUIRED_FIELDS: readonly PartyDetailField[] = [
  { cus: 'cusName', sup: 'supName', led: 'ledName', max: 200 },
  { cus: 'cusStateName', sup: 'supStateName', led: 'ledStateName', max: 100 },
  { cus: 'cusStateCode', sup: 'supStateCode', led: 'ledStateCode', max: 2 },
];

export type PartyRole = 'CUSTOMER' | 'SUPPLIER';

/** The column of `role` for a map row (null = that role has none). */
export function roleKeyOf(field: PartyDetailField, role: PartyRole): string | null {
  return role === 'CUSTOMER' ? field.cus : field.sup;
}
