import { Prisma, StateMaster } from '@prisma/client';
import { SaveStateDto } from '../dto/save-state.dto';
import { StateErrorDetail, StateErrorResponse, StatePayload } from '../types/state-api.types';
import {
  DEFAULT_ACTOR,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  SalesWriteClient,
  applyPresentFields,
  buildSalesErrorResponse,
  normalizeRequiredText,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSalesBadRequest,
  throwSalesConflict,
  throwSalesNotFound,
  toNumber,
} from '../../utils/sales-service.utils';

export { DEFAULT_ACTOR, DEFAULT_LIMIT, DEFAULT_PAGE };
export const STATE_TABLE_NAME = 'state master';
export const STATE_AUDIT_SCREEN_NAME = 'State Master';
const STATE_OPTIONAL_FIELDS = ['stmAlias', 'stmShort', 'stmOrder', 'stmIsActive'];

export type StateWriteClient = SalesWriteClient;

export async function ensureStateNameIsUnique(
  tx: StateWriteClient,
  stateName: string,
  excludeId?: string,
): Promise<void> {
  const existing = await tx.stateMaster.findFirst({
    where: {
      stmIsDeleted: false,
      stmName: {
        equals: stateName,
        mode: 'insensitive',
      },
      ...(excludeId
        ? {
            stmId: {
              not: excludeId,
            },
          }
        : {}),
    },
    select: {
      stmId: true,
    },
  });

  if (existing) {
    throwSalesConflict<StateErrorDetail, StateErrorResponse>('State name already exists', [
      {
        field: 'stmName',
        message: 'Duplicate state name is not allowed',
      },
    ]);
  }
}

export function applyStateOptionalFields(
  data: Prisma.StateMasterUncheckedCreateInput | Prisma.StateMasterUncheckedUpdateInput,
  saveStateDto: SaveStateDto,
): void {
  applyPresentFields(data, saveStateDto, STATE_OPTIONAL_FIELDS);
}

export function normalizeRequiredStateName(name: string): string {
  return normalizeRequiredText<StateErrorDetail, StateErrorResponse>(name, 'stmName');
}

export function toStatePayload(record: StateMaster): StatePayload {
  return {
    stmId: record.stmId,
    stmName: record.stmName,
    stmAlias: record.stmAlias,
    stmShort: record.stmShort,
    stmOrder: toNumber(record.stmOrder),
    stmIsActive: record.stmIsActive,
    stmIsDeleted: record.stmIsDeleted,
    stmSyncDate: record.stmSyncDate ? record.stmSyncDate.toISOString() : null,
    stmCreatedOn: record.stmCreatedOn.toISOString(),
    stmCreatedBy: record.stmCreatedBy,
    stmModifiedOn: record.stmModifiedOn.toISOString(),
    stmModifiedBy: record.stmModifiedBy,
  };
}

export function resolveStateActor(
  value: string | null | undefined,
  fallback = DEFAULT_ACTOR,
): string {
  return resolveActor(value, fallback);
}

export function handleStateWriteError(error: unknown): void {
  throwOnUniqueConstraintError<StateErrorDetail, StateErrorResponse>(
    error,
    'State already exists',
    [
      {
        field: 'stmName',
        message: 'Duplicate stmName is not allowed',
      },
    ],
  );
}

export function throwStateNotFound(stmId: string): never {
  throwSalesNotFound<StateErrorDetail, StateErrorResponse>(
    'State not found',
    'stmId',
    `No active state found with id ${stmId}`,
  );
}

export function throwStateBadRequest(message: string, errors: StateErrorDetail[]): never {
  throwSalesBadRequest<StateErrorDetail, StateErrorResponse>(message, errors);
}

export function buildStateErrorResponse(
  message: string,
  errors: StateErrorDetail[] = [],
): StateErrorResponse {
  return buildSalesErrorResponse<StateErrorDetail, StateErrorResponse>(message, errors);
}
