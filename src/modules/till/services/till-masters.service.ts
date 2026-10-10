import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { isUniqueConstraintError } from '../../../common/utils/module-shared.utils';
import { TillContextService, type TillCaller } from '../till-context.service';
import { dateParam, isoDateOf } from '../till-dates';
import { throwTill, throwTillBadRequest, throwTillNotFound } from '../till-errors';
import { TillLedgerService } from './till-ledger.service';
import {
  LIVE_SESSION_STATUSES,
  TILL_APPROVAL_CHANNELS,
  TILL_APPROVAL_EVENTS,
  TILL_APPROVAL_MODES,
  TILL_APPROVER_ROLES,
  TILL_COUNTER_KINDS,
  TILL_REASON_CATEGORIES,
  TillDrawerMode,
  TillErrorCode,
  TillSessionStatus,
} from '../types/till-enum';
import type {
  TillApprovalAuthorityPayload,
  TillApprovalRulePayload,
  TillCounterPayload,
  TillDeletePayload,
  TillDenominationPayload,
  TillReasonPayload,
  TillSafePayload,
} from '../types/till-api.types';
import type {
  SaveTillApprovalAuthorityDto,
  SaveTillApprovalRuleDto,
  SaveTillCounterDto,
  SaveTillDenominationDto,
  SaveTillReasonDto,
  SaveTillSafeDto,
} from '../dto/save-till-masters.dto';

type Tx = Prisma.TransactionClient;
const dec = (v: number | null | undefined, fallback = 0) => new Prisma.Decimal(v ?? fallback);
const num = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v.toFixed(2)) : 0);
const SCREEN = 'Till Masters';

/**
 * The six till masters (§6, S10), authored on the STORE server (§14 Q1).
 * /create creates or updates by id presence — the house master verb; lists
 * are grids. Every refusal names the rule the 47 CHECK or partial unique
 * index would otherwise raise with a constraint name.
 *
 * Shipped rows (company NULL — reasons, denominations, approval rules) are
 * shared by every company. A company does not edit them; it adds its own row,
 * which wins (approval rules: branch > company > shipped).
 */
