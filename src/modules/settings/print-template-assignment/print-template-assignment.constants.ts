/// Mirrors ck_pta_output_mode in
/// 20260827140000_correct_print_template_assignment.
///
/// FILE is gone and PDF, WHATSAPP and ESCPOS have arrived: the authoritative
/// §5 of 17_printing.sql names the six below and no others. Widen this list and
/// the CHECK together, never one alone.
export const PTA_OUTPUT_MODES = ['PRINT', 'PREVIEW', 'PDF', 'EMAIL', 'WHATSAPP', 'ESCPOS'] as const;
export type PtaOutputMode = (typeof PTA_OUTPUT_MODES)[number];

export const PTA_DEFAULT_OUTPUT_MODE: PtaOutputMode = 'PRINT';

/// pta_specificity is GENERATED in the database: 3 counter, 2 branch,
/// 1 company, 0 every company. Never written, only read back.
///
/// FOUR rungs, not three. Rung 0 is not "company with the id left off" — it is
/// its own rung, because pta_company_id is nullable and a shipped design can be
/// the default for every company that has not said otherwise. If a global row
/// and a company row shared a number the resolver would have a tie it cannot
/// break.
export const PTA_SCOPE_BY_SPECIFICITY = {
  3: 'COUNTER',
  2: 'BRANCH',
  1: 'COMPANY',
  0: 'GLOBAL',
} as const;

export type PtaScope = (typeof PTA_SCOPE_BY_SPECIFICITY)[keyof typeof PTA_SCOPE_BY_SPECIFICITY];

/// The sentinel ptl_company_key carries for a SHIPPED design, and the value
/// ck_pta_template_scope folds a global assignment's company to. It is the nil
/// uuid rather than NULL precisely so that no NULL reaches the composite
/// fk_pta_template, where MATCH SIMPLE would quietly stop checking.
export const PTA_SHIPPED_TEMPLATE_KEY = '00000000-0000-0000-0000-000000000000';

/// Where the paper comes out, and how much the renderer can assert about it.
///   PROFILE  a registered printer_profile: family, codepage, column count and
///            paper code all known, so prf_paper_code can refuse an A4 invoice
///            sent to an 80mm roll.
///   NAME     a bare queue or share name: none of that is known, so the render
///            falls back to the counter's defaults and asserts nothing.
///   DEFAULT  neither was given: the server's default queue for the device.
export const PTA_PRINTER_SOURCES = ['PROFILE', 'NAME', 'DEFAULT'] as const;
export type PtaPrinterSource = (typeof PTA_PRINTER_SOURCES)[number];
