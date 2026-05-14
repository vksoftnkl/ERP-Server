export {
  DEFAULT_ACTOR,
  DEFAULT_ACTOR as DEFAULT_AUDIT_ACTOR,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  applyPresentFields,
  buildErrorResponse as buildSalesErrorResponse,
  hasOwnProperty,
  isUniqueConstraintError,
  normalizeRequiredText,
  resolveActor,
  throwBadRequest as throwSalesBadRequest,
  throwConflict as throwSalesConflict,
  throwNotFound as throwSalesNotFound,
  throwOnUniqueConstraintError,
  toNumber,
} from '../../../common/utils/module-shared.utils';
export type {
  ModuleErrorDetail as SalesErrorDetail,
  ModuleErrorResponse as SalesErrorResponse,
  ModuleWriteClient as SalesWriteClient,
  PresentFieldTransform,
} from '../../../common/utils/module-shared.utils';
