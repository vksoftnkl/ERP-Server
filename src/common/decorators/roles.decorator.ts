import { SetMetadata } from '@nestjs/common';
import { UserType } from '../../modules/settings/userAdministration/types/user-administration.enum';
export const ROLES_KEY = 'roles';
/**
 * Restrict a route (or whole controller) to the given user types. Enforced by the
 * global RolesGuard after AccessTokenGuard has authenticated the request.
 * SUPER ADMIN always passes. Routes without @Roles stay open to any authenticated user.
 */
export const Roles = (...roles: UserType[]) => SetMetadata(ROLES_KEY, roles);
