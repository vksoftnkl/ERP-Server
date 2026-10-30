import type { ModuleErrorDetail } from '../../../common/utils/module-shared.utils';

/**
 * Every refusal /users raises (notes 119): the client words its box by
 * `errors[0].code` alone. (The SUPER ADMIN gate on the controller answers
 * USER_ROLE_RESERVED, the User Administration code of notes 125 — the same
 * refusal as on /user-administration, so it keeps that code.)
 */
export enum UsersErrorCode {
  /** Create / update: another live user already has that login name (case-insensitive). */
  LOGIN_NAME_TAKEN = 'USERS_LOGIN_NAME_TAKEN',
  /** No live (not deleted) user with that id. */
  NOT_FOUND = 'USERS_NOT_FOUND',
}

export interface UsersErrorDetail extends ModuleErrorDetail {
  code: UsersErrorCode;
}
