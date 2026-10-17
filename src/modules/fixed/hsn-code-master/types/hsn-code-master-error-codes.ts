/**
 * Notes 119 / 127 §5 — every HSN Code Master refusal carries one of these in
 * `errors[].code`; the client words its box by the code alone. A code keeps its
 * meaning forever: a new refusal gets a new member.
 */
export enum HsnCodeMasterErrorCode {
  /** No HSN row matches the hsnId / hsnCode filter asked for (404). */
  NOT_FOUND = 'HSN_CODE_NOT_FOUND',
}
