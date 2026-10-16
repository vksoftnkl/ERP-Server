/**
 * Notes 119 / 127 §5 — every refusal Account Group Master raises carries one of
 * these as `errors[].code`; the Qt client words its box by the code alone, so
 * each string is an API contract: rename one and the box loses its wording.
 */
export enum AccGroupErrorCode {
  /** No live (not deleted) account group has the id given (404). */
  NOT_FOUND = 'ACC_GROUP_NOT_FOUND',
  /** A reserved (system) account group was sent to delete. */
  RESERVED_DELETE = 'ACC_GROUP_RESERVED_DELETE',
  /** A reserved (system) account group was sent to edit. */
  RESERVED_EDIT = 'ACC_GROUP_RESERVED_EDIT',
  /** Delete refused: live child groups still sit under this group. */
  HAS_CHILDREN = 'ACC_GROUP_HAS_CHILDREN',
  /** Delete refused: live ledgers still belong to this group. */
  HAS_LEDGERS = 'ACC_GROUP_HAS_LEDGERS',
  /** A new account group was sent without its parent group. */
  PARENT_REQUIRED = 'ACC_GROUP_PARENT_REQUIRED',
  /** The parent group named is not a live account group. */
  PARENT_NOT_FOUND = 'ACC_GROUP_PARENT_NOT_FOUND',
  /** The group was named as its own parent. */
  OWN_PARENT = 'ACC_GROUP_OWN_PARENT',
  /** The new parent is one of the group's own descendants (a circular hierarchy). */
  CIRCULAR = 'ACC_GROUP_CIRCULAR',
  /** The name is already taken by a group this company sees (its own or a shared one) (409). */
  NAME_TAKEN = 'ACC_GROUP_NAME_TAKEN',
  /** A foreign key refused the save: the company or parent group no longer exists. */
  REFERENCE_INVALID = 'ACC_GROUP_REFERENCE_INVALID',
}
