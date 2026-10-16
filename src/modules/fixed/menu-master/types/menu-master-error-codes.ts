/**
 * Notes 119 / 127 §5 — every Menu Master refusal carries one of these in
 * `errors[].code`; the client words its box by the code alone. A code keeps its
 * meaning forever: a new refusal gets a new member.
 */
export enum MenuMasterErrorCode {
  /** The user menu was asked for with an access token that names no user (401). */
  USER_UNRESOLVED = 'MENU_USER_UNRESOLVED',
  /** A visibility update names a menuId that does not exist (404). */
  NOT_FOUND = 'MENU_NOT_FOUND',
}
