/**
 * GST registration rules shared by the Company and Branch masters (notes 72).
 */

/**
 * C3 — a company's or branch's OWN registration. ck_comp_gst_reg_type and
 * ck_br_gst_reg_type hold the same four. Consumer / Overseas describe a
 * customer, never the business itself.
 */
export const GST_REG_TYPES = ['REGULAR', 'COMPOSITION', 'UNREGISTERED', 'SEZ'] as const;
export type GstRegType = (typeof GST_REG_TYPES)[number];

/** Two-digit state code, ten-character PAN slot, three more. */
const GSTIN_PATTERN = /^[0-9]{2}[0-9A-Z]{10}[0-9A-Z]{3}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export interface GstinFieldNames {
  gstin: string;
  stateCode: string;
  pan: string;
}

export interface GstinCheck {
  errors: Array<{ field: string; message: string }>;
  /** The PAN the GSTIN carries, when no PAN was given — the caller stores it. */
  panFromGstin: string | null;
}

/**
 * C7 — a GSTIN's first two digits are the state it is registered in, and
 * characters 3-12 are the holder's PAN. Both are checked against the record's
 * own state code and PAN, so an import or a client that skips the check still
 * cannot store a GSTIN of another state or another business.
 *
 * A PAN slot that is not PAN-shaped (a UIN, a TDS deductor's TAN) is not
 * compared. A blank PAN is filled from the GSTIN.
 */
export function checkGstin(
  gstin: string | null | undefined,
  stateCode: string,
  pan: string | null | undefined,
  fields: GstinFieldNames,
): GstinCheck {
  const result: GstinCheck = { errors: [], panFromGstin: null };
  if (!gstin) {
    return result;
  }
  if (!GSTIN_PATTERN.test(gstin)) {
    result.errors.push({
      field: fields.gstin,
      message: `${fields.gstin} must be 15 letters or digits: a 2-digit state code, the 10-character PAN, then 3 more`,
    });
    return result;
  }
  const gstinState = gstin.slice(0, 2);
  if (gstinState !== stateCode) {
    result.errors.push({
      field: fields.gstin,
      message: `GSTIN ${gstin} is registered in state ${gstinState}, but ${fields.stateCode} is ${stateCode}`,
    });
  }
  const gstinPan = gstin.slice(2, 12);
  if (PAN_PATTERN.test(gstinPan)) {
    if (!pan) {
      result.panFromGstin = gstinPan;
    } else if (pan !== gstinPan) {
      result.errors.push({
        field: fields.pan,
        message: `${fields.pan} ${pan} does not match the PAN in GSTIN ${gstin} (${gstinPan})`,
      });
    }
  }
  return result;
}
