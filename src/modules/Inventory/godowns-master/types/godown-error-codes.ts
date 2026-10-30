/**
 * Notes 119 / 127 §5 — every refusal of the godown (location) master carries
 * one of these as `errors[].code`; the client words its message box by the code
 * alone. Never reuse a code for a different meaning.
 */
export enum GodownErrorCode {
  /** No godown location (live, where the route needs one) has the id given. */
  NOT_FOUND = 'GODOWN_NOT_FOUND',
  /** gdl_name is missing or blank. */
  NAME_REQUIRED = 'GODOWN_NAME_REQUIRED',
  /** gdl_branch_id is missing on a new godown. */
  BRANCH_REQUIRED = 'GODOWN_BRANCH_REQUIRED',
  /** gdl_type is blank. */
  TYPE_REQUIRED = 'GODOWN_TYPE_REQUIRED',
  /** gdl_parent_id names the godown itself. */
  SELF_PARENT = 'GODOWN_SELF_PARENT',
  /** gdl_parent_id names no live godown location. */
  PARENT_NOT_FOUND = 'GODOWN_PARENT_NOT_FOUND',
  /** gdl_parent_id names a godown of another branch. */
  PARENT_OTHER_BRANCH = 'GODOWN_PARENT_OTHER_BRANCH',
  /** gdl_parent_id sits below the godown in the tree — the move would make a loop. */
  PARENT_IN_SUBTREE = 'GODOWN_PARENT_IN_SUBTREE',
  /** Delete refused: live child locations still sit under the godown. */
  HAS_CHILDREN = 'GODOWN_HAS_CHILDREN',
  /** Delete refused: stock is still on hand there, or a branch names it as its default godown. */
  IN_USE = 'GODOWN_IN_USE',
  /** Delete refused: the godown is already deleted. */
  ALREADY_DELETED = 'GODOWN_ALREADY_DELETED',
  /** Restore refused: the godown is not deleted. */
  NOT_DELETED = 'GODOWN_NOT_DELETED',
  /** Restore refused: the godown's parent is deleted. */
  PARENT_DELETED = 'GODOWN_PARENT_DELETED',
  /** Another live godown under the same parent (or at the top of the same branch) already has this name, ignoring case. */
  NAME_TAKEN = 'GODOWN_NAME_TAKEN',
  /** gdl_branch_id names no live branch. */
  BRANCH_NOT_FOUND = 'GODOWN_BRANCH_NOT_FOUND',
  /** gdl_branch_id change refused: live child locations still sit under the godown. */
  BRANCH_CHANGE_HAS_CHILDREN = 'GODOWN_BRANCH_CHANGE_HAS_CHILDREN',
  /** gdl_branch_id change refused: stock is on hand there, or a branch names it as its default godown. */
  BRANCH_CHANGE_IN_USE = 'GODOWN_BRANCH_CHANGE_IN_USE',
}