@Injectable()
export class TillMastersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TillContextService,
    private readonly ledger: TillLedgerService,
    private readonly audit: AuditLogService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  //  Counter
  // ═════════════════════════════════════════════════════════════════════════

  async saveCounter(dto: SaveTillCounterDto): Promise<TillCounterPayload> {
    const caller = await this.context.caller();
    return this.prisma.$transaction(async (tx) => {
      const existing = dto.tcnId
        ? await tx.tillCounter.findFirst({ where: { tcnId: dto.tcnId, tcnIsDeleted: false } })
        : null;
      if (dto.tcnId && !existing) {
        throwTillNotFound('Counter', 'tcnId', dto.tcnId);
      }
      if (
        existing &&
        (existing.tcnCompanyId !== dto.tcnCompanyId || existing.tcnBranchId !== dto.tcnBranchId)
      ) {
        throwTillBadRequest('A counter stays in the branch it was created in', 'tcnBranchId');
      }
      const code = dto.tcnCode.trim().toUpperCase();
      const kind = (dto.tcnKind ?? existing?.tcnKind ?? 'POS').toUpperCase();
      if (!(TILL_COUNTER_KINDS as readonly string[]).includes(kind)) {
        throwTillBadRequest(`tcnKind must be one of ${TILL_COUNTER_KINDS.join(', ')}`, 'tcnKind');
      }
      const drawerMode = (
        dto.tcnDrawerMode ??
        existing?.tcnDrawerMode ??
        TillDrawerMode.DRAWER
      ).toUpperCase();
      if (!(Object.values(TillDrawerMode) as string[]).includes(drawerMode)) {
        throwTillBadRequest('tcnDrawerMode must be DRAWER, TRAY or NONE', 'tcnDrawerMode');
      }
      const alert = dec(dto.tcnCashAlertLimit ?? num(existing?.tcnCashAlertLimit));
      const block = dec(dto.tcnCashBlockLimit ?? num(existing?.tcnCashBlockLimit));
      if (!block.isZero() && !alert.isZero() && block.lessThan(alert)) {
        throwTillBadRequest('The block limit cannot be below the alert limit', 'tcnCashBlockLimit');
      }

      const clash = await tx.$queryRaw<{ tcn_id: string }[]>`
        SELECT tcn_id FROM accounts.till_counter
         WHERE tcn_company_id = ${dto.tcnCompanyId}::uuid AND tcn_branch_id = ${dto.tcnBranchId}::uuid
           AND upper(tcn_code) = ${code} AND tcn_is_deleted = false
           AND tcn_id <> COALESCE(${dto.tcnId ?? null}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`;
      if (clash.length > 0) {
        throwTillBadRequest(`Counter code ${code} is already used in this branch`, 'tcnCode');
      }

      const deviceId =
        dto.tcnDeviceId === undefined ? (existing?.tcnDeviceId ?? null) : dto.tcnDeviceId;
      if (deviceId) {
        await this.assertTillDevice(tx, deviceId, dto.tcnBranchId);
        const other = await tx.tillCounter.findFirst({
          where: {
            tcnDeviceId: deviceId,
            tcnIsDeleted: false,
            ...(dto.tcnId ? { tcnId: { not: dto.tcnId } } : {}),
          },
          select: { tcnCode: true },
        });
        if (other) {
          throwTillBadRequest(`That device already drives counter ${other.tcnCode}`, 'tcnDeviceId');
        }
      }
      if (existing && deviceId !== existing.tcnDeviceId) {
        await this.assertNoLiveSession(
          tx,
          existing.tcnId,
          'tcnDeviceId',
          'a device is re-pointed only between sessions',
        );
      }
      const safeId = dto.tcnSafeId === undefined ? (existing?.tcnSafeId ?? null) : dto.tcnSafeId;
      if (safeId) {
        const safe = await tx.tillSafe.findFirst({
          where: {
            tsfId: safeId,
            tsfBranchId: dto.tcnBranchId,
            tsfCompanyId: dto.tcnCompanyId,
            tsfIsDeleted: false,
          },
          select: { tsfId: true },
        });
        if (!safe) {
          throwTillBadRequest('tcnSafeId must be a safe of the same branch', 'tcnSafeId');
        }
      }

      const data = {
        tcnCode: code,
        tcnName: dto.tcnName.trim(),
        tcnKind: kind,
        tcnDrawerMode: drawerMode,
        tcnDeviceId: deviceId,
        tcnSafeId: safeId,
        tcnDefaultFloat: dec(dto.tcnDefaultFloat ?? num(existing?.tcnDefaultFloat)),
        tcnCashAlertLimit: alert,
        tcnCashBlockLimit: block,
        tcnRequiresSession: dto.tcnRequiresSession ?? existing?.tcnRequiresSession ?? true,
        tcnSortOrder: dto.tcnSortOrder ?? existing?.tcnSortOrder ?? 0,
        tcnRemarks: dto.tcnRemarks === undefined ? (existing?.tcnRemarks ?? null) : dto.tcnRemarks,
        tcnIsActive: dto.tcnIsActive ?? existing?.tcnIsActive ?? true,
      };
      const saved = existing
        ? await tx.tillCounter.update({
            where: { tcnId: existing.tcnId },
            data: { ...data, tcnModifiedOn: new Date(), tcnModifiedBy: caller.actorName },
          })
        : await tx.tillCounter.create({
            data: {
              ...data,
              tcnCompanyId: dto.tcnCompanyId,
              tcnBranchId: dto.tcnBranchId,
              tcnCreatedBy: caller.actorName,
            },
          });
      const payload = await this.counterPayload(tx, saved);
      await this.logChange(
        tx,
        caller,
        'till_counter',
        saved.tcnId,
        saved.tcnCode,
        existing ? await this.counterPayload(tx, existing) : null,
        payload,
      );
      return payload;
    });
  }

  async getCounter(tcnId: string, companyId: string): Promise<TillCounterPayload> {
    const row = await this.prisma.tillCounter.findFirst({
      where: { tcnId, tcnCompanyId: companyId, tcnIsDeleted: false },
    });
    if (!row) {
      throwTillNotFound('Counter', 'tcnId', tcnId);
    }
    return this.counterPayload(this.prisma, row);
  }

  async deleteCounter(tcnId: string, companyId: string): Promise<TillDeletePayload> {
    const caller = await this.context.caller();
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.tillCounter.findFirst({
        where: { tcnId, tcnCompanyId: companyId, tcnIsDeleted: false },
      });
      if (!row) {
        throwTillNotFound('Counter', 'tcnId', tcnId);
      }
      await this.assertNoLiveSession(tx, tcnId, 'tcnId', 'close it first');
      // Soft delete, and the device let go: ux_tcn_device ignores deleted rows,
      // and the PC must be free to drive the counter that replaces this one.
      await tx.tillCounter.update({
        where: { tcnId },
        data: {
          tcnIsDeleted: true,
          tcnDeviceId: null,
          tcnModifiedOn: new Date(),
          tcnModifiedBy: caller.actorName,
        },
      });
      await this.logChange(
        tx,
        caller,
        'till_counter',
        tcnId,
        row.tcnCode,
        await this.counterPayload(tx, row),
        null,
        'cancel',
      );
      return { id: tcnId, deleted: true };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Safe
  // ═════════════════════════════════════════════════════════════════════════

  async saveSafe(dto: SaveTillSafeDto): Promise<TillSafePayload> {
    const caller = await this.context.caller();
    return this.prisma.$transaction(async (tx) => {
      const existing = dto.tsfId
        ? await tx.tillSafe.findFirst({ where: { tsfId: dto.tsfId, tsfIsDeleted: false } })
        : null;
      if (dto.tsfId && !existing) {
        throwTillNotFound('Safe', 'tsfId', dto.tsfId);
      }
      if (
        existing &&
        (existing.tsfCompanyId !== dto.tsfCompanyId || existing.tsfBranchId !== dto.tsfBranchId)
      ) {
        throwTillBadRequest('A safe stays in the branch it was created in', 'tsfBranchId');
      }
      const code = dto.tsfCode.trim().toUpperCase();
      const clash = await tx.$queryRaw<{ tsf_id: string }[]>`
        SELECT tsf_id FROM accounts.till_safe
         WHERE tsf_company_id = ${dto.tsfCompanyId}::uuid AND tsf_branch_id = ${dto.tsfBranchId}::uuid
           AND upper(tsf_code) = ${code} AND tsf_is_deleted = false
           AND tsf_id <> COALESCE(${dto.tsfId ?? null}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`;
      if (clash.length > 0) {
        throwTillBadRequest(`Safe code ${code} is already used in this branch`, 'tsfCode');
      }
      // The ledger: the one named, else the SAFE_CASH role's (47 §10.1).
      const ledgerId =
        dto.tsfLedgerId ??
        existing?.tsfLedgerId ??
        (await this.ledger.roleLedger(tx, 'SAFE_CASH', dto.tsfCompanyId, dto.tsfBranchId));
      await this.assertLedger(tx, ledgerId, dto.tsfCompanyId, 'tsfLedgerId');

      const isDefault = dto.tsfIsDefault ?? existing?.tsfIsDefault ?? false;
      if (isDefault) {
        // One default per branch (ux_tsf_default): the new default takes over.
        await tx.tillSafe.updateMany({
          where: {
            tsfCompanyId: dto.tsfCompanyId,
            tsfBranchId: dto.tsfBranchId,
            tsfIsDeleted: false,
            tsfIsDefault: true,
            ...(dto.tsfId ? { tsfId: { not: dto.tsfId } } : {}),
          },
          data: { tsfIsDefault: false, tsfModifiedOn: new Date(), tsfModifiedBy: caller.actorName },
        });
      }
      const data = {
        tsfCode: code,
        tsfName: dto.tsfName.trim(),
        tsfLedgerId: ledgerId,
        tsfInsuredLimit: dec(dto.tsfInsuredLimit ?? num(existing?.tsfInsuredLimit)),
        tsfIsDefault: isDefault,
        tsfRemarks: dto.tsfRemarks === undefined ? (existing?.tsfRemarks ?? null) : dto.tsfRemarks,
        tsfIsActive: dto.tsfIsActive ?? existing?.tsfIsActive ?? true,
      };
      const saved = existing
        ? await tx.tillSafe.update({
            where: { tsfId: existing.tsfId },
            data: { ...data, tsfModifiedOn: new Date(), tsfModifiedBy: caller.actorName },
          })
        : await tx.tillSafe.create({
            data: {
              ...data,
              tsfCompanyId: dto.tsfCompanyId,
              tsfBranchId: dto.tsfBranchId,
              tsfCreatedBy: caller.actorName,
            },
          });
      const payload = await this.safePayload(tx, saved);
      await this.logChange(
        tx,
        caller,
        'till_safe',
        saved.tsfId,
        saved.tsfCode,
        existing ? await this.safePayload(tx, existing) : null,
        payload,
      );
      return payload;
    });
  }

  async getSafe(tsfId: string, companyId: string): Promise<TillSafePayload> {
    const row = await this.prisma.tillSafe.findFirst({
      where: { tsfId, tsfCompanyId: companyId, tsfIsDeleted: false },
    });
    if (!row) {
      throwTillNotFound('Safe', 'tsfId', tsfId);
    }
    return this.safePayload(this.prisma, row);
  }

  async deleteSafe(tsfId: string, companyId: string): Promise<TillDeletePayload> {
    const caller = await this.context.caller();
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.tillSafe.findFirst({
        where: { tsfId, tsfCompanyId: companyId, tsfIsDeleted: false },
      });
      if (!row) {
        throwTillNotFound('Safe', 'tsfId', tsfId);
      }
      const counters = await tx.tillCounter.count({
        where: { tcnSafeId: tsfId, tcnIsDeleted: false },
      });
      if (counters > 0) {
        throwTill(
          TillErrorCode.MASTER_IN_USE,
          `${counters} counter(s) drop into this safe; point them elsewhere first`,
          'tsfId',
        );
      }
      await tx.tillSafe.update({
        where: { tsfId },
        data: {
          tsfIsDeleted: true,
          tsfIsDefault: false,
          tsfModifiedOn: new Date(),
          tsfModifiedBy: caller.actorName,
        },
      });
      await this.logChange(
        tx,
        caller,
        'till_safe',
        tsfId,
        row.tsfCode,
        await this.safePayload(tx, row),
        null,
        'cancel',
      );
      return { id: tsfId, deleted: true };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Reason
  // ═════════════════════════════════════════════════════════════════════════

  async saveReason(dto: SaveTillReasonDto): Promise<TillReasonPayload> {
    const caller = await this.context.caller();
    return this.prisma.$transaction(async (tx) => {
      const existing = dto.trsId
        ? await tx.tillReason.findFirst({ where: { trsId: dto.trsId, trsIsDeleted: false } })
        : null;
      if (dto.trsId && !existing) {
        throwTillNotFound('Till reason', 'trsId', dto.trsId);
      }
      this.assertOwnRow(existing?.trsCompanyId, dto.trsCompanyId, 'trsId', 'reason');
      const category = dto.trsCategory.trim().toUpperCase();
      if (!(TILL_REASON_CATEGORIES as readonly string[]).includes(category)) {
        throwTillBadRequest(
          `trsCategory must be one of ${TILL_REASON_CATEGORIES.join(', ')}`,
          'trsCategory',
        );
      }
      const code = dto.trsCode.trim().toUpperCase();
      if (dto.trsLedgerId) {
        await this.assertLedger(tx, dto.trsLedgerId, dto.trsCompanyId, 'trsLedgerId');
      }
      const data = {
        trsCategory: category,
        trsCode: code,
        trsName: dto.trsName.trim(),
        trsLedgerId:
          dto.trsLedgerId === undefined ? (existing?.trsLedgerId ?? null) : dto.trsLedgerId,
        trsNeedsNote: dto.trsNeedsNote ?? existing?.trsNeedsNote ?? false,
        trsNeedsRef: dto.trsNeedsRef ?? existing?.trsNeedsRef ?? false,
        trsMaxAmount: dec(dto.trsMaxAmount ?? num(existing?.trsMaxAmount)),
        trsSortOrder: dto.trsSortOrder ?? existing?.trsSortOrder ?? 0,
        trsIsActive: dto.trsIsActive ?? existing?.trsIsActive ?? true,
      };
      try {
        const saved = existing
          ? await tx.tillReason.update({
              where: { trsId: existing.trsId },
              data: { ...data, trsModifiedOn: new Date(), trsModifiedBy: caller.actorName },
            })
          : await tx.tillReason.create({
              data: { ...data, trsCompanyId: dto.trsCompanyId, trsCreatedBy: caller.actorName },
            });
        const payload = await this.reasonPayload(tx, saved);
        await this.logChange(
          tx,
          caller,
          'till_reason',
          saved.trsId,
          saved.trsCode,
          existing ? await this.reasonPayload(tx, existing) : null,
          payload,
        );
        return payload;
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throwTillBadRequest(
            `Reason ${category} / ${code} already exists for this company`,
            'trsCode',
          );
        }
        throw error;
      }
    });
  }

  async getReason(trsId: string, companyId: string): Promise<TillReasonPayload> {
    const row = await this.prisma.tillReason.findFirst({
      where: {
        trsId,
        trsIsDeleted: false,
        OR: [{ trsCompanyId: null }, { trsCompanyId: companyId }],
      },
    });
    if (!row) {
      throwTillNotFound('Till reason', 'trsId', trsId);
    }
    return this.reasonPayload(this.prisma, row);
  }

  async deleteReason(trsId: string, companyId: string): Promise<TillDeletePayload> {
    const caller = await this.context.caller();
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.tillReason.findFirst({ where: { trsId, trsIsDeleted: false } });
      if (!row) {
        throwTillNotFound('Till reason', 'trsId', trsId);
      }
      this.assertOwnRow(row.trsCompanyId, companyId, 'trsId', 'reason');
      await tx.tillReason.update({
        where: { trsId },
        data: { trsIsDeleted: true, trsModifiedOn: new Date(), trsModifiedBy: caller.actorName },
      });
      await this.logChange(
        tx,
        caller,
        'till_reason',
        trsId,
        row.trsCode,
        await this.reasonPayload(tx, row),
        null,
        'cancel',
      );
      return { id: trsId, deleted: true };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Denomination
  // ═════════════════════════════════════════════════════════════════════════

  async saveDenomination(dto: SaveTillDenominationDto): Promise<TillDenominationPayload> {
    const caller = await this.context.caller();
    return this.prisma.$transaction(async (tx) => {
      const existing = dto.tdnId
        ? await tx.tillDenomination.findFirst({ where: { tdnId: dto.tdnId, tdnIsDeleted: false } })
        : null;
      if (dto.tdnId && !existing) {
        throwTillNotFound('Denomination', 'tdnId', dto.tdnId);
      }
      this.assertOwnRow(existing?.tdnCompanyId, dto.tdnCompanyId, 'tdnId', 'denomination');
      if (dto.tdnValue <= 0) {
        throwTillBadRequest('tdnValue must be above zero', 'tdnValue');
      }
      const data = {
        tdnCurrency: (dto.tdnCurrency ?? existing?.tdnCurrency ?? 'INR').toUpperCase(),
        tdnValue: dec(dto.tdnValue),
        tdnKind: dto.tdnKind,
        tdnLabel: dto.tdnLabel.trim(),
        tdnBundleQty: dto.tdnBundleQty ?? existing?.tdnBundleQty ?? 0,
        tdnSortOrder: dto.tdnSortOrder ?? existing?.tdnSortOrder ?? 0,
        tdnValidTo:
          dto.tdnValidTo === undefined
            ? (existing?.tdnValidTo ?? null)
            : dto.tdnValidTo
              ? dateParam(dto.tdnValidTo)
              : null,
        tdnIsActive: dto.tdnIsActive ?? existing?.tdnIsActive ?? true,
      };
      try {
        const saved = existing
          ? await tx.tillDenomination.update({
              where: { tdnId: existing.tdnId },
              data: { ...data, tdnModifiedOn: new Date(), tdnModifiedBy: caller.actorName },
            })
          : await tx.tillDenomination.create({
              data: { ...data, tdnCompanyId: dto.tdnCompanyId, tdnCreatedBy: caller.actorName },
            });
        const payload = this.denominationPayload(saved);
        await this.logChange(
          tx,
          caller,
          'till_denomination',
          saved.tdnId,
          saved.tdnLabel,
          existing ? this.denominationPayload(existing) : null,
          payload,
        );
        return payload;
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throwTillBadRequest('That value and kind already exist for this company', 'tdnValue');
        }
        throw error;
      }
    });
  }

  async getDenomination(tdnId: string, companyId: string): Promise<TillDenominationPayload> {
    const row = await this.prisma.tillDenomination.findFirst({
      where: {
        tdnId,
        tdnIsDeleted: false,
        OR: [{ tdnCompanyId: null }, { tdnCompanyId: companyId }],
      },
    });
    if (!row) {
      throwTillNotFound('Denomination', 'tdnId', tdnId);
    }
    return this.denominationPayload(row);
  }

  /** The denominations a count screen offers this company: its own and the shipped, valid today. */
  async listDenominations(companyId: string): Promise<TillDenominationPayload[]> {
    const rows = await this.prisma.$queryRaw<{ tdn_id: string }[]>`
      SELECT tdn_id FROM accounts.till_denomination
       WHERE (tdn_company_id IS NULL OR tdn_company_id = ${companyId}::uuid)
         AND tdn_is_deleted = false AND tdn_is_active = true
         AND (tdn_valid_to IS NULL OR tdn_valid_to >= CURRENT_DATE)`;
    const all = await this.prisma.tillDenomination.findMany({
      where: { tdnId: { in: rows.map((r) => r.tdn_id) } },
      orderBy: [{ tdnSortOrder: 'asc' }, { tdnValue: 'desc' }],
    });
    // A company row replaces the shipped row of the same value and kind.
    const own = new Set(
      all
        .filter((d) => d.tdnCompanyId)
        .map((d) => `${d.tdnCurrency}|${d.tdnValue.toString()}|${d.tdnKind}`),
    );
    return all
      .filter(
        (d) => d.tdnCompanyId || !own.has(`${d.tdnCurrency}|${d.tdnValue.toString()}|${d.tdnKind}`),
      )
      .map((d) => this.denominationPayload(d));
  }

  async deleteDenomination(tdnId: string, companyId: string): Promise<TillDeletePayload> {
    const caller = await this.context.caller();
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.tillDenomination.findFirst({ where: { tdnId, tdnIsDeleted: false } });
      if (!row) {
        throwTillNotFound('Denomination', 'tdnId', tdnId);
      }
      this.assertOwnRow(row.tdnCompanyId, companyId, 'tdnId', 'denomination');
      await tx.tillDenomination.update({
        where: { tdnId },
        data: { tdnIsDeleted: true, tdnModifiedOn: new Date(), tdnModifiedBy: caller.actorName },
      });
      await this.logChange(
        tx,
        caller,
        'till_denomination',
        tdnId,
        row.tdnLabel,
        this.denominationPayload(row),
        null,
        'cancel',
      );
      return { id: tdnId, deleted: true };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Approval rule
  // ═════════════════════════════════════════════════════════════════════════

  async saveRule(dto: SaveTillApprovalRuleDto): Promise<TillApprovalRulePayload> {
    const caller = await this.context.caller();
    return this.prisma.$transaction(async (tx) => {
      const existing = dto.tarId
        ? await tx.tillApprovalRule.findFirst({ where: { tarId: dto.tarId, tarIsDeleted: false } })
        : null;
      if (dto.tarId && !existing) {
        throwTillNotFound('Approval rule', 'tarId', dto.tarId);
      }
      this.assertOwnRow(existing?.tarCompanyId, dto.tarCompanyId, 'tarId', 'approval rule');
      if (existing && existing.tarBranchId !== (dto.tarBranchId ?? null)) {
        throwTillBadRequest('A rule keeps its scope; add a branch rule instead', 'tarBranchId');
      }
      const event = dto.tarEventCode.trim().toUpperCase();
      const mode = dto.tarMode.trim().toUpperCase();
      const channel = (dto.tarChannel ?? existing?.tarChannel ?? 'EITHER').toUpperCase();
      const role = (dto.tarMinRole ?? existing?.tarMinRole ?? 'SUPERVISOR').toUpperCase();
      this.assertIn(event, TILL_APPROVAL_EVENTS, 'tarEventCode');
      this.assertIn(mode, TILL_APPROVAL_MODES, 'tarMode');
      this.assertIn(channel, TILL_APPROVAL_CHANNELS, 'tarChannel');
      this.assertIn(role, TILL_APPROVER_ROLES, 'tarMinRole');
      const data = {
        tarEventCode: event,
        tarMode: mode,
        tarThresholdAmount: dec(dto.tarThresholdAmount ?? num(existing?.tarThresholdAmount)),
        tarThresholdCount: dto.tarThresholdCount ?? existing?.tarThresholdCount ?? 0,
        tarThresholdPercent: new Prisma.Decimal(
          dto.tarThresholdPercent ?? existing?.tarThresholdPercent ?? 0,
        ),
        tarChannel: channel,
        tarMinRole: role,
        tarTwoPerson: dto.tarTwoPerson ?? existing?.tarTwoPerson ?? false,
        tarAllowSelf: dto.tarAllowSelf ?? existing?.tarAllowSelf ?? false,
        tarBlocksTill: dto.tarBlocksTill ?? existing?.tarBlocksTill ?? true,
        tarExpireMinutes: dto.tarExpireMinutes ?? existing?.tarExpireMinutes ?? 0,
        tarEffectiveFrom: dto.tarEffectiveFrom
          ? dateParam(dto.tarEffectiveFrom)
          : (existing?.tarEffectiveFrom ?? dateParam('2000-01-01')),
        tarRemarks: dto.tarRemarks === undefined ? (existing?.tarRemarks ?? null) : dto.tarRemarks,
        tarIsActive: dto.tarIsActive ?? existing?.tarIsActive ?? true,
      };
      try {
        const saved = existing
          ? await tx.tillApprovalRule.update({
              where: { tarId: existing.tarId },
              data: { ...data, tarModifiedOn: new Date(), tarModifiedBy: caller.actorName },
            })
          : await tx.tillApprovalRule.create({
              data: {
                ...data,
                tarCompanyId: dto.tarCompanyId,
                tarBranchId: dto.tarBranchId ?? null,
                tarCreatedBy: caller.actorName,
              },
            });
        const payload = this.rulePayload(saved);
        await this.logChange(
          tx,
          caller,
          'till_approval_rule',
          saved.tarId,
          saved.tarEventCode,
          existing ? this.rulePayload(existing) : null,
          payload,
        );
        return payload;
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throwTillBadRequest(
            `A ${event} rule already starts on that date at this scope`,
            'tarEffectiveFrom',
          );
        }
        throw error;
      }
    });
  }

  async getRule(tarId: string, companyId: string): Promise<TillApprovalRulePayload> {
    const row = await this.prisma.tillApprovalRule.findFirst({
      where: {
        tarId,
        tarIsDeleted: false,
        OR: [{ tarCompanyId: null }, { tarCompanyId: companyId }],
      },
    });
    if (!row) {
      throwTillNotFound('Approval rule', 'tarId', tarId);
    }
    return this.rulePayload(row);
  }

  async deleteRule(tarId: string, companyId: string): Promise<TillDeletePayload> {
    const caller = await this.context.caller();
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.tillApprovalRule.findFirst({ where: { tarId, tarIsDeleted: false } });
      if (!row) {
        throwTillNotFound('Approval rule', 'tarId', tarId);
      }
      this.assertOwnRow(row.tarCompanyId, companyId, 'tarId', 'approval rule');
      await tx.tillApprovalRule.update({
        where: { tarId },
        data: { tarIsDeleted: true, tarModifiedOn: new Date(), tarModifiedBy: caller.actorName },
      });
      await this.logChange(
        tx,
        caller,
        'till_approval_rule',
        tarId,
        row.tarEventCode,
        this.rulePayload(row),
        null,
        'cancel',
      );
      return { id: tarId, deleted: true };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Approval authority
  // ═════════════════════════════════════════════════════════════════════════

  async saveAuthority(dto: SaveTillApprovalAuthorityDto): Promise<TillApprovalAuthorityPayload> {
    const caller = await this.context.caller();
    return this.prisma.$transaction(async (tx) => {
      const existing = dto.taaId
        ? await tx.tillApprovalAuthority.findFirst({
            where: { taaId: dto.taaId, taaIsDeleted: false },
          })
        : null;
      if (dto.taaId && !existing) {
        throwTillNotFound('Approval authority', 'taaId', dto.taaId);
      }
      if (dto.taaBranchId && !dto.taaCompanyId) {
        throwTillBadRequest('A branch grant names its company', 'taaCompanyId');
      }
      const user = await tx.userMaster.findFirst({
        where: { usrId: dto.taaUserId, usrIsDeleted: false },
        select: { usrId: true },
      });
      if (!user) {
        throwTillBadRequest('taaUserId must be an existing user', 'taaUserId');
      }
      const role = dto.taaRole.trim().toUpperCase();
      this.assertIn(role, TILL_APPROVER_ROLES, 'taaRole');
      const event = dto.taaEventCode ? dto.taaEventCode.trim().toUpperCase() : null;
      if (event) {
        this.assertIn(event, TILL_APPROVAL_EVENTS, 'taaEventCode');
      }
      const validFrom = dto.taaValidFrom ?? (existing ? isoDateOf(existing.taaValidFrom) : null);
      const validTo =
        dto.taaValidTo === undefined
          ? existing?.taaValidTo
            ? isoDateOf(existing.taaValidTo)
            : null
          : dto.taaValidTo;
      if (validFrom && validTo && validTo < validFrom) {
        throwTillBadRequest('taaValidTo cannot be before taaValidFrom', 'taaValidTo');
      }
      const data = {
        taaUserId: dto.taaUserId,
        taaCompanyId: dto.taaCompanyId ?? null,
        taaBranchId: dto.taaBranchId ?? null,
        taaRole: role,
        taaEventCode: event,
        taaMaxAmount:
          dto.taaMaxAmount === undefined
            ? (existing?.taaMaxAmount ?? null)
            : dto.taaMaxAmount === null
              ? null
              : dec(dto.taaMaxAmount),
        taaCanRemote: dto.taaCanRemote ?? existing?.taaCanRemote ?? false,
        ...(validFrom ? { taaValidFrom: dateParam(validFrom) } : {}),
        taaValidTo: validTo ? dateParam(validTo) : null,
        taaRemarks: dto.taaRemarks === undefined ? (existing?.taaRemarks ?? null) : dto.taaRemarks,
        taaIsActive: dto.taaIsActive ?? existing?.taaIsActive ?? true,
      };
      const saved = existing
        ? await tx.tillApprovalAuthority.update({
            where: { taaId: existing.taaId },
            data: { ...data, taaModifiedOn: new Date(), taaModifiedBy: caller.actorName },
          })
        : await tx.tillApprovalAuthority.create({
            data: { ...data, taaCreatedBy: caller.actorName },
          });
      const payload = await this.authorityPayload(tx, saved);
      await this.logChange(
        tx,
        caller,
        'till_approval_authority',
        saved.taaId,
        role,
        existing ? await this.authorityPayload(tx, existing) : null,
        payload,
      );
      return payload;
    });
  }

  async getAuthority(taaId: string, companyId: string): Promise<TillApprovalAuthorityPayload> {
    const row = await this.prisma.tillApprovalAuthority.findFirst({
      where: {
        taaId,
        taaIsDeleted: false,
        OR: [{ taaCompanyId: null }, { taaCompanyId: companyId }],
      },
    });
    if (!row) {
      throwTillNotFound('Approval authority', 'taaId', taaId);
    }
    return this.authorityPayload(this.prisma, row);
  }

  async deleteAuthority(taaId: string, companyId: string): Promise<TillDeletePayload> {
    const caller = await this.context.caller();
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.tillApprovalAuthority.findFirst({
        where: {
          taaId,
          taaIsDeleted: false,
          OR: [{ taaCompanyId: null }, { taaCompanyId: companyId }],
        },
      });
      if (!row) {
        throwTillNotFound('Approval authority', 'taaId', taaId);
      }
      await tx.tillApprovalAuthority.update({
        where: { taaId },
        data: { taaIsDeleted: true, taaModifiedOn: new Date(), taaModifiedBy: caller.actorName },
      });
      await this.logChange(
        tx,
        caller,
        'till_approval_authority',
        taaId,
        row.taaRole,
        await this.authorityPayload(tx, row),
        null,
        'cancel',
      );
      return { id: taaId, deleted: true };
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Shared checks and payloads
  // ═════════════════════════════════════════════════════════════════════════

  /** A shipped row (company NULL) is everyone's; a company row is its company's only. */
  private assertOwnRow(
    rowCompanyId: string | null | undefined,
    companyId: string,
    field: string,
    what: string,
  ): void {
    if (rowCompanyId === undefined) {
      return; // a new row
    }
    if (rowCompanyId === null) {
      this.forbidden(
        `That ${what} is shipped and shared by every company: add a company ${what} instead of editing it`,
        field,
      );
    }
    if (rowCompanyId !== companyId) {
      throwTillNotFound(what, field, 'in this company');
    }
  }

  private forbidden(message: string, field: string): never {
    throwTill(TillErrorCode.MASTER_IN_USE, message, field);
  }

  private assertIn(value: string, allowed: readonly string[], field: string): void {
    if (!allowed.includes(value)) {
      throwTillBadRequest(`${field} must be one of ${allowed.join(', ')}`, field);
    }
  }

  /**
   * "Desktop/Mobile only, never Web" (47 §1.2): a browser has no drawer. Judged
   * on the uid too (plan-till-counter-claim §7.1): `web:<usr_id>` is one row per
   * USER and would follow the person to any browser, `WEB-<uuid>` one per
   * browser. A web device may claim a free counter, never be linked to one.
   */
  private async assertTillDevice(tx: Tx, deviceId: string, branchId: string): Promise<void> {
    const device = await tx.deviceMaster.findFirst({
      where: { devId: deviceId, devIsDeleted: false },
      select: { devDeviceType: true, devDeviceUid: true, devBranchId: true, devIsBlocked: true },
    });
    if (!device) {
      throwTillBadRequest('tcnDeviceId must be a registered device', 'tcnDeviceId');
    }
    const uid = device.devDeviceUid.trim().toUpperCase();
    if (
      device.devDeviceType.trim().toUpperCase() === 'WEB' ||
      uid.startsWith('WEB:') ||
      uid.startsWith('WEB-')
    ) {
      throwTillBadRequest(
        'A web client cannot drive a counter: bind a Desktop or Mobile device',
        'tcnDeviceId',
      );
    }
    if (device.devIsBlocked) {
      throwTillBadRequest('That device is blocked', 'tcnDeviceId');
    }
    if (device.devBranchId && device.devBranchId !== branchId) {
      throwTillBadRequest('That device is registered to another branch', 'tcnDeviceId');
    }
  }

  private async assertLedger(
    tx: Tx,
    ledgerId: string,
    companyId: string,
    field: string,
  ): Promise<void> {
    const ledger = await tx.accLedgerMaster.findFirst({
      where: {
        ledId: ledgerId,
        ledIsDeleted: false,
        OR: [{ ledCompanyId: null }, { ledCompanyId: companyId }],
      },
      select: { ledId: true },
    });
    if (!ledger) {
      throwTillBadRequest(`${field} must be a ledger of this company`, field);
    }
  }

  private async assertNoLiveSession(
    tx: Tx,
    counterId: string,
    field: string,
    hint: string,
  ): Promise<void> {
    const live = await tx.tillSession.findFirst({
      where: {
        tssCounterId: counterId,
        tssIsDeleted: false,
        tssStatus: { in: [...LIVE_SESSION_STATUSES, TillSessionStatus.PENDING_APPROVAL] },
      },
      select: { tssSessionNo: true },
    });
    if (live) {
      throwTill(
        TillErrorCode.MASTER_IN_USE,
        `Session ${live.tssSessionNo} is live on this counter: ${hint}`,
        field,
      );
    }
  }

  private async logChange(
    tx: Tx,
    caller: TillCaller,
    tableName: string,
    pk: string,
    displayName: string,
    original: unknown,
    modified: unknown,
    action: 'insert' | 'update' | 'cancel' = original ? 'update' : 'insert',
  ): Promise<void> {
    await this.audit.logEntityChange(
      {
        action,
        tableName,
        screenName: SCREEN,
        screenType: 'master',
        pk,
        displayName,
        originalRecord: original,
        modifiedRecord: modified,
        userId: caller.userId,
        notes: `${tableName} ${action}`,
      },
      tx,
    );
  }

  /** The row, with the names a popup shows beside its ids (notes 101 §3). */
  private async counterPayload(
    tx: Tx | PrismaService,
    r: Prisma.TillCounterGetPayload<object>,
  ): Promise<TillCounterPayload> {
    const [device, safe] = await Promise.all([
      r.tcnDeviceId
        ? tx.deviceMaster.findUnique({
            where: { devId: r.tcnDeviceId },
            select: { devDeviceName: true },
          })
        : null,
      r.tcnSafeId
        ? tx.tillSafe.findUnique({ where: { tsfId: r.tcnSafeId }, select: { tsfName: true } })
        : null,
    ]);
    return {
      tcnId: r.tcnId,
      tcnCompanyId: r.tcnCompanyId,
      tcnBranchId: r.tcnBranchId,
      tcnCode: r.tcnCode,
      tcnName: r.tcnName,
      tcnKind: r.tcnKind,
      tcnDrawerMode: r.tcnDrawerMode,
      tcnDeviceId: r.tcnDeviceId,
      deviceName: device?.devDeviceName ?? null,
      tcnSafeId: r.tcnSafeId,
      safeName: safe?.tsfName ?? null,
      tcnDefaultFloat: num(r.tcnDefaultFloat),
      tcnCashAlertLimit: num(r.tcnCashAlertLimit),
      tcnCashBlockLimit: num(r.tcnCashBlockLimit),
      tcnZLastNo: r.tcnZLastNo,
      tcnRequiresSession: r.tcnRequiresSession,
      tcnSortOrder: r.tcnSortOrder,
      tcnRemarks: r.tcnRemarks,
      tcnIsActive: r.tcnIsActive,
      tcnCreatedOn: r.tcnCreatedOn.toISOString(),
      tcnModifiedOn: r.tcnModifiedOn?.toISOString() ?? null,
    };
  }

  private async safePayload(
    tx: Tx | PrismaService,
    r: Prisma.TillSafeGetPayload<object>,
  ): Promise<TillSafePayload> {
    const ledger = await tx.accLedgerMaster.findUnique({
      where: { ledId: r.tsfLedgerId },
      select: { ledName: true },
    });
    return {
      tsfId: r.tsfId,
      tsfCompanyId: r.tsfCompanyId,
      tsfBranchId: r.tsfBranchId,
      tsfCode: r.tsfCode,
      tsfName: r.tsfName,
      tsfLedgerId: r.tsfLedgerId,
      ledgerName: ledger?.ledName ?? null,
      tsfInsuredLimit: num(r.tsfInsuredLimit),
      tsfIsDefault: r.tsfIsDefault,
      tsfRemarks: r.tsfRemarks,
      tsfIsActive: r.tsfIsActive,
      tsfCreatedOn: r.tsfCreatedOn.toISOString(),
      tsfModifiedOn: r.tsfModifiedOn?.toISOString() ?? null,
    };
  }

  private async reasonPayload(
    tx: Tx | PrismaService,
    r: Prisma.TillReasonGetPayload<object>,
  ): Promise<TillReasonPayload> {
    const ledger = r.trsLedgerId
      ? await tx.accLedgerMaster.findUnique({
          where: { ledId: r.trsLedgerId },
          select: { ledName: true },
        })
      : null;
    return {
      trsId: r.trsId,
      trsCompanyId: r.trsCompanyId,
      trsCategory: r.trsCategory,
      trsCode: r.trsCode,
      trsName: r.trsName,
      trsLedgerId: r.trsLedgerId,
      ledgerName: ledger?.ledName ?? null,
      trsNeedsNote: r.trsNeedsNote,
      trsNeedsRef: r.trsNeedsRef,
      trsMaxAmount: num(r.trsMaxAmount),
      trsSortOrder: r.trsSortOrder,
      trsIsActive: r.trsIsActive,
      shipped: r.trsCompanyId === null,
    };
  }

  private denominationPayload(
    r: Prisma.TillDenominationGetPayload<object>,
  ): TillDenominationPayload {
    return {
      tdnId: r.tdnId,
      tdnCompanyId: r.tdnCompanyId,
      tdnCurrency: r.tdnCurrency,
      tdnValue: num(r.tdnValue),
      tdnKind: r.tdnKind as 'NOTE' | 'COIN',
      tdnLabel: r.tdnLabel,
      tdnBundleQty: r.tdnBundleQty,
      tdnSortOrder: r.tdnSortOrder,
      tdnValidTo: r.tdnValidTo ? isoDateOf(r.tdnValidTo) : null,
      tdnIsActive: r.tdnIsActive,
      shipped: r.tdnCompanyId === null,
    };
  }

  private rulePayload(r: Prisma.TillApprovalRuleGetPayload<object>): TillApprovalRulePayload {
    return {
      tarId: r.tarId,
      tarCompanyId: r.tarCompanyId,
      tarBranchId: r.tarBranchId,
      tarEventCode: r.tarEventCode,
      tarMode: r.tarMode,
      tarThresholdAmount: num(r.tarThresholdAmount),
      tarThresholdCount: r.tarThresholdCount,
      tarThresholdPercent: Number(r.tarThresholdPercent.toFixed(3)),
      tarChannel: r.tarChannel,
      tarMinRole: r.tarMinRole,
      tarTwoPerson: r.tarTwoPerson,
      tarAllowSelf: r.tarAllowSelf,
      tarBlocksTill: r.tarBlocksTill,
      tarExpireMinutes: r.tarExpireMinutes,
      tarEffectiveFrom: isoDateOf(r.tarEffectiveFrom),
      tarRemarks: r.tarRemarks,
      tarIsActive: r.tarIsActive,
      shipped: r.tarCompanyId === null,
    };
  }

  private async authorityPayload(
    tx: Tx | PrismaService,
    r: Prisma.TillApprovalAuthorityGetPayload<object>,
  ): Promise<TillApprovalAuthorityPayload> {
    const user = await tx.userMaster.findUnique({
      where: { usrId: r.taaUserId },
      select: { usrLoginName: true, usrDisplayName: true },
    });
    return {
      taaId: r.taaId,
      taaUserId: r.taaUserId,
      userName: user?.usrDisplayName ?? user?.usrLoginName ?? null,
      taaCompanyId: r.taaCompanyId,
      taaBranchId: r.taaBranchId,
      taaRole: r.taaRole,
      taaEventCode: r.taaEventCode,
      taaMaxAmount: r.taaMaxAmount === null ? null : num(r.taaMaxAmount),
      taaCanRemote: r.taaCanRemote,
      taaValidFrom: isoDateOf(r.taaValidFrom),
      taaValidTo: r.taaValidTo ? isoDateOf(r.taaValidTo) : null,
      taaRemarks: r.taaRemarks,
      taaIsActive: r.taaIsActive,
    };
  }
}
