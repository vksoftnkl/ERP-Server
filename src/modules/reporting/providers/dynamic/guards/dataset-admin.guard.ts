import { CanActivate, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestContextService } from '../../../../../common/request-context/request-context.service';

/**
 * Authoring a dataset is a VENDOR operation, not a tenant one.
 *
 * This guard is the reason the feature does not weaken the template security
 * model. The rule that makes templates safe is "SQL never originates from
 * tenant-authored content" — and a dataset row IS SQL. Letting a tenant admin
 * write one would hand exactly the cross-tenant read primitive that the
 * provider contract exists to prevent to whoever can reach the admin screen.
 *
 * The check is intentionally in ONE place. When this codebase grows a real RBAC
 * system, this class is the only thing to replace; nothing else in the dataset
 * feature knows what a permission is.
 *
 * NOTE ON THE CURRENT CHECK: there is no role system yet — usr_type is a free
 * string defaulting to 'USER', populated into the request context from the JWT
 * by AccessTokenGuard. So this compares against an allow-list, overridable with
 * REPORT_DATASET_ADMIN_USER_TYPES for a deployment that names the role
 * differently. It is a coarse check, and it is deliberately fail-closed: an
 * absent or unrecognised user type is refused.
 */

const DEFAULT_ADMIN_USER_TYPES = ['SUPER_ADMIN'];

@Injectable()
export class DatasetAdminGuard implements CanActivate {
  private readonly logger = new Logger(DatasetAdminGuard.name);

  private readonly allowed: ReadonlySet<string>;

  constructor(
    private readonly requestContext: RequestContextService,
    config: ConfigService,
  ) {
    const configured = config.get<string>('REPORT_DATASET_ADMIN_USER_TYPES');
    const types = configured
      ? configured
          .split(',')
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean)
      : DEFAULT_ADMIN_USER_TYPES;

    this.allowed = new Set(types);
  }

  canActivate(): boolean {
    const userType = this.requestContext.getUserType();

    if (userType === null || !this.allowed.has(userType.toUpperCase())) {
      this.logger.warn(
        `Report dataset admin refused for user type '${userType ?? 'none'}' ` +
          `(user ${this.requestContext.getUserId() ?? 'unknown'})`,
      );
      throw new ForbiddenException(
        'Authoring report datasets requires a vendor administrator account.',
      );
    }

    return true;
  }
}
