/**
 * Notes 119 / 127 §5 — every refusal the Widget master raises carries one of
 * these in `errors[].code`. The Qt client words its box by the code alone, so
 * each string is an API contract: rename one and the box loses its wording.
 */
export const WIDGET_ERROR = {
  /** sectionId is not a positive integer. */
  SECTION_ID_INVALID: 'WIDGET_SECTION_ID_INVALID',
  /** fieldId is not a positive integer. */
  FIELD_ID_INVALID: 'WIDGET_FIELD_ID_INVALID',
  /** No widget section has the requested sectionId — 404. */
  SECTION_NOT_FOUND: 'WIDGET_SECTION_NOT_FOUND',
  /** No widget field has the requested fieldId under that sectionId — 404. */
  FIELD_NOT_FOUND: 'WIDGET_FIELD_NOT_FOUND',
} as const;

export type WidgetErrorCode = (typeof WIDGET_ERROR)[keyof typeof WIDGET_ERROR];
