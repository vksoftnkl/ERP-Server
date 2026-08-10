import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, TxnHold } from '@prisma/client';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListTxnHoldQueryDto } from './dto/list-txn-hold-query.dto';
import { SaveTxnHoldDto } from './dto/save-txn-hold.dto';
import {
  TXN_HOLD_CLOSED_STATUSES,
  TXN_HOLD_IN_USE_STATUSES,
  TXN_HOLD_LOCK_TTL_SECONDS_DEFAULT,
  TXN_HOLD_VALUE_GUARDS,
  TxnHoldAutosaveScope,
  TxnHoldConversion,
  TxnHoldDeleteResult,
  TxnHoldDocType,
  TxnHoldErrorDetail,
  TxnHoldGuardedValues,
  TxnHoldHoldNoScope,
  TxnHoldKind,
  TxnHoldListItem,
  TxnHoldListMeta,
  TxnHoldLockScope,
  TxnHoldPartyType,
  TxnHoldPayload,
  TxnHoldScope,
  TxnHoldSlnoScope,
  TxnHoldSrcModule,
  TxnHoldStatus,
} from './types/txn-hold-api.types';
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
const TXN_HOLD_TABLE_NAME = 'txn hold';
const TXN_HOLD_AUDIT_SCREEN_NAME = 'Transaction Hold';
const TXN_HOLD_GRID_ALIAS = 'txn_hold_grid';
// txh_acc_year is CHAR(9) and is the partition key: 'YYYY-YYYY' is the only
// shape a partition bound is ever written with, so a malformed year is refused
// here rather than landing on "no partition of relation txn_hold found for row".
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
// Columns copied verbatim from the DTO (already normalized by its decorators)
// onto the create/update payload; only keys present on the request are applied,
// so a partial update stays partial. The scope (txhCompanyId / txhBranchId /
// txhAccYear), the document identity (txhHoldNo / txhHoldSlno / txhDeviceId /
// txhHeldBy) and the audit columns are resolved explicitly instead — they are
// required on create, or need a uniqueness check first.
//
// The LEASE block (txhLockedBy / txhLockedDeviceId / txhLockedOn /
// txhLockExpiresOn / txhLockToken) and the CONVERSION block
// (txhConvertedDocId / txhConvertedAccYear / txhConvertedRefno / txhConvertedOn
// / txhConvertedBy) are deliberately absent: ck_txh_lock_block and
// ck_txh_converted_block are all-or-nothing, so writing half a block through a
// partial CRUD payload can only ever produce a raw 23514. The resume / release /
// convert endpoints move them as whole blocks.
const TXN_HOLD_OPTIONAL_FIELDS = [
  'txhTenantId',
  'txhKind',
  'txhSrcModule',
  'txhDocType',
  'txhHoldOn',
  'txhCounterId',
  'txhSessionId',
  'txhPartyType',
  'txhPartyId',
  'txhPartyName',
  'txhPartyMobile',
  'txhStaffId',
  'txhRefLabel',
  'txhItemCount',
  'txhTotalQty',
  'txhNetAmount',
  'txhPayload',
  'txhPayloadVersion',
  'txhStatus',
  'txhHoldReason',
  'txhRemarks',
  'txhExpiresOn',
  'txhIsStockReserved',
  'txhPrintCount',
  'txhLastPrintedOn',
  'txhSyncDate',
];
// NOT NULL columns carrying a DB default: an explicit null is dropped rather
// than written, so the default (or the stored value on update) survives instead
// of the insert failing on a 23502.
const TXN_HOLD_DEFAULTED_FIELDS = [
  'txhKind',
  'txhHoldOn',
  'txhItemCount',
  'txhTotalQty',
  'txhNetAmount',
  'txhPayload',
  'txhPayloadVersion',
  'txhStatus',
  'txhIsStockReserved',
  'txhPrintCount',
];
// Nullable text columns — a blank string is stored as NULL rather than ''.
const TXN_HOLD_TEXT_FIELDS = [
  'txhPartyName',
  'txhPartyMobile',
  'txhRefLabel',
  'txhHoldReason',
  'txhRemarks',
];
function dropNullish(value: unknown): unknown {
  return value === null ? undefined : value;
}
const TXN_HOLD_FIELD_TRANSFORMS: Partial<Record<string, PresentFieldTransform>> = {
  ...Object.fromEntries(TXN_HOLD_DEFAULTED_FIELDS.map((field) => [field, dropNullish])),
  ...Object.fromEntries(
    TXN_HOLD_TEXT_FIELDS.map((field) => [
      field,
      (value: unknown) => normalizeNullableString(value as string | null | undefined),
    ]),
  ),
};
type TxnHoldWriteClient = SalesWriteClient;
/**
 * CRUD and lease handling over `public.txn_hold` — the parking bay for
 * half-finished transactional work: a sale the operator pressed Hold on, a
 * screen's own crash-recovery snapshot, or a saved template.
 *
 * The table stores no lines of its own. `txh_payload` carries the module's
 * whole save body as JSONB and the party columns plus the three roll-ups
 * (`txh_item_count` / `txh_total_qty` / `txh_net_amount`) are the summary the
 * pick list renders from, snapshotted at hold time. Nothing here reads into the
 * payload — it is stored and handed back verbatim.
 *
 * Two things shape every query below:
 *
 *  - The PRIMARY KEY is `(txh_id, txh_acc_year)`, because the table is
 *    LIST-partitioned by the accounting year. An id alone does not name a row,
 *    so writes resolve the year first (or take it from the caller, which prunes
 *    the lookup to one partition) and then key on the pair.
 *  - The DB carries 21 CHECK constraints and five partial indexes. The
 *    constraints are the authority; the rules restated here exist to answer a
 *    400 / 409 naming the field instead of a raw 23514 or 23505.
 */
