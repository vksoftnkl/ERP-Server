import { Injectable } from '@nestjs/common';
import { Prisma, TransactionHold } from '@prisma/client';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListTransactionHoldQueryDto } from './dto/list-transaction-hold-query.dto';
import { SaveTransactionHoldDto } from './dto/save-transaction-hold.dto';
import {
  TRANSACTION_HOLD_CLOSED_STATUSES,
  TRANSACTION_HOLD_DOC_TYPES,
  TRANSACTION_HOLD_IN_USE_STATUSES,
  TRANSACTION_HOLD_VALUE_GUARDS,
  TransactionHoldConversion,
  TransactionHoldDeleteResult,
  TransactionHoldDeviceType,
  TransactionHoldDocType,
  TransactionHoldErrorDetail,
  TransactionHoldGuardedValues,
  TransactionHoldHoldNoScope,
  TransactionHoldListItem,
  TransactionHoldListMeta,
  TransactionHoldLockScope,
  TransactionHoldPayload,
  TransactionHoldScope,
  TransactionHoldStatus,
} from './types/transaction-hold-api.types';
import {
  resolvePagination,
  runConfiguredGridQuery,
  runSalesListQuery,
} from 'src/common/utils/module-list.utils';
import {
  DEFAULT_ACTOR,
  PresentFieldTransform,
  SalesWriteClient,
  applyPresentFields,
  normalizeNullableString,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSalesBadRequest,
  throwSalesConflict,
  throwSalesForbidden,
  throwSalesNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';
const TRANSACTION_HOLD_TABLE_NAME = 'transaction hold';
const TRANSACTION_HOLD_AUDIT_SCREEN_NAME = 'Transaction Hold';
const TRANSACTION_HOLD_GRID_ALIAS = 'transaction_hold_grid';
// th_device_id / th_locked_by / th_resumed_by are all VARCHAR(64), so a longer
// device id is refused rather than silently truncated into one that would never
// match itself on the ownership check.
const DEVICE_ID_MAX_LENGTH = 64;
// Columns copied verbatim from the DTO (already normalized by its decorators)
// onto the create/update payload; only keys present on the request are applied,
// so a partial update stays partial. The scope (thCompanyId / thBranchId /
// thAccYear), thHoldNo, thDeviceId and the audit columns are resolved explicitly
// instead — they are required on create, or need a uniqueness check first.
const TRANSACTION_HOLD_OPTIONAL_FIELDS = [
  'thHoldDate',
  'thDocType',
  'thCounterId',
  'thSessionId',
  'thUserId',
  'thDeviceType',
  'thCustomerName',
  'thItemCount',
  'thTotalQty',
  'thTotalAmount',
  'thStatus',
  'thHoldReason',
  'thRemarks',
  'thExpiresAt',
  'thLockedBy',
  'thLockedAt',
  'thResumedBy',
  'thResumedAt',
  'thResumeCount',
  'thConvertedDocType',
  'thConvertedDocId',
  'thConvertedNo',
  'thConvertedAt',
  'thConvertedBy',
  'thIsStockReserved',
  'thUiState',
];
// NOT NULL columns carrying a DB default: an explicit null is dropped rather
// than written, so the default (or the stored value on update) survives instead
// of the insert failing on a 23502.
const TRANSACTION_HOLD_DEFAULTED_FIELDS = [
  'thHoldDate',
  'thDocType',
  'thDeviceType',
  'thItemCount',
  'thTotalQty',
  'thTotalAmount',
  'thStatus',
  'thResumeCount',
  'thIsStockReserved',
];
// Nullable text columns — a blank string is stored as NULL rather than ''.
const TRANSACTION_HOLD_TEXT_FIELDS = [
  'thCustomerName',
  'thHoldReason',
  'thRemarks',
  'thLockedBy',
  'thResumedBy',
  'thConvertedNo',
  'thConvertedBy',
];
function dropNullish(value: unknown): unknown {
  return value === null ? undefined : value;
}
// th_ui_state is a nullable JSONB column, so clearing it means SQL NULL
// (Prisma.DbNull) — Prisma.JsonNull would store the JSON literal `null` and the
// column would still read back as "set".
function toJsonInput(value: unknown): unknown {
  return value === null ? Prisma.DbNull : value;
}
const TRANSACTION_HOLD_FIELD_TRANSFORMS: Partial<Record<string, PresentFieldTransform>> = {
  ...Object.fromEntries(TRANSACTION_HOLD_DEFAULTED_FIELDS.map((field) => [field, dropNullish])),
  ...Object.fromEntries(
    TRANSACTION_HOLD_TEXT_FIELDS.map((field) => [
      field,
      (value: unknown) => normalizeNullableString(value as string | null | undefined),
    ]),
  ),
  thUiState: toJsonInput,
};
type TransactionHoldWriteClient = SalesWriteClient;
/**
 * CRUD over `public.transaction_hold` — a transaction parked mid-entry so the
 * till can serve the next customer and pull this one back later.
 *
 * The table stores no lines of its own: `th_ui_state` carries the whole screen
 * (cart, discounts, focus) as JSONB and the `th_customer_name` / `th_item_count`
 * / `th_total_qty` / `th_total_amount` columns are the summary the held-bills
 * list renders from, snapshotted at hold time. Nothing here reads into the UI
 * state — it is stored and handed back verbatim.
 *
 * `th_converted_doc_id` is polymorphic (no FK), so the document a hold turned
 * into is named by the `th_converted_doc_type` / `th_converted_doc_id` pair
 * rather than joined. The table carries no foreign keys and no CHECK
 * constraints at all, which is why the company / branch / user / session
 * references and every enum-shaped column are validated here.
 */
@Injectable()
export class TransactionHoldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveTransactionHoldDto: SaveTransactionHoldDto): Promise<TransactionHoldPayload> {
    if (saveTransactionHoldDto.thId) {
      return this.updateHold(saveTransactionHoldDto);
    }
    return this.createHold(saveTransactionHoldDto);
  }
  async list(
    queryDto: ListTransactionHoldQueryDto,
  ): Promise<ConfiguredGridListResult<TransactionHoldListItem, TransactionHoldListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const where = this.buildListWhere(queryDto);
    return runSalesListQuery(
      { page, limit },
      {
        // A configured grid runs its own stored SQL and knows nothing about
        // these filters, so a filtered request has to take the Prisma path or
        // it would silently answer with the unfiltered set.
        hasStructuredFilters: this.hasStructuredFilters(queryDto),
        configuredGridFn: () =>
          runConfiguredGridQuery<TransactionHoldListItem>(this.configuredGridSqlService, {
            tableName: TRANSACTION_HOLD_TABLE_NAME,
            alias: TRANSACTION_HOLD_GRID_ALIAS,
            search: queryDto.search,
            page,
            limit,
            skip,
          }),
        countFn: () => this.prisma.transactionHold.count({ where }),
        findManyFn: () =>
          this.prisma.transactionHold.findMany({
            where,
            // The held-bills list is read newest first; the PK breaks ties so
            // paging stays stable across two holds parked in the same instant.
            orderBy: [{ thHoldDate: 'desc' }, { thId: 'desc' }],
            skip,
            take: limit,
          }),
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }
  async getById(thId: string): Promise<TransactionHoldPayload> {
    const record = await this.prisma.transactionHold.findFirst({
      where: { thId, thIsDeleted: false },
    });
    if (!record) {
      this.throwNotFound(thId);
    }
    return this.toPayload(record);
  }
  async softDelete(thId: string): Promise<TransactionHoldDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.transactionHold.findFirst({
        where: { thId, thIsDeleted: false },
      });
      if (!existing) {
        this.throwNotFound(thId);
      }
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      // th_status is left as it stands: a deleted hold that had already been
      // CONVERTED must keep saying so, and every read path filters on
      // th_is_deleted anyway.
      const deleted = await tx.transactionHold.update({
        where: { thId },
        data: {
          thIsDeleted: true,
          thModifiedAt: new Date(),
          thModifiedBy: actor,
        },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: TRANSACTION_HOLD_TABLE_NAME,
          screenName: TRANSACTION_HOLD_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: thId,
          displayName: this.displayName(existing),
          originalRecord: this.toPayload(existing),
          modifiedRecord: this.toPayload(deleted),
          userId: actor,
          notes: 'Hold soft deleted',
        },
        tx,
      );
      return { thId, deleted: true };
    });
  }
  /**
   * Pull a parked hold onto a till and take its edit lock — `HELD` → `LOCKED`.
   *
   * The lock holder is the DEVICE (`X-Device-Id`), not the operator: two
   * operators sharing a till are the same holder, one operator on two tills is
   * not. Returns the whole hold, `th_ui_state` included, so the till can redraw
   * the screen it is resuming.
   *
   * The transition is a single conditional UPDATE (`th_status = 'HELD'` sits in
   * the WHERE clause, not in a preceding SELECT), so two tills racing the same
   * parked bill serialize on the row: Postgres makes the loser re-evaluate the
   * predicate against the winner's committed row, it matches nothing, and the
   * loser is told who holds it. A read-then-update would let both pass the
   * check and both write.
   */
  async resumeHold(
    thId: string,
    deviceId: string | undefined | null,
    scope: TransactionHoldLockScope,
  ): Promise<TransactionHoldPayload> {
    const device = this.requireDeviceId(deviceId);
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      // Read only to snapshot the "before" side of the audit entry (an update
      // log needs both sides). It gates nothing — the conditional update below
      // is what decides whether this device gets the lock — so a row that moves
      // between this SELECT and that UPDATE still lands on the right answer.
      const before = await tx.transactionHold.findFirst({ where: this.lockWhere(thId, scope) });
      const acquired = await tx.transactionHold.updateMany({
        where: {
          ...this.lockWhere(thId, scope),
          // Only a free hold can be taken.
          thStatus: TransactionHoldStatus.HELD,
        },
        data: {
          thStatus: TransactionHoldStatus.LOCKED,
          thLockedBy: device,
          thLockedAt: now,
          thResumedBy: device,
          thResumedAt: now,
          thResumeCount: { increment: 1 },
          thModifiedAt: now,
          thModifiedBy: actor,
        },
      });
      if (acquired.count === 0) {
        return this.resolveResumeFailure(tx, thId, device, scope);
      }
      const resumed = await this.readLocked(tx, thId, scope);
      await this.auditLockTransition(tx, {
        original: before,
        modified: resumed,
        userId: actor,
        notes: `Hold resumed on device ${device}`,
      });
      return this.toPayload(resumed);
    });
  }

  /**
   * Give the edit lock back without billing — `LOCKED` → `HELD`, so the next
   * till can recall the same parked bill.
   *
   * Ownership is part of the WHERE clause (`th_locked_by = <this device>`)
   * rather than a check before it, so a device can never release a lock another
   * device holds, whatever it sends.
   */
  async releaseHold(
    thId: string,
    deviceId: string | undefined | null,
    scope: TransactionHoldLockScope,
  ): Promise<TransactionHoldPayload> {
    const device = this.requireDeviceId(deviceId);
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const before = await tx.transactionHold.findFirst({ where: this.lockWhere(thId, scope) });
      const released = await tx.transactionHold.updateMany({
        where: {
          ...this.lockWhere(thId, scope),
          thStatus: TransactionHoldStatus.LOCKED,
          thLockedBy: device,
        },
        data: {
          thStatus: TransactionHoldStatus.HELD,
          thLockedBy: null,
          thLockedAt: null,
          thModifiedAt: now,
          thModifiedBy: actor,
        },
        // th_resumed_by / th_resumed_at and th_resume_count are the history of
        // who pulled it and how often — releasing the lock does not erase that.
      });
      if (released.count === 0) {
        return this.resolveReleaseFailure(tx, thId, scope);
      }
      const free = await this.readLocked(tx, thId, scope);
      await this.auditLockTransition(tx, {
        original: before,
        modified: free,
        userId: actor,
        notes: `Hold released by device ${device}`,
      });
      return this.toPayload(free);
    });
  }

  /**
   * Take a lock away from the device holding it — `LOCKED` → `HELD` WITHOUT the
   * ownership check.
   *
   * This is the escape hatch, and it is deliberately a separate method rather
   * than a flag on `releaseHold`: there is no timeout and no auto-release, so a
   * till that dies mid-edit would otherwise strand its cart forever. It is not
   * an alternative way to release — it is a decision to interrupt whoever holds
   * the lock, and the audit entry names both devices so it can be answered for
   * afterwards.
   *
   * Everything else still holds: it is the same conditional update (a hold that
   * is already CONVERTED cannot be forced back open), the same tenant scope, and
   * an already-free hold is a no-op rather than an error.
   */
  async forceReleaseHold(
    thId: string,
    deviceId: string | undefined | null,
    scope: TransactionHoldLockScope,
  ): Promise<TransactionHoldPayload> {
    const device = this.requireDeviceId(deviceId);
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const before = await tx.transactionHold.findFirst({ where: this.lockWhere(thId, scope) });
      const taken = await tx.transactionHold.updateMany({
        where: {
          ...this.lockWhere(thId, scope),
          // No thLockedBy predicate — that is the whole point — but the status
          // one stays, so this can only ever free a hold that is genuinely in
          // use, never reopen a closed one. RESUMED is in the set because it is
          // what "in use" meant before this lock existed: rows a client parked
          // by writing the status through the CRUD route would otherwise be
          // stuck for good, un-resumable (409) and un-releasable (403).
          thStatus: { in: [...TRANSACTION_HOLD_IN_USE_STATUSES] },
        },
        data: {
          thStatus: TransactionHoldStatus.HELD,
          thLockedBy: null,
          thLockedAt: null,
          thModifiedAt: now,
          thModifiedBy: actor,
        },
      });
      if (taken.count === 0) {
        return this.resolveReleaseFailure(tx, thId, scope);
      }
      const free = await this.readLocked(tx, thId, scope);
      await this.auditLockTransition(tx, {
        original: before,
        modified: free,
        userId: actor,
        // Both sides on the record: who took it, and who lost it.
        notes:
          `Hold lock force released by device ${device}` +
          (before?.thLockedBy ? `, taken from device ${before.thLockedBy}` : ''),
      });
      return this.toPayload(free);
    });
  }

  /**
   * Close a hold onto the document it became — `LOCKED` → `CONVERTED`, the
   * terminal state. Stamps the conversion trace and drops the lock, so nothing
   * can resume the hold again and the parked cart cannot be billed twice.
   *
   * Ownership is in the WHERE clause exactly as it is on release: only the
   * device that resumed the hold may bill it.
   */
  async convertHold(
    thId: string,
    deviceId: string | undefined | null,
    scope: TransactionHoldLockScope,
    conversion: TransactionHoldConversion,
  ): Promise<TransactionHoldPayload> {
    const device = this.requireDeviceId(deviceId);
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    this.ensureConversionIsAllowed(conversion);
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const before = await tx.transactionHold.findFirst({ where: this.lockWhere(thId, scope) });
      const converted = await tx.transactionHold.updateMany({
        where: {
          ...this.lockWhere(thId, scope),
          thStatus: TransactionHoldStatus.LOCKED,
          thLockedBy: device,
        },
        data: {
          thStatus: TransactionHoldStatus.CONVERTED,
          thConvertedDocType: conversion.thConvertedDocType,
          thConvertedDocId: conversion.thConvertedDocId,
          thConvertedNo: normalizeNullableString(conversion.thConvertedNo) ?? null,
          thConvertedAt: now,
          thConvertedBy: resolveActor(conversion.thConvertedBy, actor),
          // The hold is finished with, so the lock is dropped rather than left
          // pointing at a till that has moved on.
          thLockedBy: null,
          thLockedAt: null,
          thModifiedAt: now,
          thModifiedBy: actor,
        },
      });
      if (converted.count === 0) {
        return this.resolveConvertFailure(tx, thId, scope);
      }
      const closed = await this.readLocked(tx, thId, scope);
      await this.auditLockTransition(tx, {
        original: before,
        modified: closed,
        userId: actor,
        notes:
          `Hold converted to ${conversion.thConvertedDocType} ` +
          `${conversion.thConvertedDocId} on device ${device}`,
      });
      return this.toPayload(closed);
    });
  }

  // Nothing acquired the lock. The row is read back to say WHY, which is also
  // where re-entrancy is settled: a device asking for a hold it already holds
  // gets the screen back rather than a 409, so a retried request (dropped
  // response, double tap on the recall list) is harmless. It deliberately does
  // NOT bump th_resume_count a second time — the count is how often the hold
  // moved between tills, not how often the button was pressed.
  private async resolveResumeFailure(
    tx: TransactionHoldWriteClient,
    thId: string,
    device: string,
    scope: TransactionHoldLockScope,
  ): Promise<TransactionHoldPayload> {
    const current = await this.readLocked(tx, thId, scope);
    if (
      current.thStatus === String(TransactionHoldStatus.LOCKED) &&
      current.thLockedBy === device
    ) {
      return this.toPayload(current);
    }
    if (current.thStatus === String(TransactionHoldStatus.LOCKED)) {
      throwSalesConflict<TransactionHoldErrorDetail>(
        `Hold is LOCKED by device ${current.thLockedBy ?? 'unknown'}`,
        [
          {
            field: 'thLockedBy',
            message:
              `The hold is in use on device ${current.thLockedBy ?? 'unknown'}. ` +
              'It has to be released there before another device can resume it',
          },
        ],
      );
    }
    throwSalesConflict<TransactionHoldErrorDetail>(
      `Hold is ${current.thStatus} and cannot be resumed`,
      [
        {
          field: 'thStatus',
          message: `Only a hold in status ${TransactionHoldStatus.HELD} can be resumed`,
        },
      ],
    );
  }

  // The release did not match. Being already HELD is not a failure — the caller
  // asked for the state the row is already in (a retried release), so it gets
  // the row back. Anything else means this device does not hold the lock.
  private async resolveReleaseFailure(
    tx: TransactionHoldWriteClient,
    thId: string,
    scope: TransactionHoldLockScope,
  ): Promise<TransactionHoldPayload> {
    const current = await this.readLocked(tx, thId, scope);
    if (current.thStatus === String(TransactionHoldStatus.HELD)) {
      return this.toPayload(current);
    }
    this.throwLockOwnershipFailure(current, 'released');
  }

  // The conversion did not match. Unlike release there is no idempotent path: a
  // hold that is not locked by this device must not be billed by it, and a hold
  // already CONVERTED must not be billed twice.
  private async resolveConvertFailure(
    tx: TransactionHoldWriteClient,
    thId: string,
    scope: TransactionHoldLockScope,
  ): Promise<never> {
    const current = await this.readLocked(tx, thId, scope);
    this.throwLockOwnershipFailure(current, 'converted');
  }

  // 409 when the hold is finished with (retrying will never help), 403 when it
  // is simply held by someone else or by nobody — the request is well formed,
  // the lock just is not this device's to spend.
  private throwLockOwnershipFailure(current: TransactionHold, action: string): never {
    if (TRANSACTION_HOLD_CLOSED_STATUSES.includes(current.thStatus)) {
      throwSalesConflict<TransactionHoldErrorDetail>('Hold is already closed', [
        {
          field: 'thStatus',
          message: `A hold in status ${current.thStatus} cannot be ${action}`,
        },
      ]);
    }
    throwSalesForbidden<TransactionHoldErrorDetail>('Not locked by this device', [
      {
        field: 'thLockedBy',
        message: current.thLockedBy
          ? `The hold is locked by device ${current.thLockedBy}, so only that device can ` +
            `have it ${action}`
          : `The hold is ${current.thStatus} and has to be resumed on this device before it ` +
            `can be ${action}`,
      },
    ]);
  }

  // Every lock query is keyed on the tenant scope and skips soft-deleted rows,
  // so a hold can be neither taken nor spent from another company or branch.
  private lockWhere(
    thId: string,
    scope: TransactionHoldLockScope,
  ): Prisma.TransactionHoldWhereInput {
    return {
      thId,
      thCompanyId: scope.thCompanyId,
      thBranchId: scope.thBranchId,
      thIsDeleted: false,
    };
  }

  private async readLocked(
    tx: TransactionHoldWriteClient,
    thId: string,
    scope: TransactionHoldLockScope,
  ): Promise<TransactionHold> {
    const record = await tx.transactionHold.findFirst({ where: this.lockWhere(thId, scope) });
    if (!record) {
      // Unknown id, soft deleted, or living in another company / branch — all
      // of them "no such hold here", which is also what keeps a wrong-tenant
      // probe from confirming the row exists.
      this.throwNotFound(thId);
    }
    return record;
  }

  // th_locked_by is what release and convert compare against, so the device id
  // is required and is stored exactly as the till sends it (trimmed only —
  // upper-casing it would stop it matching itself).
  private requireDeviceId(deviceId: string | undefined | null): string {
    const trimmed = deviceId?.trim();
    if (!trimmed) {
      throwSalesBadRequest<TransactionHoldErrorDetail>('Device id is required', [
        {
          field: 'thDeviceId',
          message: 'The X-Device-Id header must be sent to resume, release or convert a hold',
        },
      ]);
    }
    if (trimmed.length > DEVICE_ID_MAX_LENGTH) {
      throwSalesBadRequest<TransactionHoldErrorDetail>('Device id is too long', [
        {
          field: 'thDeviceId',
          message: `The X-Device-Id header must be at most ${DEVICE_ID_MAX_LENGTH} characters`,
        },
      ]);
    }
    return trimmed;
  }

  // The DTO already rejects a bad document type, but the service is exported for
  // the till flow that raises the document and calls convertHold directly, so
  // the rule is restated where the write happens.
  private ensureConversionIsAllowed(conversion: TransactionHoldConversion): void {
    const details: TransactionHoldErrorDetail[] = [];
    if (!conversion.thConvertedDocId) {
      details.push({
        field: 'thConvertedDocId',
        message: 'thConvertedDocId is required when converting a hold',
      });
    }
    if (!TRANSACTION_HOLD_DOC_TYPES.includes(conversion.thConvertedDocType)) {
      details.push({
        field: 'thConvertedDocType',
        message: `thConvertedDocType must be one of: ${TRANSACTION_HOLD_DOC_TYPES.join(', ')}`,
      });
    }
    if (details.length > 0) {
      throwSalesBadRequest<TransactionHoldErrorDetail>('Invalid conversion', details);
    }
  }

  private async auditLockTransition(
    tx: TransactionHoldWriteClient,
    entry: {
      original: TransactionHold | null;
      modified: TransactionHold;
      userId: string;
      notes: string;
    },
  ): Promise<void> {
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: TRANSACTION_HOLD_TABLE_NAME,
        screenName: TRANSACTION_HOLD_AUDIT_SCREEN_NAME,
        screenType: 'transaction',
        pk: entry.modified.thId,
        displayName: this.displayName(entry.modified),
        // The snapshot was taken before the conditional update; on the vanishing
        // chance the row moved in between, the stored row is the honest "after"
        // and standing in the "before" keeps the entry writable either way.
        originalRecord: this.toPayload(entry.original ?? entry.modified),
        modifiedRecord: this.toPayload(entry.modified),
        userId: entry.userId,
        branchId: entry.modified.thBranchId,
        notes: entry.notes,
      },
      tx as Prisma.TransactionClient,
    );
  }

  private async createHold(
    saveTransactionHoldDto: SaveTransactionHoldDto,
  ): Promise<TransactionHoldPayload> {
    const now = new Date();
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const scope: TransactionHoldScope = {
      thCompanyId: this.requireField(saveTransactionHoldDto.thCompanyId, 'thCompanyId'),
      thBranchId: this.requireField(saveTransactionHoldDto.thBranchId, 'thBranchId'),
      thAccYear: this.requireNumberField(saveTransactionHoldDto.thAccYear, 'thAccYear'),
    };
    const thHoldNo = this.requireField(saveTransactionHoldDto.thHoldNo, 'thHoldNo');
    const thDeviceId = this.requireField(saveTransactionHoldDto.thDeviceId, 'thDeviceId');
    const thDeviceType = this.requireField(saveTransactionHoldDto.thDeviceType, 'thDeviceType');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureCompanyExists(tx, scope.thCompanyId);
        await this.ensureBranchExists(tx, scope.thBranchId);
        await this.ensureUserExists(tx, saveTransactionHoldDto.thUserId);
        await this.ensureSessionExists(tx, saveTransactionHoldDto.thSessionId);
        await this.ensureHoldNoIsUnique(tx, thHoldNo, {
          ...scope,
          // ux_th_hold_no is scoped per document type, so an omitted thDocType
          // has to be resolved to the column default before the check.
          thDocType: saveTransactionHoldDto.thDocType ?? TransactionHoldDocType.SALE_INVOICE,
        });
        const data: Prisma.TransactionHoldUncheckedCreateInput = {
          thCompanyId: scope.thCompanyId,
          thBranchId: scope.thBranchId,
          thAccYear: scope.thAccYear,
          thHoldNo,
          thDeviceId,
          thDeviceType,
          thCreatedAt: now,
          thCreatedBy: resolveActor(saveTransactionHoldDto.thCreatedBy, actor),
        };
        applyPresentFields(
          data,
          saveTransactionHoldDto,
          TRANSACTION_HOLD_OPTIONAL_FIELDS,
          TRANSACTION_HOLD_FIELD_TRANSFORMS,
        );
        // Written after the bulk copy rather than with it: an omitted hold date
        // has to land on `now` instead of the column default, so the guards
        // below and the returned payload judge the instant the row will carry.
        data.thHoldDate = saveTransactionHoldDto.thHoldDate ?? now;
        this.ensureValuesAreAllowed(undefined, data);
        const created = await tx.transactionHold.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: TRANSACTION_HOLD_TABLE_NAME,
            screenName: TRANSACTION_HOLD_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: payload.thId,
            displayName: this.displayName(created),
            originalRecord: null,
            modifiedRecord: payload,
            userId: created.thCreatedBy,
            notes: 'Hold created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  private async updateHold(
    saveTransactionHoldDto: SaveTransactionHoldDto,
  ): Promise<TransactionHoldPayload> {
    const thId = saveTransactionHoldDto.thId!;
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.transactionHold.findFirst({
          where: { thId, thIsDeleted: false },
        });
        if (!existing) {
          this.throwNotFound(thId);
        }
        this.ensureScopeIsUnchanged(saveTransactionHoldDto, existing);
        await this.ensureUserExists(tx, saveTransactionHoldDto.thUserId);
        await this.ensureSessionExists(tx, saveTransactionHoldDto.thSessionId);
        const data: Prisma.TransactionHoldUncheckedUpdateInput = {
          thModifiedAt: new Date(),
          thModifiedBy: resolveActor(saveTransactionHoldDto.thModifiedBy, actor),
        };
        applyPresentFields(
          data,
          saveTransactionHoldDto,
          TRANSACTION_HOLD_OPTIONAL_FIELDS,
          TRANSACTION_HOLD_FIELD_TRANSFORMS,
        );
        // ux_th_hold_no covers the document type too, so changing EITHER half of
        // the pair can collide with a hold that was fine a moment ago — the
        // merged values are what the index will judge.
        const nextHoldNo = saveTransactionHoldDto.thHoldNo ?? existing.thHoldNo;
        const nextDocType = saveTransactionHoldDto.thDocType ?? existing.thDocType;
        if (nextHoldNo !== existing.thHoldNo || nextDocType !== existing.thDocType) {
          await this.ensureHoldNoIsUnique(
            tx,
            nextHoldNo,
            {
              thCompanyId: existing.thCompanyId,
              thBranchId: existing.thBranchId,
              thAccYear: existing.thAccYear,
              thDocType: nextDocType,
            },
            thId,
          );
        }
        if (saveTransactionHoldDto.thHoldNo !== undefined) {
          data.thHoldNo = saveTransactionHoldDto.thHoldNo;
        }
        if (saveTransactionHoldDto.thDeviceId !== undefined) {
          data.thDeviceId = saveTransactionHoldDto.thDeviceId;
        }
        this.ensureValuesAreAllowed(existing, data);
        const updated = await tx.transactionHold.update({ where: { thId }, data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: TRANSACTION_HOLD_TABLE_NAME,
            screenName: TRANSACTION_HOLD_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: thId,
            displayName: this.displayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: resolveActor(saveTransactionHoldDto.thModifiedBy, actor),
            notes: 'Hold updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  // A hold belongs to the company / branch / year it was parked in: re-scoping it
  // would move it out from under the hold number it holds and into another
  // year's list, so an update may resend the scope but never change it.
  private ensureScopeIsUnchanged(
    saveTransactionHoldDto: SaveTransactionHoldDto,
    existing: TransactionHold,
  ): void {
    const details: TransactionHoldErrorDetail[] = [];
    if (
      saveTransactionHoldDto.thCompanyId &&
      saveTransactionHoldDto.thCompanyId !== existing.thCompanyId
    ) {
      details.push({
        field: 'thCompanyId',
        message: `thCompanyId cannot be changed (stored value is ${existing.thCompanyId})`,
      });
    }
    if (
      saveTransactionHoldDto.thBranchId &&
      saveTransactionHoldDto.thBranchId !== existing.thBranchId
    ) {
      details.push({
        field: 'thBranchId',
        message: `thBranchId cannot be changed (stored value is ${existing.thBranchId})`,
      });
    }
    if (
      saveTransactionHoldDto.thAccYear !== undefined &&
      saveTransactionHoldDto.thAccYear !== existing.thAccYear
    ) {
      details.push({
        field: 'thAccYear',
        message: `thAccYear cannot be changed (stored value is ${existing.thAccYear.toString()})`,
      });
    }
    if (details.length > 0) {
      throwSalesBadRequest<TransactionHoldErrorDetail>('Hold scope is immutable', details);
    }
  }
  // Mirrors the DB-only partial unique index ux_th_hold_no — one live hold per
  // (company, branch, accounting year, document type, hold no). The predicate
  // (`WHERE th_is_deleted = false`) is what keeps Prisma from seeing the index,
  // so the rule is restated here to answer a 409 naming the field instead of a
  // raw 23505. Matched exactly, the way the index does: it is on the raw column,
  // not on lower(th_hold_no).
  private async ensureHoldNoIsUnique(
    tx: TransactionHoldWriteClient,
    thHoldNo: string,
    scope: TransactionHoldHoldNoScope,
    excludeThId?: string,
  ): Promise<void> {
    const existing = await tx.transactionHold.findFirst({
      where: {
        thIsDeleted: false,
        thCompanyId: scope.thCompanyId,
        thBranchId: scope.thBranchId,
        thAccYear: scope.thAccYear,
        thDocType: scope.thDocType,
        thHoldNo,
        ...(excludeThId ? { thId: { not: excludeThId } } : {}),
      },
      select: { thId: true },
    });
    if (existing) {
      throwSalesConflict<TransactionHoldErrorDetail>('Hold number already exists', [
        {
          field: 'thHoldNo',
          message:
            `A ${scope.thDocType} hold numbered ${thHoldNo} already exists for this ` +
            'company / branch / year',
        },
      ]);
    }
  }
  private async ensureCompanyExists(
    tx: TransactionHoldWriteClient,
    companyId: string,
  ): Promise<void> {
    const company = await tx.company.findFirst({
      where: { compId: companyId, compIsDeleted: false },
      select: { compId: true },
    });
    if (!company) {
      throwSalesBadRequest<TransactionHoldErrorDetail>('Company does not exist', [
        { field: 'thCompanyId', message: `No active company found with id ${companyId}` },
      ]);
    }
  }
  private async ensureBranchExists(
    tx: TransactionHoldWriteClient,
    branchId: string,
  ): Promise<void> {
    const branch = await tx.branchMaster.findFirst({
      where: { brId: branchId, brIsDeleted: false },
      select: { brId: true },
    });
    if (!branch) {
      throwSalesBadRequest<TransactionHoldErrorDetail>('Branch does not exist', [
        { field: 'thBranchId', message: `No active branch found with id ${branchId}` },
      ]);
    }
  }
  private async ensureUserExists(
    tx: TransactionHoldWriteClient,
    userId: string | null | undefined,
  ): Promise<void> {
    if (!userId) {
      return;
    }
    const user = await tx.userMaster.findFirst({
      where: { usrId: userId, usrIsDeleted: false },
      select: { usrId: true },
    });
    if (!user) {
      throwSalesBadRequest<TransactionHoldErrorDetail>('User does not exist', [
        { field: 'thUserId', message: `No active user found with id ${userId}` },
      ]);
    }
  }
  private async ensureSessionExists(
    tx: TransactionHoldWriteClient,
    sessionId: string | null | undefined,
  ): Promise<void> {
    if (!sessionId) {
      return;
    }
    const session = await tx.userLoginSession.findFirst({
      where: { ulsId: sessionId, ulsIsDeleted: false },
      select: { ulsId: true },
    });
    if (!session) {
      throwSalesBadRequest<TransactionHoldErrorDetail>('Login session does not exist', [
        { field: 'thSessionId', message: `No active login session found with id ${sessionId}` },
      ]);
    }
  }
  // transaction_hold has no CHECK constraints, so everything the columns imply is
  // enforced here — judged on the MERGED row (`data` carries the payload's
  // resolved values, the stored row supplies whatever it leaves out), since a
  // rule judges the row that will actually be written.
  private ensureValuesAreAllowed(
    existing: TransactionHold | undefined,
    data: Prisma.TransactionHoldUncheckedCreateInput | Prisma.TransactionHoldUncheckedUpdateInput,
  ): void {
    const details: TransactionHoldErrorDetail[] = [];
    const values: TransactionHoldGuardedValues = {
      thDocType: (data.thDocType as string | undefined) ?? existing?.thDocType,
      thStatus: (data.thStatus as string | undefined) ?? existing?.thStatus,
      thDeviceType: (data.thDeviceType as string | undefined) ?? existing?.thDeviceType,
      thConvertedDocType:
        (data.thConvertedDocType as string | null | undefined) ??
        existing?.thConvertedDocType ??
        undefined,
    };
    for (const guard of TRANSACTION_HOLD_VALUE_GUARDS) {
      const value = values[guard.field];
      if (value === undefined) {
        continue;
      }
      if (value === null) {
        if (!guard.nullable) {
          details.push({ field: guard.field, message: `${guard.field} is required` });
        }
        continue;
      }
      if (!(guard.allowed as readonly string[]).includes(value)) {
        details.push({
          field: guard.field,
          message: `${guard.field} must be one of: ${guard.allowed.join(', ')}`,
        });
      }
    }
    // ck_th_total_amount — the parked total is gross, never negative, even on a
    // SALE_RETURN hold (th_total_qty is the signed one and is left alone). The
    // DTO's @OptionalNumber(0) catches the payload; this catches the merged row.
    const totalAmount = this.mergedNumber(data.thTotalAmount, existing?.thTotalAmount);
    if (totalAmount !== null && totalAmount < 0) {
      details.push({
        field: 'thTotalAmount',
        message: 'thTotalAmount must be greater than or equal to 0',
      });
    }
    const holdDate = (data.thHoldDate as Date | undefined) ?? existing?.thHoldDate ?? null;
    const expiresAt =
      (data.thExpiresAt as Date | null | undefined) ?? existing?.thExpiresAt ?? null;
    if (holdDate && expiresAt && expiresAt.getTime() <= holdDate.getTime()) {
      details.push({
        field: 'thExpiresAt',
        message: 'thExpiresAt must be after thHoldDate',
      });
    }
    const convertedDocId =
      (data.thConvertedDocId as string | null | undefined) ?? existing?.thConvertedDocId ?? null;
    const convertedAt =
      (data.thConvertedAt as Date | null | undefined) ?? existing?.thConvertedAt ?? null;
    const convertedDocType = values.thConvertedDocType ?? null;
    const status = values.thStatus ?? TransactionHoldStatus.HELD;
    // ck_th_converted — once converted, the target document must be stamped:
    // both the id it became and the instant it happened.
    if (status === String(TransactionHoldStatus.CONVERTED)) {
      if (!convertedDocId) {
        details.push({
          field: 'thConvertedDocId',
          message: 'thConvertedDocId is required when thStatus is CONVERTED',
        });
      }
      if (!convertedAt) {
        details.push({
          field: 'thConvertedAt',
          message: 'thConvertedAt is required when thStatus is CONVERTED',
        });
      }
    }
    // Beyond the constraint: th_converted_doc_id is polymorphic, so an id with
    // no type leaves the reference unresolvable.
    if (convertedDocId && !convertedDocType) {
      details.push({
        field: 'thConvertedDocType',
        message: 'thConvertedDocType is required when thConvertedDocId is set',
      });
    }
    if (details.length > 0) {
      throwSalesBadRequest<TransactionHoldErrorDetail>('Invalid hold value', details);
    }
    // A finished hold stays finished: reopening a CONVERTED one would let the
    // same parked cart be billed twice, and reopening a CANCELLED / EXPIRED one
    // would resurrect a hold the till has already written off. Re-sending the
    // same terminal status is fine.
    if (
      existing &&
      TRANSACTION_HOLD_CLOSED_STATUSES.includes(existing.thStatus) &&
      status !== existing.thStatus
    ) {
      throwSalesConflict<TransactionHoldErrorDetail>('Hold is already closed', [
        {
          field: 'thStatus',
          message: `A hold in status ${existing.thStatus} cannot be reopened`,
        },
      ]);
    }
  }
  private buildListWhere(queryDto: ListTransactionHoldQueryDto): Prisma.TransactionHoldWhereInput {
    const filters: Prisma.TransactionHoldWhereInput[] = [];
    const search = queryDto.search?.trim();
    if (search) {
      filters.push({
        OR: [
          { thHoldNo: { contains: search, mode: 'insensitive' } },
          { thCustomerName: { contains: search, mode: 'insensitive' } },
          { thRemarks: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (queryDto.thCompanyId) filters.push({ thCompanyId: queryDto.thCompanyId });
    if (queryDto.thBranchId) filters.push({ thBranchId: queryDto.thBranchId });
    if (queryDto.thAccYear !== undefined) filters.push({ thAccYear: queryDto.thAccYear });
    if (queryDto.thCounterId) filters.push({ thCounterId: queryDto.thCounterId });
    if (queryDto.thSessionId) filters.push({ thSessionId: queryDto.thSessionId });
    if (queryDto.thUserId) filters.push({ thUserId: queryDto.thUserId });
    if (queryDto.thDeviceId) filters.push({ thDeviceId: queryDto.thDeviceId });
    if (queryDto.thDeviceType) filters.push({ thDeviceType: queryDto.thDeviceType });
    if (queryDto.thStatus) filters.push({ thStatus: queryDto.thStatus });
    if (queryDto.thDocType) filters.push({ thDocType: queryDto.thDocType });
    if (queryDto.holdDateFrom) {
      filters.push({ thHoldDate: { gte: this.parseDate(queryDto.holdDateFrom, 'holdDateFrom') } });
    }
    if (queryDto.holdDateTo) {
      filters.push({ thHoldDate: { lte: this.parseDate(queryDto.holdDateTo, 'holdDateTo') } });
    }
    if (queryDto.expired !== undefined) {
      const now = new Date();
      filters.push(
        queryDto.expired
          ? { thExpiresAt: { lt: now } }
          : // A hold without an expiry never lapses, so "still valid" has to keep it.
            { OR: [{ thExpiresAt: null }, { thExpiresAt: { gte: now } }] },
      );
    }
    return {
      thIsDeleted: false,
      ...(filters.length > 0 ? { AND: filters } : {}),
    };
  }
  private hasStructuredFilters(queryDto: ListTransactionHoldQueryDto): boolean {
    return (
      queryDto.thCompanyId !== undefined ||
      queryDto.thBranchId !== undefined ||
      queryDto.thAccYear !== undefined ||
      queryDto.thCounterId !== undefined ||
      queryDto.thSessionId !== undefined ||
      queryDto.thUserId !== undefined ||
      queryDto.thDeviceId !== undefined ||
      queryDto.thDeviceType !== undefined ||
      queryDto.thStatus !== undefined ||
      queryDto.thDocType !== undefined ||
      queryDto.holdDateFrom !== undefined ||
      queryDto.holdDateTo !== undefined ||
      queryDto.expired !== undefined
    );
  }
  // The value a numeric column will hold once the write lands: the payload's
  // when it sent one, the stored row's otherwise, and null when neither has one
  // (a create that leaves the column to its default).
  private mergedNumber(
    sent: unknown,
    stored: Prisma.Decimal | number | null | undefined,
  ): number | null {
    if (sent !== undefined && sent !== null) {
      const parsed = typeof sent === 'number' ? sent : Number(sent);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (stored !== undefined && stored !== null) {
      return toNumber(stored);
    }
    return null;
  }
  private parseDate(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throwSalesBadRequest<TransactionHoldErrorDetail>('Validation failed', [
        { field, message: `${field} must be a valid ISO-8601 date-time` },
      ]);
    }
    return parsed;
  }
  private requireField<T extends string>(value: T | undefined, field: string): T {
    if (!value) {
      throwSalesBadRequest<TransactionHoldErrorDetail>(`${field} is required`, [
        { field, message: `${field} must be provided when creating a hold` },
      ]);
    }
    return value;
  }
  private requireNumberField(value: number | undefined, field: string): number {
    if (value === undefined || value === null) {
      throwSalesBadRequest<TransactionHoldErrorDetail>(`${field} is required`, [
        { field, message: `${field} must be provided when creating a hold` },
      ]);
    }
    return value;
  }
  private handleWriteError(error: unknown): void {
    // ux_th_hold_no is the real authority; ensureHoldNoIsUnique only turns the
    // common case into a field-level 409. Two tills racing the same number can
    // still land here, so the constraint violation answers as the same 409
    // rather than a 500.
    throwOnUniqueConstraintError<TransactionHoldErrorDetail>(error, 'Hold number already exists', [
      {
        field: 'thHoldNo',
        message: 'Duplicate thHoldNo is not allowed for this company/branch/year/document type',
      },
    ]);
  }
  private throwNotFound(thId: string): never {
    throwSalesNotFound<TransactionHoldErrorDetail>(
      'Hold not found',
      'thId',
      `No active hold found with id ${thId}`,
    );
  }
  private displayName(record: TransactionHold): string {
    return record.thHoldNo?.trim() || record.thId;
  }
  // The th_* enum columns are varchar in Postgres, so Prisma reads them back as
  // plain strings and they are asserted to their enum here. Every write path
  // (this module's DTO + ensureValuesAreAllowed) keeps the stored values inside
  // the sets, so the assertion cannot invent a member that isn't there.
  private toPayload(record: TransactionHold): TransactionHoldPayload {
    return {
      thId: record.thId,
      thCompanyId: record.thCompanyId,
      thBranchId: record.thBranchId,
      thAccYear: record.thAccYear,
      thHoldNo: record.thHoldNo,
      thHoldDate: record.thHoldDate.toISOString(),
      thDocType: record.thDocType as TransactionHoldDocType,
      thCounterId: record.thCounterId,
      thSessionId: record.thSessionId,
      thUserId: record.thUserId,
      thDeviceId: record.thDeviceId,
      thDeviceType: record.thDeviceType as TransactionHoldDeviceType,
      thCustomerName: record.thCustomerName,
      thItemCount: record.thItemCount,
      thTotalQty: toNumber(record.thTotalQty),
      thTotalAmount: toNumber(record.thTotalAmount),
      thStatus: record.thStatus as TransactionHoldStatus,
      thHoldReason: record.thHoldReason,
      thRemarks: record.thRemarks,
      thExpiresAt: record.thExpiresAt ? record.thExpiresAt.toISOString() : null,
      thLockedBy: record.thLockedBy,
      thLockedAt: record.thLockedAt ? record.thLockedAt.toISOString() : null,
      thResumedBy: record.thResumedBy,
      thResumedAt: record.thResumedAt ? record.thResumedAt.toISOString() : null,
      thResumeCount: record.thResumeCount,
      thConvertedDocType: record.thConvertedDocType as TransactionHoldDocType | null,
      thConvertedDocId: record.thConvertedDocId,
      thConvertedNo: record.thConvertedNo,
      thConvertedAt: record.thConvertedAt ? record.thConvertedAt.toISOString() : null,
      thConvertedBy: record.thConvertedBy,
      thIsStockReserved: record.thIsStockReserved,
      thUiState: record.thUiState ?? null,
      thIsDeleted: record.thIsDeleted,
      thCreatedBy: record.thCreatedBy,
      thCreatedAt: record.thCreatedAt.toISOString(),
      thModifiedBy: record.thModifiedBy,
      thModifiedAt: record.thModifiedAt ? record.thModifiedAt.toISOString() : null,
    };
  }
}