@Injectable()
export class TxnHoldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveTxnHoldDto: SaveTxnHoldDto): Promise<TxnHoldPayload> {
    if (saveTxnHoldDto.txhId) {
      return this.updateHold(saveTxnHoldDto);
    }
    return this.createHold(saveTxnHoldDto);
  }
  async list(
    queryDto: ListTxnHoldQueryDto,
  ): Promise<ConfiguredGridListResult<TxnHoldListItem, TxnHoldListMeta>> {
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
          runConfiguredGridQuery<TxnHoldListItem>(this.configuredGridSqlService, {
            tableName: TXN_HOLD_TABLE_NAME,
            alias: TXN_HOLD_GRID_ALIAS,
            search: queryDto.search,
            page,
            limit,
            skip,
          }),
        countFn: () => this.prisma.txnHold.count({ where }),
        findManyFn: () =>
          this.prisma.txnHold.findMany({
            where,
            // The pick list is read newest first; the id breaks ties so paging
            // stays stable across two holds parked in the same instant.
            orderBy: [{ txhHoldOn: 'desc' }, { txhId: 'desc' }],
            skip,
            take: limit,
          }),
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }
  async getById(txhId: string, txhAccYear?: string): Promise<TxnHoldPayload> {
    const record = await this.prisma.txnHold.findFirst({
      where: { txhId, txhIsDeleted: false, ...(txhAccYear ? { txhAccYear } : {}) },
    });
    if (!record) {
      this.throwNotFound(txhId);
    }
    return this.toPayload(record);
  }
  async softDelete(txhId: string, txhAccYear?: string): Promise<TxnHoldDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.txnHold.findFirst({
        where: { txhId, txhIsDeleted: false, ...(txhAccYear ? { txhAccYear } : {}) },
      });
      if (!existing) {
        this.throwNotFound(txhId);
      }
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      // txh_status is left as it stands: a deleted hold that had already been
      // CONVERTED must keep saying so, and every read path filters on
      // txh_is_deleted anyway. Deleting also frees the hold number and the
      // device serial for reuse — both unique indexes are partial on
      // `txh_is_deleted = false`.
      const deleted = await tx.txnHold.update({
        where: this.pk(existing),
        data: {
          txhIsDeleted: true,
          txhModifiedOn: new Date(),
          txhModifiedBy: actor,
        },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: TXN_HOLD_TABLE_NAME,
          screenName: TXN_HOLD_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: txhId,
          displayName: this.displayName(existing),
          originalRecord: this.toPayload(existing),
          modifiedRecord: this.toPayload(deleted),
          userId: actor,
          branchId: existing.txhBranchId,
          notes: 'Hold soft deleted',
        },
        tx,
      );
      return { txhId, deleted: true };
    });
  }
  /**
   * Pull a parked hold onto a till and take its LEASE — `HELD` → `LOCKED`.
   *
   * The lease is held by the operator (`txh_locked_by`) on the device that took
   * it (`txh_locked_device_id`, the `X-Device-Id` header), and it ENDS:
   * `txh_lock_expires_on` is set from `lockTtlSeconds`, and once it has passed
   * the next device may resume the hold without a force-release. That is what
   * stops a till that died mid-edit from stranding a cart forever.
   *
   * Returns the whole hold, `txh_payload` and the fresh `txh_lock_token`
   * included, so the till can redraw the screen it is resuming and prove the
   * lease when it releases or converts it.
   *
   * The transition is a single conditional UPDATE (the status and the lease
   * expiry sit in the WHERE clause, not in a preceding SELECT), so two tills
   * racing the same parked bill serialize on the row: Postgres makes the loser
   * re-evaluate the predicate against the winner's committed row, it matches
   * nothing, and the loser is told who holds it. A read-then-update would let
   * both pass the check and both write.
   */
  async resumeHold(
    txhId: string,
    deviceId: string | undefined | null,
    scope: TxnHoldLockScope,
  ): Promise<TxnHoldPayload> {
    const device = this.requireDeviceId(deviceId);
    const operator = this.requireOperator();
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      // Read only to snapshot the "before" side of the audit entry (an update
      // log needs both sides) and to refuse a TEMPLATE. The conditional update
      // below is what decides whether this device gets the lease, so a row that
      // moves in between still lands on the right answer.
      const before = await this.readLocked(tx, txhId, scope);
      this.ensureKindIsLeasable(before);
      const expiresOn = this.leaseExpiry(now, scope.lockTtlSeconds);
      const token = randomUUID();
      const acquired = await tx.txnHold.updateMany({
        where: {
          ...this.lockWhere(txhId, scope),
          OR: [
            // Free.
            { txhStatus: TxnHoldStatus.HELD },
            // Or held under a lease that has already lapsed — the reaper's job,
            // done inline so the next operator is not blocked waiting for it.
            { txhStatus: TxnHoldStatus.LOCKED, txhLockExpiresOn: { lt: now } },
          ],
        },
        data: {
          txhStatus: TxnHoldStatus.LOCKED,
          txhLockedBy: operator,
          txhLockedDeviceId: device,
          txhLockedOn: now,
          txhLockExpiresOn: expiresOn,
          txhLockToken: token,
          txhResumedBy: operator,
          txhResumedOn: now,
          txhResumeCount: { increment: 1 },
          txhModifiedOn: now,
          txhModifiedBy: operator,
        },
      });
      if (acquired.count === 0) {
        return this.resolveResumeFailure(tx, txhId, device, scope);
      }
      const resumed = await this.readLocked(tx, txhId, scope);
      await this.auditLockTransition(tx, {
        original: before,
        modified: resumed,
        userId: operator,
        notes:
          `Hold resumed on device ${device}, lease until ${expiresOn.toISOString()}` +
          (before.txhStatus === String(TxnHoldStatus.LOCKED)
            ? `, taken over from a lapsed lease on device ${before.txhLockedDeviceId ?? 'unknown'}`
            : ''),
      });
      return this.toPayload(resumed);
    });
  }

  /**
   * Give the lease back without billing — `LOCKED` → `HELD`, so the next till
   * can recall the same parked work.
   *
   * Ownership is part of the WHERE clause (`txh_locked_device_id` = this
   * device, and `txh_lock_token` too when the caller sends one) rather than a
   * check before it, so a device can never release a lease another device
   * holds, whatever it sends.
   */
  async releaseHold(
    txhId: string,
    deviceId: string | undefined | null,
    scope: TxnHoldLockScope,
  ): Promise<TxnHoldPayload> {
    const device = this.requireDeviceId(deviceId);
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const before = await tx.txnHold.findFirst({ where: this.lockWhere(txhId, scope) });
      const released = await tx.txnHold.updateMany({
        where: {
          ...this.lockWhere(txhId, scope),
          txhStatus: TxnHoldStatus.LOCKED,
          txhLockedDeviceId: device,
          ...(scope.txhLockToken ? { txhLockToken: scope.txhLockToken } : {}),
        },
        // The whole lease block is cleared together — ck_txh_lock_block accepts
        // all five columns set or all five null, nothing in between.
        data: {
          txhStatus: TxnHoldStatus.HELD,
          ...this.emptyLease(),
          txhModifiedOn: now,
          txhModifiedBy: actor,
        },
        // txh_resumed_by / txh_resumed_on and txh_resume_count are the history
        // of who pulled it and how often — releasing the lease does not erase
        // that.
      });
      if (released.count === 0) {
        return this.resolveReleaseFailure(tx, txhId, scope);
      }
      const free = await this.readLocked(tx, txhId, scope);
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
   * Take the lease away from the device holding it — `LOCKED` → `HELD` WITHOUT
   * the ownership check.
   *
   * A lease already expires on its own, so this is for the case that cannot
   * wait: a till holding a live lease on a cart the floor needs back now. It is
   * deliberately a separate route rather than a flag on `releaseHold` — it
   * interrupts whoever is on the hold, and the audit entry names both devices
   * so it can be answered for afterwards.
   *
   * Everything else still holds: it is the same conditional update (a hold that
   * is already CONVERTED cannot be forced back open), the same tenant scope,
   * and an already-free hold is a no-op rather than an error.
   */
  async forceReleaseHold(
    txhId: string,
    deviceId: string | undefined | null,
    scope: TxnHoldLockScope,
  ): Promise<TxnHoldPayload> {
    const device = this.requireDeviceId(deviceId);
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const before = await tx.txnHold.findFirst({ where: this.lockWhere(txhId, scope) });
      const taken = await tx.txnHold.updateMany({
        where: {
          ...this.lockWhere(txhId, scope),
          // No device or token predicate — that is the whole point — but the
          // status one stays, so this can only ever free a hold that is
          // genuinely in use, never reopen a closed one. RESUMED is in the set
          // because it is what "in use" means for a row driven through the CRUD
          // route: it would otherwise be stuck for good, un-resumable (409) and
          // un-releasable (403).
          txhStatus: { in: [...TXN_HOLD_IN_USE_STATUSES] },
        },
        data: {
          txhStatus: TxnHoldStatus.HELD,
          ...this.emptyLease(),
          txhModifiedOn: now,
          txhModifiedBy: actor,
        },
      });
      if (taken.count === 0) {
        return this.resolveReleaseFailure(tx, txhId, scope);
      }
      const free = await this.readLocked(tx, txhId, scope);
      await this.auditLockTransition(tx, {
        original: before,
        modified: free,
        userId: actor,
        // Both sides on the record: who took it, and who lost it.
        notes:
          `Hold lease force released by device ${device}` +
          (before?.txhLockedDeviceId ? `, taken from device ${before.txhLockedDeviceId}` : ''),
      });
      return this.toPayload(free);
    });
  }

  /**
   * Close a hold onto the document it became — `LOCKED` → `CONVERTED`, the
   * terminal state. Stamps the conversion trail and drops the lease, so nothing
   * can resume the hold again and the parked work cannot be billed twice.
   *
   * There is no converted doc TYPE to send: a hold becomes the document it was
   * parked as, so the stored `txh_doc_type` already names the table
   * `txh_converted_doc_id` points into. The YEAR does travel with the id — a
   * March hold can become an April document — and ck_txh_converted_block wants
   * the whole trail (id + year + when + who) or none of it.
   *
   * Ownership is in the WHERE clause exactly as it is on release: only the
   * device holding the lease may bill it.
   */
  async convertHold(
    txhId: string,
    deviceId: string | undefined | null,
    scope: TxnHoldLockScope,
    conversion: TxnHoldConversion,
  ): Promise<TxnHoldPayload> {
    const device = this.requireDeviceId(deviceId);
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    this.ensureConversionIsAllowed(conversion);
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const before = await tx.txnHold.findFirst({ where: this.lockWhere(txhId, scope) });
      const converted = await tx.txnHold.updateMany({
        where: {
          ...this.lockWhere(txhId, scope),
          txhStatus: TxnHoldStatus.LOCKED,
          txhLockedDeviceId: device,
          ...(scope.txhLockToken ? { txhLockToken: scope.txhLockToken } : {}),
        },
        data: {
          txhStatus: TxnHoldStatus.CONVERTED,
          txhConvertedDocId: conversion.txhConvertedDocId,
          txhConvertedAccYear: conversion.txhConvertedAccYear,
          txhConvertedRefno: normalizeNullableString(conversion.txhConvertedRefno) ?? null,
          txhConvertedOn: now,
          txhConvertedBy: resolveActor(conversion.txhConvertedBy, actor),
          // The hold is finished with, so the lease is dropped rather than left
          // pointing at a till that has moved on.
          ...this.emptyLease(),
          txhModifiedOn: now,
          txhModifiedBy: actor,
        },
      });
      if (converted.count === 0) {
        return this.resolveConvertFailure(tx, txhId, scope);
      }
      const closed = await this.readLocked(tx, txhId, scope);
      await this.auditLockTransition(tx, {
        original: before,
        modified: closed,
        userId: actor,
        notes:
          `Hold converted to ${closed.txhDocType} ${conversion.txhConvertedDocId} ` +
          `(${conversion.txhConvertedAccYear}) on device ${device}`,
      });
      return this.toPayload(closed);
    });
  }

  // Nothing acquired the lease. The row is read back to say WHY, which is also
  // where re-entrancy is settled: a device asking for a hold it already holds
  // gets the screen back rather than a 409, so a retried request (dropped
  // response, double tap on the recall list) is harmless. It deliberately does
  // NOT bump txh_resume_count a second time — the count is how often the hold
  // moved between tills, not how often the button was pressed — and it does not
  // extend the lease either, so a stuck till cannot hold a cart by retrying.
  private async resolveResumeFailure(
    tx: TxnHoldWriteClient,
    txhId: string,
    device: string,
    scope: TxnHoldLockScope,
  ): Promise<TxnHoldPayload> {
    const current = await this.readLocked(tx, txhId, scope);
    if (
      current.txhStatus === String(TxnHoldStatus.LOCKED) &&
      current.txhLockedDeviceId === device
    ) {
      return this.toPayload(current);
    }
    if (current.txhStatus === String(TxnHoldStatus.LOCKED)) {
      throwSalesConflict<TxnHoldErrorDetail>(
        `Hold is LOCKED by device ${current.txhLockedDeviceId ?? 'unknown'}`,
        [
          {
            field: 'txhLockedDeviceId',
            message:
              `The hold is in use on device ${current.txhLockedDeviceId ?? 'unknown'} until ` +
              `${current.txhLockExpiresOn?.toISOString() ?? 'the lease is released'}. It has to ` +
              'be released there, expire, or be force-released before another device can ' +
              'resume it',
          },
        ],
      );
    }
    throwSalesConflict<TxnHoldErrorDetail>(`Hold is ${current.txhStatus} and cannot be resumed`, [
      {
        field: 'txhStatus',
        message: `Only a hold in status ${TxnHoldStatus.HELD} can be resumed`,
      },
    ]);
  }

  // The release did not match. Being already HELD is not a failure — the caller
  // asked for the state the row is already in (a retried release), so it gets
  // the row back. Anything else means this device does not hold the lease.
  private async resolveReleaseFailure(
    tx: TxnHoldWriteClient,
    txhId: string,
    scope: TxnHoldLockScope,
  ): Promise<TxnHoldPayload> {
    const current = await this.readLocked(tx, txhId, scope);
    if (current.txhStatus === String(TxnHoldStatus.HELD)) {
      return this.toPayload(current);
    }
    this.throwLockOwnershipFailure(current, 'released');
  }

  // The conversion did not match. Unlike release there is no idempotent path: a
  // hold that is not leased by this device must not be billed by it, and a hold
  // already CONVERTED must not be billed twice.
  private async resolveConvertFailure(
    tx: TxnHoldWriteClient,
    txhId: string,
    scope: TxnHoldLockScope,
  ): Promise<never> {
    const current = await this.readLocked(tx, txhId, scope);
    this.throwLockOwnershipFailure(current, 'converted');
  }

  // 409 when the hold is finished with (retrying will never help), 403 when it
  // is simply leased by someone else or by nobody — the request is well formed,
  // the lease just is not this device's to spend.
  private throwLockOwnershipFailure(current: TxnHold, action: string): never {
    if (TXN_HOLD_CLOSED_STATUSES.includes(current.txhStatus)) {
      throwSalesConflict<TxnHoldErrorDetail>('Hold is already closed', [
        {
          field: 'txhStatus',
          message: `A hold in status ${current.txhStatus} cannot be ${action}`,
        },
      ]);
    }
    throwSalesForbidden<TxnHoldErrorDetail>('Not leased by this device', [
      {
        field: 'txhLockedDeviceId',
        message: current.txhLockedDeviceId
          ? `The hold is leased by device ${current.txhLockedDeviceId}, so only that device can ` +
            `have it ${action}`
          : `The hold is ${current.txhStatus} and has to be resumed on this device before it ` +
            `can be ${action}`,
      },
    ]);
  }

  // Every lease query is keyed on the tenant scope and skips soft-deleted rows,
  // so a hold can be neither taken nor spent from another company or branch. The
  // accounting year is optional and additive: when the caller knows it, Postgres
  // prunes to that one partition instead of scanning every year on record.
  private lockWhere(txhId: string, scope: TxnHoldLockScope): Prisma.TxnHoldWhereInput {
    return {
      txhId,
      txhCompanyId: scope.txhCompanyId,
      txhBranchId: scope.txhBranchId,
      txhIsDeleted: false,
      ...(scope.txhAccYear ? { txhAccYear: scope.txhAccYear } : {}),
    };
  }

  private async readLocked(
    tx: TxnHoldWriteClient,
    txhId: string,
    scope: TxnHoldLockScope,
  ): Promise<TxnHold> {
    const record = await tx.txnHold.findFirst({ where: this.lockWhere(txhId, scope) });
    if (!record) {
      // Unknown id, soft deleted, wrong year, or living in another company /
      // branch — all of them "no such hold here", which is also what keeps a
      // wrong-tenant probe from confirming the row exists.
      this.throwNotFound(txhId);
    }
    return record;
  }

  // The composite primary key. txn_hold is partitioned by txh_acc_year, so the
  // year is half the key and an id on its own cannot address a row.
  private pk(record: TxnHold): Prisma.TxnHoldWhereUniqueInput {
    return { txhId_txhAccYear: { txhId: record.txhId, txhAccYear: record.txhAccYear } };
  }

  // ck_txh_lock_block: all five lease columns set, or all five null.
  private emptyLease(): Prisma.TxnHoldUncheckedUpdateInput {
    return {
      txhLockedBy: null,
      txhLockedDeviceId: null,
      txhLockedOn: null,
      txhLockExpiresOn: null,
      txhLockToken: null,
    };
  }

  private leaseExpiry(now: Date, lockTtlSeconds: number | undefined): Date {
    const ttl = lockTtlSeconds ?? TXN_HOLD_LOCK_TTL_SECONDS_DEFAULT;
    return new Date(now.getTime() + ttl * 1000);
  }

  // A TEMPLATE is copied on resume and never consumed, so leasing one would
  // take a starting point out of circulation. The caller reads it and creates
  // its own hold from the payload instead.
  private ensureKindIsLeasable(record: TxnHold): void {
    if (record.txhKind === String(TxnHoldKind.TEMPLATE)) {
      throwSalesBadRequest<TxnHoldErrorDetail>('Templates cannot be leased', [
        {
          field: 'txhKind',
          message:
            'A TEMPLATE is copied on resume, not locked. Read it and create a new hold from its ' +
            'payload instead',
        },
      ]);
    }
  }

  // txh_locked_device_id is what release and convert compare against, and it is
  // a uuid FK to fixed.device_master — so the header has to be a device id, not
  // a free-text till name as it was on the old transaction_hold table.
  private requireDeviceId(deviceId: string | undefined | null): string {
    const trimmed = deviceId?.trim();
    if (!trimmed) {
      throwSalesBadRequest<TxnHoldErrorDetail>('Device id is required', [
        {
          field: 'txhDeviceId',
          message: 'The X-Device-Id header must be sent to resume, release or convert a hold',
        },
      ]);
    }
    if (!this.isUuid(trimmed)) {
      throwSalesBadRequest<TxnHoldErrorDetail>('Device id is not a uuid', [
        {
          field: 'txhDeviceId',
          message: 'The X-Device-Id header must be a fixed.device_master uuid (dev_id)',
        },
      ]);
    }
    return trimmed;
  }

  // txh_locked_by / txh_resumed_by are uuid columns, so an unauthenticated
  // caller cannot take a lease: there would be nobody to name as the holder.
  private requireOperator(): string {
    const userId = this.requestContextService.getUserId();
    if (!userId || !this.isUuid(userId)) {
      throwSalesBadRequest<TxnHoldErrorDetail>('Operator is required', [
        {
          field: 'txhLockedBy',
          message: 'A hold can only be leased by an authenticated user',
        },
      ]);
    }
    return userId;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  // The DTO already rejects a malformed conversion, but the service is exported
  // for the till flow that raises the document and calls convertHold directly,
  // so the rule is restated where the write happens.
  private ensureConversionIsAllowed(conversion: TxnHoldConversion): void {
    const details: TxnHoldErrorDetail[] = [];
    if (!conversion.txhConvertedDocId) {
      details.push({
        field: 'txhConvertedDocId',
        message: 'txhConvertedDocId is required when converting a hold',
      });
    }
    if (!ACC_YEAR_PATTERN.test(conversion.txhConvertedAccYear ?? '')) {
      details.push({
        field: 'txhConvertedAccYear',
        message: 'txhConvertedAccYear is required when converting a hold, as YYYY-YYYY',
      });
    }
    if (details.length > 0) {
      throwSalesBadRequest<TxnHoldErrorDetail>('Invalid conversion', details);
    }
  }

  private async auditLockTransition(
    tx: TxnHoldWriteClient,
    entry: {
      original: TxnHold | null;
      modified: TxnHold;
      userId: string;
      notes: string;
    },
  ): Promise<void> {
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: TXN_HOLD_TABLE_NAME,
        screenName: TXN_HOLD_AUDIT_SCREEN_NAME,
        screenType: 'transaction',
        pk: entry.modified.txhId,
        displayName: this.displayName(entry.modified),
        // The snapshot was taken before the conditional update; on the vanishing
        // chance the row moved in between, the stored row is the honest "after"
        // and standing in the "before" keeps the entry writable either way.
        originalRecord: this.toPayload(entry.original ?? entry.modified),
        modifiedRecord: this.toPayload(entry.modified),
        userId: entry.userId,
        branchId: entry.modified.txhBranchId,
        notes: entry.notes,
      },
      tx as Prisma.TransactionClient,
    );
  }

  private async createHold(saveTxnHoldDto: SaveTxnHoldDto): Promise<TxnHoldPayload> {
    const now = new Date();
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const scope: TxnHoldScope = {
      txhCompanyId: this.requireField(saveTxnHoldDto.txhCompanyId, 'txhCompanyId'),
      txhBranchId: this.requireField(saveTxnHoldDto.txhBranchId, 'txhBranchId'),
      txhAccYear: this.requireAccYear(saveTxnHoldDto.txhAccYear, 'txhAccYear'),
    };
    const txhSrcModule = this.requireField(saveTxnHoldDto.txhSrcModule, 'txhSrcModule');
    const txhDocType = this.requireField(saveTxnHoldDto.txhDocType, 'txhDocType');
    const txhHoldNo = this.requireField(saveTxnHoldDto.txhHoldNo, 'txhHoldNo');
    const txhHoldSlno = this.requireNumberField(saveTxnHoldDto.txhHoldSlno, 'txhHoldSlno');
    const txhDeviceId = this.requireField(saveTxnHoldDto.txhDeviceId, 'txhDeviceId');
    const txhHeldBy = this.requireField(saveTxnHoldDto.txhHeldBy, 'txhHeldBy');
    const txhPayload = this.requirePayload(saveTxnHoldDto.txhPayload);
    const txhKind = saveTxnHoldDto.txhKind ?? TxnHoldKind.HOLD;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureCompanyExists(tx, scope.txhCompanyId);
        await this.ensureBranchExists(tx, scope.txhBranchId);
        await this.ensureDeviceExists(tx, txhDeviceId);
        await this.ensureUserExists(tx, txhHeldBy, 'txhHeldBy');
        await this.ensureSessionExists(tx, saveTxnHoldDto.txhSessionId);
        await this.ensureStaffExists(tx, saveTxnHoldDto.txhStaffId);
        // A crash-recovery snapshot is an UPSERT, not an insert: ux_txh_autosave
        // allows one live AUTOSAVE per (year, device, operator, document type),
        // and the screen posts a fresh one every few seconds. Overwriting in
        // place is what keeps the table from growing without bound.
        if (txhKind === TxnHoldKind.AUTOSAVE) {
          const live = await this.findLiveAutosave(tx, {
            txhAccYear: scope.txhAccYear,
            txhDeviceId,
            txhHeldBy,
            txhDocType,
          });
          if (live) {
            return this.overwriteAutosave(tx, live, saveTxnHoldDto, now, actor);
          }
        }
        await this.ensureHoldNoIsUnique(tx, txhHoldNo, { ...scope, txhDocType });
        await this.ensureHoldSlnoIsUnique(tx, txhHoldSlno, { ...scope, txhDocType, txhDeviceId });
        const data: Prisma.TxnHoldUncheckedCreateInput = {
          txhCompanyId: scope.txhCompanyId,
          txhBranchId: scope.txhBranchId,
          txhAccYear: scope.txhAccYear,
          txhSrcModule,
          txhDocType,
          txhHoldNo,
          txhHoldSlno,
          txhDeviceId,
          txhHeldBy,
          txhPayload,
          txhCreatedOn: now,
          txhCreatedBy: resolveActor(saveTxnHoldDto.txhCreatedBy, actor),
        };
        applyPresentFields(
          data,
          saveTxnHoldDto,
          TXN_HOLD_OPTIONAL_FIELDS,
          TXN_HOLD_FIELD_TRANSFORMS,
        );
        // Written after the bulk copy rather than with it: an omitted hold
        // instant has to land on `now` instead of the column default, so the
        // guards below and the returned payload judge the instant the row will
        // carry.
        data.txhHoldOn = saveTxnHoldDto.txhHoldOn ?? now;
        this.ensureValuesAreAllowed(undefined, data);
        const created = await tx.txnHold.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: TXN_HOLD_TABLE_NAME,
            screenName: TXN_HOLD_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: payload.txhId,
            displayName: this.displayName(created),
            originalRecord: null,
            modifiedRecord: payload,
            userId: created.txhCreatedBy,
            branchId: created.txhBranchId,
            notes: `${created.txhKind} created`,
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
  private async updateHold(saveTxnHoldDto: SaveTxnHoldDto): Promise<TxnHoldPayload> {
    const txhId = saveTxnHoldDto.txhId!;
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.txnHold.findFirst({
          where: {
            txhId,
            txhIsDeleted: false,
            ...(saveTxnHoldDto.txhAccYear ? { txhAccYear: saveTxnHoldDto.txhAccYear } : {}),
          },
        });
        if (!existing) {
          this.throwNotFound(txhId);
        }
        this.ensureScopeIsUnchanged(saveTxnHoldDto, existing);
        await this.ensureUserExists(tx, saveTxnHoldDto.txhHeldBy, 'txhHeldBy');
        await this.ensureSessionExists(tx, saveTxnHoldDto.txhSessionId);
        await this.ensureStaffExists(tx, saveTxnHoldDto.txhStaffId);
        if (saveTxnHoldDto.txhDeviceId !== undefined) {
          await this.ensureDeviceExists(tx, saveTxnHoldDto.txhDeviceId);
        }
        const data: Prisma.TxnHoldUncheckedUpdateInput = {
          txhModifiedOn: new Date(),
          txhModifiedBy: resolveActor(saveTxnHoldDto.txhModifiedBy, actor),
        };
        applyPresentFields(
          data,
          saveTxnHoldDto,
          TXN_HOLD_OPTIONAL_FIELDS,
          TXN_HOLD_FIELD_TRANSFORMS,
        );
        // Both unique indexes are keyed on the document type, so changing EITHER
        // half of a pair can collide with a row that was fine a moment ago — the
        // merged values are what the index will judge.
        const nextDocType = saveTxnHoldDto.txhDocType ?? existing.txhDocType;
        const nextHoldNo = saveTxnHoldDto.txhHoldNo ?? existing.txhHoldNo;
        const nextSlno = saveTxnHoldDto.txhHoldSlno ?? existing.txhHoldSlno;
        const nextDeviceId = saveTxnHoldDto.txhDeviceId ?? existing.txhDeviceId;
        const holdNoScope: TxnHoldHoldNoScope = {
          txhCompanyId: existing.txhCompanyId,
          txhBranchId: existing.txhBranchId,
          txhAccYear: existing.txhAccYear,
          txhDocType: nextDocType,
        };
        if (nextHoldNo !== existing.txhHoldNo || nextDocType !== existing.txhDocType) {
          await this.ensureHoldNoIsUnique(tx, nextHoldNo, holdNoScope, txhId);
        }
        if (
          nextSlno !== existing.txhHoldSlno ||
          nextDocType !== existing.txhDocType ||
          nextDeviceId !== existing.txhDeviceId
        ) {
          await this.ensureHoldSlnoIsUnique(
            tx,
            nextSlno,
            { ...holdNoScope, txhDeviceId: nextDeviceId },
            txhId,
          );
        }
        if (saveTxnHoldDto.txhHoldNo !== undefined) {
          data.txhHoldNo = saveTxnHoldDto.txhHoldNo;
        }
        if (saveTxnHoldDto.txhHoldSlno !== undefined) {
          data.txhHoldSlno = saveTxnHoldDto.txhHoldSlno;
        }
        if (saveTxnHoldDto.txhDeviceId !== undefined) {
          data.txhDeviceId = saveTxnHoldDto.txhDeviceId;
        }
        if (saveTxnHoldDto.txhHeldBy !== undefined) {
          data.txhHeldBy = saveTxnHoldDto.txhHeldBy;
        }
        // Every overwrite of the same parked work is a new revision, so an
        // offline till that re-syncs an older snapshot loses to the higher one.
        data.txhRevision = { increment: 1 };
        this.ensureValuesAreAllowed(existing, data);
        const updated = await tx.txnHold.update({ where: this.pk(existing), data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: TXN_HOLD_TABLE_NAME,
            screenName: TXN_HOLD_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: txhId,
            displayName: this.displayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: resolveActor(saveTxnHoldDto.txhModifiedBy, actor),
            branchId: updated.txhBranchId,
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
  // The live crash-recovery snapshot for one screen, if there is one — the row
  // ux_txh_autosave allows exactly one of.
  private async findLiveAutosave(
    tx: TxnHoldWriteClient,
    scope: TxnHoldAutosaveScope,
  ): Promise<TxnHold | null> {
    return tx.txnHold.findFirst({
      where: {
        txhKind: TxnHoldKind.AUTOSAVE,
        txhStatus: TxnHoldStatus.HELD,
        txhIsDeleted: false,
        txhAccYear: scope.txhAccYear,
        txhDeviceId: scope.txhDeviceId,
        txhHeldBy: scope.txhHeldBy,
        txhDocType: scope.txhDocType,
      },
    });
  }
  // Overwrite the snapshot in place and bump txh_revision. The identity the row
  // was created with — hold number, device serial, company / branch — is NOT
  // touched: the screen is re-posting the same parked work, not a new one, and
  // rewriting the number would need both unique indexes re-checked for nothing.
  private async overwriteAutosave(
    tx: TxnHoldWriteClient,
    live: TxnHold,
    saveTxnHoldDto: SaveTxnHoldDto,
    now: Date,
    actor: string,
  ): Promise<TxnHoldPayload> {
    const data: Prisma.TxnHoldUncheckedUpdateInput = {
      txhRevision: { increment: 1 },
      txhHoldOn: saveTxnHoldDto.txhHoldOn ?? now,
      txhModifiedOn: now,
      txhModifiedBy: resolveActor(saveTxnHoldDto.txhModifiedBy, actor),
    };
    applyPresentFields(data, saveTxnHoldDto, TXN_HOLD_OPTIONAL_FIELDS, TXN_HOLD_FIELD_TRANSFORMS);
    // The screen may not move its own snapshot out of AUTOSAVE / HELD — that is
    // what makes the next post find and overwrite this row instead of colliding
    // with it on ux_txh_autosave.
    delete data.txhKind;
    delete data.txhStatus;
    this.ensureValuesAreAllowed(live, data);
    const updated = await tx.txnHold.update({ where: this.pk(live), data });
    const payload = this.toPayload(updated);
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: TXN_HOLD_TABLE_NAME,
        screenName: TXN_HOLD_AUDIT_SCREEN_NAME,
        screenType: 'transaction',
        pk: updated.txhId,
        displayName: this.displayName(updated),
        originalRecord: this.toPayload(live),
        modifiedRecord: payload,
        userId: resolveActor(saveTxnHoldDto.txhModifiedBy, actor),
        branchId: updated.txhBranchId,
        notes: `Autosave overwritten, revision ${updated.txhRevision}`,
      },
      tx as Prisma.TransactionClient,
    );
    return payload;
  }
  // A hold belongs to the company / branch / year it was parked in. The year is
  // half the primary key AND the partition key, so changing it would mean moving
  // the row to another partition under a new identity: an update may resend the
  // scope but never change it.
  private ensureScopeIsUnchanged(saveTxnHoldDto: SaveTxnHoldDto, existing: TxnHold): void {
    const details: TxnHoldErrorDetail[] = [];
    if (saveTxnHoldDto.txhCompanyId && saveTxnHoldDto.txhCompanyId !== existing.txhCompanyId) {
      details.push({
        field: 'txhCompanyId',
        message: `txhCompanyId cannot be changed (stored value is ${existing.txhCompanyId})`,
      });
    }
    if (saveTxnHoldDto.txhBranchId && saveTxnHoldDto.txhBranchId !== existing.txhBranchId) {
      details.push({
        field: 'txhBranchId',
        message: `txhBranchId cannot be changed (stored value is ${existing.txhBranchId})`,
      });
    }
    if (saveTxnHoldDto.txhAccYear && saveTxnHoldDto.txhAccYear !== existing.txhAccYear.trim()) {
      details.push({
        field: 'txhAccYear',
        message: `txhAccYear cannot be changed (stored value is ${existing.txhAccYear.trim()})`,
      });
    }
    if (details.length > 0) {
      throwSalesBadRequest<TxnHoldErrorDetail>('Hold scope is immutable', details);
    }
  }
  // Mirrors the DB-only partial unique index ux_txh_hold_no — one live hold per
  // (company, branch, accounting year, document type, hold no). The predicate
  // (`WHERE txh_is_deleted = false`) is what keeps Prisma from seeing the index,
  // so the rule is restated here to answer a 409 naming the field instead of a
  // raw 23505. Matched exactly, the way the index does: on the raw column, which
  // ck_txh_hold_no_shape has already forced to upper case.
  private async ensureHoldNoIsUnique(
    tx: TxnHoldWriteClient,
    txhHoldNo: string,
    scope: TxnHoldHoldNoScope,
    excludeTxhId?: string,
  ): Promise<void> {
    const existing = await tx.txnHold.findFirst({
      where: {
        txhIsDeleted: false,
        txhCompanyId: scope.txhCompanyId,
        txhBranchId: scope.txhBranchId,
        txhAccYear: scope.txhAccYear,
        txhDocType: scope.txhDocType,
        txhHoldNo,
        ...(excludeTxhId ? { txhId: { not: excludeTxhId } } : {}),
      },
      select: { txhId: true },
    });
    if (existing) {
      throwSalesConflict<TxnHoldErrorDetail>('Hold number already exists', [
        {
          field: 'txhHoldNo',
          message:
            `A ${scope.txhDocType} hold numbered ${txhHoldNo} already exists for this ` +
            'company / branch / year',
        },
      ]);
    }
  }
  // The same, for ux_txh_device_slno: the offline series each device numbers its
  // own holds with. Separate from the hold number because two tills may print
  // the same token number from different series.
  private async ensureHoldSlnoIsUnique(
    tx: TxnHoldWriteClient,
    txhHoldSlno: number,
    scope: TxnHoldSlnoScope,
    excludeTxhId?: string,
  ): Promise<void> {
    const existing = await tx.txnHold.findFirst({
      where: {
        txhIsDeleted: false,
        txhCompanyId: scope.txhCompanyId,
        txhBranchId: scope.txhBranchId,
        txhAccYear: scope.txhAccYear,
        txhDeviceId: scope.txhDeviceId,
        txhDocType: scope.txhDocType,
        txhHoldSlno,
        ...(excludeTxhId ? { txhId: { not: excludeTxhId } } : {}),
      },
      select: { txhId: true },
    });
    if (existing) {
      throwSalesConflict<TxnHoldErrorDetail>('Hold serial already exists', [
        {
          field: 'txhHoldSlno',
          message:
            `Device ${scope.txhDeviceId} has already used serial ${txhHoldSlno} for a ` +
            `${scope.txhDocType} hold this year`,
        },
      ]);
    }
  }
  private async ensureCompanyExists(tx: TxnHoldWriteClient, companyId: string): Promise<void> {
    const company = await tx.company.findFirst({
      where: { compId: companyId, compIsDeleted: false },
      select: { compId: true },
    });
    if (!company) {
      throwSalesBadRequest<TxnHoldErrorDetail>('Company does not exist', [
        { field: 'txhCompanyId', message: `No active company found with id ${companyId}` },
      ]);
    }
  }
  private async ensureBranchExists(tx: TxnHoldWriteClient, branchId: string): Promise<void> {
    const branch = await tx.branchMaster.findFirst({
      where: { brId: branchId, brIsDeleted: false },
      select: { brId: true },
    });
    if (!branch) {
      throwSalesBadRequest<TxnHoldErrorDetail>('Branch does not exist', [
        { field: 'txhBranchId', message: `No active branch found with id ${branchId}` },
      ]);
    }
  }
  // fk_txh_device is RESTRICT, so the device row must exist — and a blocked till
  // may not park new work, which the FK cannot say.
  private async ensureDeviceExists(tx: TxnHoldWriteClient, deviceId: string): Promise<void> {
    const device = await tx.deviceMaster.findFirst({
      where: { devId: deviceId, devIsDeleted: false },
      select: { devId: true, devIsBlocked: true },
    });
    if (!device) {
      throwSalesBadRequest<TxnHoldErrorDetail>('Device does not exist', [
        { field: 'txhDeviceId', message: `No active device found with id ${deviceId}` },
      ]);
    }
    if (device.devIsBlocked) {
      throwSalesForbidden<TxnHoldErrorDetail>('Device is blocked', [
        { field: 'txhDeviceId', message: `Device ${deviceId} is blocked and cannot park work` },
      ]);
    }
  }
  private async ensureUserExists(
    tx: TxnHoldWriteClient,
    userId: string | null | undefined,
    field: string,
  ): Promise<void> {
    if (!userId) {
      return;
    }
    const user = await tx.userMaster.findFirst({
      where: { usrId: userId, usrIsDeleted: false },
      select: { usrId: true },
    });
    if (!user) {
      throwSalesBadRequest<TxnHoldErrorDetail>('User does not exist', [
        { field, message: `No active user found with id ${userId}` },
      ]);
    }
  }
  private async ensureSessionExists(
    tx: TxnHoldWriteClient,
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
      throwSalesBadRequest<TxnHoldErrorDetail>('Login session does not exist', [
        { field: 'txhSessionId', message: `No active login session found with id ${sessionId}` },
      ]);
    }
  }
  private async ensureStaffExists(
    tx: TxnHoldWriteClient,
    staffId: string | null | undefined,
  ): Promise<void> {
    if (!staffId) {
      return;
    }
    const staff = await tx.employeeMaster.findFirst({
      where: { empId: staffId, empIsDeleted: false },
      select: { empId: true },
    });
    if (!staff) {
      throwSalesBadRequest<TxnHoldErrorDetail>('Employee does not exist', [
        { field: 'txhStaffId', message: `No active employee found with id ${staffId}` },
      ]);
    }
  }
  // The CHECK constraints answer in Postgres' own words (23514, naming a
  // constraint the caller has never heard of), so every one of them that a
  // payload can trip is restated here — judged on the MERGED row (`data`
  // carries the payload's resolved values, the stored row supplies whatever it
  // leaves out), since a rule judges the row that will actually be written.
  private ensureValuesAreAllowed(
    existing: TxnHold | undefined,
    data: Prisma.TxnHoldUncheckedCreateInput | Prisma.TxnHoldUncheckedUpdateInput,
  ): void {
    const details: TxnHoldErrorDetail[] = [];
    const values: TxnHoldGuardedValues = {
      txhKind: (data.txhKind as string | undefined) ?? existing?.txhKind,
      txhSrcModule: (data.txhSrcModule as string | undefined) ?? existing?.txhSrcModule,
      txhDocType: (data.txhDocType as string | undefined) ?? existing?.txhDocType,
      txhStatus: (data.txhStatus as string | undefined) ?? existing?.txhStatus,
      txhPartyType:
        (data.txhPartyType as string | null | undefined) ?? existing?.txhPartyType ?? undefined,
    };
    for (const guard of TXN_HOLD_VALUE_GUARDS) {
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
    // ck_txh_payload_object — every module's save body is an object, and a
    // reader that has to guess is a reader that crashes.
    const payload = (data.txhPayload ?? existing?.txhPayload) as unknown;
    if (
      payload === undefined ||
      payload === null ||
      typeof payload !== 'object' ||
      Array.isArray(payload)
    ) {
      details.push({
        field: 'txhPayload',
        message: 'txhPayload is required and must be a JSON object',
      });
    }
    // ck_txh_party_typed — an id with no type is unresolvable: there is no FK to
    // say which master it came from. A type with no id is fine (a walk-in).
    const partyId = (data.txhPartyId as string | null | undefined) ?? existing?.txhPartyId ?? null;
    if (partyId && !values.txhPartyType) {
      details.push({
        field: 'txhPartyType',
        message: 'txhPartyType is required when txhPartyId is set',
      });
    }
    // ck_txh_amounts — signs only; the totals are allowed to be arithmetically
    // incomplete on a half-typed screen.
    for (const [field, sent, stored] of [
      ['txhItemCount', data.txhItemCount, existing?.txhItemCount],
      ['txhTotalQty', data.txhTotalQty, existing?.txhTotalQty],
      ['txhNetAmount', data.txhNetAmount, existing?.txhNetAmount],
      ['txhPrintCount', data.txhPrintCount, existing?.txhPrintCount],
    ] as const) {
      const merged = this.mergedNumber(sent, stored as Prisma.Decimal | number | null | undefined);
      if (merged !== null && merged < 0) {
        details.push({ field, message: `${field} must be greater than or equal to 0` });
      }
    }
    // ck_txh_expires_after_hold
    const holdOn = (data.txhHoldOn as Date | undefined) ?? existing?.txhHoldOn ?? null;
    const expiresOn =
      (data.txhExpiresOn as Date | null | undefined) ?? existing?.txhExpiresOn ?? null;
    if (holdOn && expiresOn && expiresOn.getTime() <= holdOn.getTime()) {
      details.push({
        field: 'txhExpiresOn',
        message: 'txhExpiresOn must be after txhHoldOn',
      });
    }
    // ck_txh_printed — the count and the instant answer the same question, so
    // one without the other is a row that contradicts itself.
    const printCount =
      this.mergedNumber(data.txhPrintCount, existing?.txhPrintCount) ??
      (existing ? existing.txhPrintCount : 0);
    const lastPrintedOn =
      (data.txhLastPrintedOn as Date | null | undefined) ?? existing?.txhLastPrintedOn ?? null;
    if ((printCount === 0) !== (lastPrintedOn === null)) {
      details.push({
        field: 'txhLastPrintedOn',
        message:
          'txhLastPrintedOn must be set exactly when txhPrintCount is greater than 0 ' +
          '(and null when it is 0)',
      });
    }
    // The lease and the conversion trail are not this route's to write, and the
    // constraints that police them (ck_txh_locked_status, ck_txh_converted_status)
    // would fire on a status moved here without the block that has to go with it.
    const status = values.txhStatus ?? TxnHoldStatus.HELD;
    if (data.txhStatus !== undefined) {
      if (status === String(TxnHoldStatus.LOCKED)) {
        details.push({
          field: 'txhStatus',
          message: 'A hold is put into LOCKED by POST /txn-holds/:id/resume, not by this payload',
        });
      }
      if (status === String(TxnHoldStatus.CONVERTED)) {
        details.push({
          field: 'txhStatus',
          message:
            'A hold is put into CONVERTED by POST /txn-holds/:id/convert, which stamps the ' +
            'conversion trail with it',
        });
      }
    }
    if (details.length > 0) {
      throwSalesBadRequest<TxnHoldErrorDetail>('Invalid hold value', details);
    }
    // A finished hold stays finished: reopening a CONVERTED one would let the
    // same parked work be billed twice, and reopening an EXPIRED / CANCELLED /
    // ABANDONED one would resurrect work the till has already written off.
    // Re-sending the same terminal status is fine.
    if (
      existing &&
      TXN_HOLD_CLOSED_STATUSES.includes(existing.txhStatus) &&
      status !== existing.txhStatus
    ) {
      throwSalesConflict<TxnHoldErrorDetail>('Hold is already closed', [
        {
          field: 'txhStatus',
          message: `A hold in status ${existing.txhStatus} cannot be reopened`,
        },
      ]);
    }
  }
  private buildListWhere(queryDto: ListTxnHoldQueryDto): Prisma.TxnHoldWhereInput {
    const filters: Prisma.TxnHoldWhereInput[] = [];
    const search = queryDto.search?.trim();
    if (search) {
      filters.push({
        OR: [
          { txhHoldNo: { contains: search, mode: 'insensitive' } },
          { txhPartyName: { contains: search, mode: 'insensitive' } },
          { txhPartyMobile: { contains: search, mode: 'insensitive' } },
          { txhRefLabel: { contains: search, mode: 'insensitive' } },
          { txhRemarks: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (queryDto.txhCompanyId) filters.push({ txhCompanyId: queryDto.txhCompanyId });
    if (queryDto.txhBranchId) filters.push({ txhBranchId: queryDto.txhBranchId });
    if (queryDto.txhAccYear) filters.push({ txhAccYear: queryDto.txhAccYear });
    if (queryDto.txhKind) filters.push({ txhKind: queryDto.txhKind });
    if (queryDto.txhSrcModule) filters.push({ txhSrcModule: queryDto.txhSrcModule });
    if (queryDto.txhDocType) filters.push({ txhDocType: queryDto.txhDocType });
    if (queryDto.txhStatus) filters.push({ txhStatus: queryDto.txhStatus });
    if (queryDto.txhDeviceId) filters.push({ txhDeviceId: queryDto.txhDeviceId });
    if (queryDto.txhCounterId) filters.push({ txhCounterId: queryDto.txhCounterId });
    if (queryDto.txhSessionId) filters.push({ txhSessionId: queryDto.txhSessionId });
    if (queryDto.txhHeldBy) filters.push({ txhHeldBy: queryDto.txhHeldBy });
    if (queryDto.txhPartyType) filters.push({ txhPartyType: queryDto.txhPartyType });
    if (queryDto.txhPartyId) filters.push({ txhPartyId: queryDto.txhPartyId });
    if (queryDto.txhPartyMobile) filters.push({ txhPartyMobile: queryDto.txhPartyMobile });
    if (queryDto.txhStaffId) filters.push({ txhStaffId: queryDto.txhStaffId });
    if (queryDto.holdOnFrom) {
      filters.push({ txhHoldOn: { gte: this.parseDate(queryDto.holdOnFrom, 'holdOnFrom') } });
    }
    if (queryDto.holdOnTo) {
      filters.push({ txhHoldOn: { lte: this.parseDate(queryDto.holdOnTo, 'holdOnTo') } });
    }
    if (queryDto.expired !== undefined) {
      const now = new Date();
      filters.push(
        queryDto.expired
          ? { txhExpiresOn: { lt: now } }
          : // A hold without an expiry never lapses, so "still valid" has to keep it.
            { OR: [{ txhExpiresOn: null }, { txhExpiresOn: { gte: now } }] },
      );
    }
    if (queryDto.stockReserved !== undefined) {
      filters.push({ txhIsStockReserved: queryDto.stockReserved });
    }
    return {
      txhIsDeleted: false,
      ...(filters.length > 0 ? { AND: filters } : {}),
    };
  }
  private hasStructuredFilters(queryDto: ListTxnHoldQueryDto): boolean {
    return (
      queryDto.txhCompanyId !== undefined ||
      queryDto.txhBranchId !== undefined ||
      queryDto.txhAccYear !== undefined ||
      queryDto.txhKind !== undefined ||
      queryDto.txhSrcModule !== undefined ||
      queryDto.txhDocType !== undefined ||
      queryDto.txhStatus !== undefined ||
      queryDto.txhDeviceId !== undefined ||
      queryDto.txhCounterId !== undefined ||
      queryDto.txhSessionId !== undefined ||
      queryDto.txhHeldBy !== undefined ||
      queryDto.txhPartyType !== undefined ||
      queryDto.txhPartyId !== undefined ||
      queryDto.txhPartyMobile !== undefined ||
      queryDto.txhStaffId !== undefined ||
      queryDto.holdOnFrom !== undefined ||
      queryDto.holdOnTo !== undefined ||
      queryDto.expired !== undefined ||
      queryDto.stockReserved !== undefined
    );
  }
  // The value a numeric column will hold once the write lands: the payload's
  // when it sent one, the stored row's otherwise, and null when neither has one
  // (a create that leaves the column to its default).
  private mergedNumber(
    sent: unknown,
    stored: Prisma.Decimal | number | null | undefined,
  ): number | null {
    if (sent !== undefined && sent !== null && typeof sent !== 'object') {
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
      throwSalesBadRequest<TxnHoldErrorDetail>('Validation failed', [
        { field, message: `${field} must be a valid ISO-8601 date-time` },
      ]);
    }
    return parsed;
  }
  private requireField<T extends string>(value: T | undefined, field: string): T {
    if (!value) {
      throwSalesBadRequest<TxnHoldErrorDetail>(`${field} is required`, [
        { field, message: `${field} must be provided when creating a hold` },
      ]);
    }
    return value;
  }
  private requireNumberField(value: number | undefined, field: string): number {
    if (value === undefined || value === null) {
      throwSalesBadRequest<TxnHoldErrorDetail>(`${field} is required`, [
        { field, message: `${field} must be provided when creating a hold` },
      ]);
    }
    return value;
  }
  // txh_payload is NOT NULL and ck_txh_payload_object narrows it to an object:
  // every module's save body is one, and a reader that has to guess is a reader
  // that crashes. Checked before the transaction opens because a create without
  // a body is not a hold at all.
  private requirePayload(value: unknown): Prisma.InputJsonObject {
    if (
      value === undefined ||
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      throwSalesBadRequest<TxnHoldErrorDetail>('txhPayload is required', [
        {
          field: 'txhPayload',
          message: 'txhPayload must be the module’s save body, as a JSON object',
        },
      ]);
    }
    return value as Prisma.InputJsonObject;
  }
  // The partition key. A year that is not 'YYYY-YYYY' has no partition to land
  // in, and the insert would fail with "no partition of relation txn_hold found
  // for row" — which names neither the field nor the fix.
  private requireAccYear(value: string | undefined, field: string): string {
    const year = this.requireField(value, field).trim();
    if (!ACC_YEAR_PATTERN.test(year)) {
      throwSalesBadRequest<TxnHoldErrorDetail>(`${field} is malformed`, [
        { field, message: `${field} must be an accounting year in the form YYYY-YYYY` },
      ]);
    }
    return year;
  }
  private handleWriteError(error: unknown): void {
    // The partial unique indexes are the real authority; the checks above only
    // turn the common case into a field-level 409. Two tills racing the same
    // number can still land here, so the constraint violation answers as the
    // same 409 rather than a 500.
    throwOnUniqueConstraintError<TxnHoldErrorDetail>(error, 'Hold already exists', [
      {
        field: 'txhHoldNo',
        message:
          'Duplicate txhHoldNo / txhHoldSlno for this company, branch, year, device and ' +
          'document type, or a second live autosave for this screen',
      },
    ]);
  }
  private throwNotFound(txhId: string): never {
    throwSalesNotFound<TxnHoldErrorDetail>(
      'Hold not found',
      'txhId',
      `No active hold found with id ${txhId}`,
    );
  }
  private displayName(record: TxnHold): string {
    return record.txhHoldNo?.trim() || record.txhId;
  }
  // The txh_* enum columns are varchar in Postgres, so Prisma reads them back as
  // plain strings and they are asserted to their enum here. Every write path
  // (this module's DTO + ensureValuesAreAllowed) and the CHECK constraints
  // behind them keep the stored values inside the sets, so the assertion cannot
  // invent a member that isn't there. txh_acc_year is CHAR(9) and comes back
  // space-padded if it was ever written short, so it is trimmed.
  private toPayload(record: TxnHold): TxnHoldPayload {
    return {
      txhId: record.txhId,
      txhCompanyId: record.txhCompanyId,
      txhBranchId: record.txhBranchId,
      txhTenantId: record.txhTenantId,
      txhAccYear: record.txhAccYear.trim(),
      txhKind: record.txhKind as TxnHoldKind,
      txhSrcModule: record.txhSrcModule as TxnHoldSrcModule,
      txhDocType: record.txhDocType as TxnHoldDocType,
      txhHoldNo: record.txhHoldNo,
      txhHoldSlno: record.txhHoldSlno,
      txhHoldOn: record.txhHoldOn.toISOString(),
      txhDeviceId: record.txhDeviceId,
      txhCounterId: record.txhCounterId,
      txhSessionId: record.txhSessionId,
      txhHeldBy: record.txhHeldBy,
      txhPartyType: record.txhPartyType as TxnHoldPartyType | null,
      txhPartyId: record.txhPartyId,
      txhPartyName: record.txhPartyName,
      txhPartyMobile: record.txhPartyMobile,
      txhStaffId: record.txhStaffId,
      txhRefLabel: record.txhRefLabel,
      txhItemCount: record.txhItemCount,
      txhTotalQty: toNumber(record.txhTotalQty),
      txhNetAmount: toNumber(record.txhNetAmount),
      txhPayload: record.txhPayload,
      txhPayloadVersion: record.txhPayloadVersion,
      txhRevision: record.txhRevision,
      txhStatus: record.txhStatus as TxnHoldStatus,
      txhHoldReason: record.txhHoldReason,
      txhRemarks: record.txhRemarks,
      txhExpiresOn: record.txhExpiresOn ? record.txhExpiresOn.toISOString() : null,
      txhLockedBy: record.txhLockedBy,
      txhLockedDeviceId: record.txhLockedDeviceId,
      txhLockedOn: record.txhLockedOn ? record.txhLockedOn.toISOString() : null,
      txhLockExpiresOn: record.txhLockExpiresOn ? record.txhLockExpiresOn.toISOString() : null,
      txhLockToken: record.txhLockToken,
      txhResumedBy: record.txhResumedBy,
      txhResumedOn: record.txhResumedOn ? record.txhResumedOn.toISOString() : null,
      txhResumeCount: record.txhResumeCount,
      txhConvertedDocId: record.txhConvertedDocId,
      txhConvertedAccYear: record.txhConvertedAccYear ? record.txhConvertedAccYear.trim() : null,
      txhConvertedRefno: record.txhConvertedRefno,
      txhConvertedOn: record.txhConvertedOn ? record.txhConvertedOn.toISOString() : null,
      txhConvertedBy: record.txhConvertedBy,
      txhIsStockReserved: record.txhIsStockReserved,
      txhPrintCount: record.txhPrintCount,
      txhLastPrintedOn: record.txhLastPrintedOn ? record.txhLastPrintedOn.toISOString() : null,
      txhIsDeleted: record.txhIsDeleted,
      txhSyncDate: record.txhSyncDate ? record.txhSyncDate.toISOString() : null,
      txhCreatedOn: record.txhCreatedOn.toISOString(),
      txhCreatedBy: record.txhCreatedBy,
      txhModifiedOn: record.txhModifiedOn ? record.txhModifiedOn.toISOString() : null,
      txhModifiedBy: record.txhModifiedBy,
    };
  }
}
