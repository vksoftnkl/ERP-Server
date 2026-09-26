import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { DocRegisterService } from '../../../common/posting/doc-register.service';
import { VoucherPostingService } from '../../../common/posting/voucher-posting.service';
import type { RegisterDetailLine, RegisterDoc } from '../../../common/posting/doc-register.types';
import type { VoucherLeg } from '../../../common/posting/voucher-leg.types';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from '../../../common/txn-status-log/txn-status-log.helper';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { assertVoucherPartitionExists } from '../receipt/receipt.guards';
import { assertBooksReconcile } from '../reconcile/books-reconcile.guard';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import type { BillKey } from '../billBalance/bill-balance-recompute.service';
import type {
  DeletePayload,
  DraftSavedPayload,
  DrCr,
  ValidatePayload,
  VoucherAllocationPayload,
  VoucherBillPayload,
  VoucherGstDocPayload,
  VoucherHeaderPayload,
  VoucherLegPayload,
  VoucherPayload,
  VoucherRights,
  VoucherStatus,
  VoucherTdsPayload,
  VoucherTypeRules,
} from './types/vouchers-api.types';
import type {
  PostVoucherDto,
  ValidateVoucherDto,
  VoucherKeysDto,
  VoucherPayloadDto,
} from './dto/voucher-payload.dto';
import {
  derive,
  registerDeductee,
  roleKey,
  toWire,
  type AllocationInput,
  type DeriveInput,
  type DerivedInternal,
  type TypedLineInput,
} from './voucher-derive';
import {
  GENERATED_ROLES,
  loadBills,
  loadCompanyFacts,
  loadGeneratedRoleLedgers,
  loadInstrumentLedgers,
  loadLedgerFacts,
  loadPartyCreditDays,
  loadTaxRates,
  loadTdsAnnualBase,
  loadTdsRate,
  resolveRoleLedgerMap,
  type CompanyFacts,
  type LedgerFacts,
  type RoleLedgerAsk,
} from './voucher-facts';
import {
  raiseBill,
  writeAllocations,
  otherVoucherOnRaisedBills,
  type RaisedBill,
} from './voucher-billwise.helper';
import { VoucherTypesService } from './voucher-types.service';
import {
  newGuardContext,
  refuse,
  throwInvalid,
  throwMissing,
  throwRefusals,
  throwRight,
  throwState,
  VCH,
  type VoucherGuardContext,
} from './vouchers.errors';

const TX = { maxWait: 15_000, timeout: 120_000 };
const BACKDATE_SETTING = 'accounts.backdate_mode';
const GENERATED = new Set<string>(GENERATED_ROLES);

/** The header as every route reads it. */
export interface StoredVoucher {
  avh_voucher_id: string;
  avh_company_id: string;
  avh_branch_id: string;
  avh_tenant_id: string | null;
  avh_acc_year: string;
  avh_voucher_type_id: number;
  avh_voucher_no: bigint | null;
  avh_voucher_slno: bigint | null;
  avh_voucher_refno: string | null;
  avh_voucher_date: Date;
  avh_party_id: string | null;
  avh_doc_refno: string | null;
  avh_doc_date: Date | null;
  avh_usr_refno: string | null;
  avh_remarks: string | null;
  avh_doc_amount: Prisma.Decimal;
  avh_total_debit: Prisma.Decimal;
  avh_total_credit: Prisma.Decimal;
  avh_voucher_status: string;
  avh_status_on: Date | null;
  avh_posted_on: Date | null;
  avh_cancel_reason: string | null;
  avh_reversal_voucher_id: string | null;
  avh_reversal_acc_year: string | null;
  avh_against_voucher_id: string | null;
  avh_against_acc_year: string | null;
  avh_user_id: string;
  avh_session_id: string | null;
  avh_device_type: string | null;
  avh_device_id: string | null;
  avh_draft_lines: unknown;
  avh_is_deleted: boolean;
  avh_created_by: string | null;
  avh_created_on: Date;
  avh_modified_by: string | null;
  avh_modified_on: Date | null;
  party_name: string | null;
  reversal_refno: string | null;
  against_refno: string | null;
}

interface Prepared {
  type: VoucherTypeRules;
  rights: VoucherRights;
  company: CompanyFacts;
  party: LedgerFacts | null;
  ledgers: Map<string, LedgerFacts>;
  derived: DerivedInternal;
  ctx: VoucherGuardContext;
  header: {
    date: string;
    docRefno: string | null;
    docDate: string | null;
    usrRefno: string | null;
    remarks: string | null;
    posStcd: string | null;
    reverseCharge: boolean;
  };
}

/**
 * The register's five verbs (voucher_register.md §6.7 – §6.12) over the ONE
 * posting routine (§7): `/validate` and `/post` both run `derive()` on the
 * same facts; `/post` then writes — legs through the shared
 * `VoucherPostingService`, bills and allocations through the bill-wise
 * helper, the GST view through `DocRegisterService`, the TDS register row —
 * in one transaction, and finishes with the trial-mode books check.
 */
@Injectable()
export class VoucherRegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly types: VoucherTypesService,
    private readonly posting: VoucherPostingService,
    private readonly docRegister: DocRegisterService,
    private readonly recompute: BillBalanceRecomputeService,
  ) {}

  private caller(): { userId: string | null; actor: string } {
    const userId = this.requestContext.getUserId();
    return { userId, actor: userId ?? DEFAULT_ACTOR };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §6.7  /create — a DRAFT: the header and the payload, nothing else
  // ═════════════════════════════════════════════════════════════════════════

  async create(dto: VoucherPayloadDto, raw?: Record<string, unknown>): Promise<DraftSavedPayload> {
    const { userId, actor } = this.caller();
    return this.prisma.$transaction(async (tx) => {
      const type = await this.loadRegisterType(tx, dto.header.typeCode);
      const rights = await this.types.rightsFor(tx, userId, type);
      this.assertDateInYear(dto.header.date, dto.header.accYear);
      if (type.partyMode === 'ONE' && !dto.header.partyId) {
        throwInvalid(`A ${type.typeName} needs one party`, VCH.PARTY_MODE, 'header.partyId');
      }
      if (type.partyMode !== 'ONE' && dto.header.partyId) {
        throwInvalid(
          `A ${type.typeName} carries no party on the header`,
          VCH.PARTY_MODE,
          'header.partyId',
        );
      }

      const existing = dto.header.voucherId
        ? await this.lockHeader(tx, dto.header.voucherId, dto.header.accYear)
        : null;
      if (dto.header.voucherId && !existing) {
        throwMissing(
          `No voucher ${dto.header.voucherId} in ${dto.header.accYear}`,
          VCH.NOT_FOUND,
          'header.voucherId',
        );
      }
      if (existing) {
        this.assertScope(existing, dto.header);
        if (existing.avh_voucher_status !== 'DRAFT') {
          throwState(
            `${existing.avh_voucher_refno ?? existing.avh_voucher_id} is ${existing.avh_voucher_status} — a posted voucher is corrected by cancel and re-enter`,
            existing.avh_voucher_status === 'POSTED' ? VCH.POSTED : VCH.NOT_DRAFT,
            'header.voucherId',
          );
        }
        if (existing.avh_voucher_type_id !== type.typeId) {
          throwState(
            'A draft keeps its type — start a new voucher to change it',
            VCH.NOT_DRAFT,
            'header.typeCode',
          );
        }
        if (!rights.edit) {
          throwRight('This user may not edit on this voucher type’s menu', VCH.RIGHT_EDIT);
        }
      } else if (!rights.create) {
        throwRight('This user may not create on this voucher type’s menu', VCH.RIGHT_CREATE);
      }

      // The payload as SENT (overrides stripped: they belong to a post, not a draft).
      const { overrides: _o, ...sent } = (raw ?? dto) as Record<string, unknown>;
      const draft = JSON.parse(JSON.stringify(sent)) as Prisma.InputJsonValue;
      const docAmount = dto.lines
        .filter((l) => l.drCr === 'DR')
        .reduce((s, l) => s.plus(new Prisma.Decimal(l.amount)), new Prisma.Decimal(0))
        .toDecimalPlaces(2);
      const now = new Date();
      const partyId = type.partyMode === 'ONE' ? (dto.header.partyId ?? null) : null;

      let voucherId: string;
      if (existing) {
        voucherId = existing.avh_voucher_id;
        await tx.$executeRaw`
          UPDATE accounts.acc_voucher_header
             SET avh_voucher_date = ${dto.header.date}::date,
                 avh_party_id     = ${partyId}::uuid,
                 avh_doc_refno    = ${dto.header.docRefno ?? null},
                 avh_doc_date     = ${dto.header.docDate ?? null}::date,
                 avh_usr_refno    = ${dto.header.usrRefno ?? null},
                 avh_remarks      = ${dto.header.remarks ?? null},
                 avh_doc_amount   = ${docAmount.toFixed(2)}::numeric,
                 avh_draft_lines  = ${JSON.stringify(draft)}::jsonb,
                 avh_modified_on  = ${now},
                 avh_modified_by  = ${actor}
           WHERE avh_voucher_id = ${voucherId}::uuid AND avh_acc_year = ${dto.header.accYear}::char(9)`;
      } else {
        const [row] = await tx.$queryRaw<{ avh_voucher_id: string }[]>`
          INSERT INTO accounts.acc_voucher_header (
            avh_company_id, avh_branch_id, avh_acc_year, avh_voucher_type_id,
            avh_voucher_date, avh_party_id, avh_doc_refno, avh_doc_date, avh_usr_refno,
            avh_remarks, avh_doc_amount, avh_voucher_status, avh_user_id, avh_draft_lines,
            avh_created_by
          ) VALUES (
            ${dto.header.companyId}::uuid, ${dto.header.branchId}::uuid, ${dto.header.accYear}::char(9),
            ${type.typeId}::int,
            ${dto.header.date}::date, ${partyId}::uuid, ${dto.header.docRefno ?? null},
            ${dto.header.docDate ?? null}::date, ${dto.header.usrRefno ?? null},
            ${dto.header.remarks ?? null}, ${docAmount.toFixed(2)}::numeric, 'DRAFT',
            ${actor}::uuid, ${JSON.stringify(draft)}::jsonb, ${actor}
          )
          RETURNING avh_voucher_id`;
        voucherId = row.avh_voucher_id;
        await appendTxnStatusLog(tx, {
          companyId: dto.header.companyId,
          branchId: dto.header.branchId,
          tenantId: null,
          accYear: dto.header.accYear,
          srcModule: TxnStatusSrcModule.ACCOUNTS,
          srcDocType: statusDocType(type),
          srcDocId: voucherId,
          event: TxnStatusEvent.CREATED,
          toStatus: 'DRAFT',
          changedBy: actor,
          changedOn: now,
        });
      }
      return {
        voucherId,
        companyId: dto.header.companyId,
        branchId: dto.header.branchId,
        accYear: dto.header.accYear,
        typeCode: type.typeCode,
        status: 'DRAFT',
        created: !existing,
      };
    }, TX);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §6.8  /validate — the same code, dry
  // ═════════════════════════════════════════════════════════════════════════

  async validate(dto: ValidateVoucherDto): Promise<ValidatePayload> {
    const { userId } = this.caller();
    const tx = this.prisma as unknown as Prisma.TransactionClient;
    const type = await this.loadRegisterType(tx, dto.header.typeCode);
    const rights = await this.types.rightsFor(tx, userId, type);
    if (!rights.view) {
      throwRight('This user may not view on this voucher type’s menu', VCH.RIGHT_VIEW);
    }
    const p = await this.prepare(tx, type, rights, dto, { dryRun: true, lock: false });
    return {
      ok: p.ctx.refusals.length === 0,
      derived: toWire(type.typeCode, dto.header.date, p.derived),
      refusals: p.ctx.refusals,
      warnings: p.ctx.warnings,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §6.9  /post — the routine, in ONE transaction
  // ═════════════════════════════════════════════════════════════════════════

  async post(dto: PostVoucherDto): Promise<VoucherPayload> {
    const { userId, actor } = this.caller();
    return this.prisma.$transaction(async (tx) => {
      // 1 · the type, and the rights on ITS menu
      const type = await this.loadRegisterType(tx, dto.header.typeCode);
      const rights = await this.types.rightsFor(tx, userId, type);
      if (!rights.post) {
        throwRight('This user may not post on this voucher type’s menu', VCH.RIGHT_POST);
      }
      let existing: StoredVoucher | null = null;
      if (dto.header.voucherId) {
        existing = await this.lockHeader(tx, dto.header.voucherId, dto.header.accYear);
        if (!existing) {
          throwMissing(
            `No voucher ${dto.header.voucherId} in ${dto.header.accYear}`,
            VCH.NOT_FOUND,
            'header.voucherId',
          );
        }
        this.assertScope(existing, dto.header);
        if (existing.avh_voucher_status !== 'DRAFT') {
          throwState(
            `${existing.avh_voucher_refno ?? existing.avh_voucher_id} is already ${existing.avh_voucher_status}`,
            existing.avh_voucher_status === 'POSTED' ? VCH.POSTED : VCH.CANCELLED,
            'header.voucherId',
          );
        }
        if (existing.avh_voucher_type_id !== type.typeId) {
          throwState(
            'A draft keeps its type — start a new voucher to change it',
            VCH.NOT_DRAFT,
            'header.typeCode',
          );
        }
      } else if (!rights.create) {
        throwRight('This user may not create on this voucher type’s menu', VCH.RIGHT_CREATE);
      }

      // 2 · calendar (the partition, loudly; the lock and the year through the guard list)
      await assertVoucherPartitionExists(tx, dto.header.accYear, 'header.accYear');

      // 3 – 7, 10 – 12 · derive, with every bill named held FOR UPDATE
      const p = await this.prepare(tx, type, rights, dto, { dryRun: false, lock: true });
      if (p.ctx.refusals.length > 0) {
        throwRefusals(`${type.typeName} cannot be posted`, p.ctx.refusals);
      }
      const d = p.derived;
      const now = new Date();

      // 8 – 9 · number and write the header and the legs
      const partyIds = new Set<string>();
      if (d.party) partyIds.add(d.party.ledger.ledId);
      for (const b of d.bills) partyIds.add(b.party.ledId);
      for (const a of d.allocations) partyIds.add(a.party.ledId);

      const legs: VoucherLeg[] = d.legs.map((l) => ({
        ledgerId: l.ledger.ledId,
        drCr: l.drCr,
        amount: Number(l.amount.toFixed(2)),
        remarks: l.remarks,
        roleTag: l.role,
        oppLedgerId: l.oppLedgerId,
        field: l.lineRowNo === null ? l.source : `lines.${l.lineRowNo}`,
      }));
      const docAmount = d.party ? d.party.amount : d.totals.debit;
      const voucher = await this.posting.postLegs(tx, {
        header: {
          companyId: dto.header.companyId,
          branchId: dto.header.branchId,
          tenantId: existing?.avh_tenant_id ?? null,
          accYear: dto.header.accYear,
          voucherTypeId: type.typeId,
          voucherDate: dto.header.date,
          docLabel: type.typeName,
          docRefno: p.header.docRefno,
          docDate: p.header.docDate ?? dto.header.date,
          usrRefno: p.header.usrRefno,
          docAmount: Number(docAmount.toFixed(2)),
          roundOff: 0,
          partyId: d.party?.ledger.ledId ?? null,
          userId: actor,
          sessionId: existing?.avh_session_id ?? null,
          deviceType: existing?.avh_device_type ?? null,
          deviceId: existing?.avh_device_id ?? null,
          remarks: p.header.remarks,
          deviceCode: null,
          createdBy: actor,
          draftVoucherId: existing?.avh_voucher_id ?? null,
        },
        legs,
      });
      const voucherId = voucher.voucherId;
      const refno = voucher.voucherRefno ?? voucherId;
      if (existing) {
        await tx.$executeRaw`
          UPDATE accounts.acc_voucher_header SET avh_draft_lines = NULL
           WHERE avh_voucher_id = ${voucherId}::uuid AND avh_acc_year = ${dto.header.accYear}::char(9)`;
      }
      const legRows = await tx.$queryRaw<{ av_id: string; av_row_no: number }[]>`
        SELECT av_id, av_row_no FROM accounts.acc_vouchers
         WHERE av_voucher_id = ${voucherId}::uuid AND av_acc_year = ${dto.header.accYear}::char(9)
           AND av_is_deleted = false`;
      const legAvIdByRow = new Map(legRows.map((r) => [r.av_row_no, r.av_id]));

      // 10 · bills and allocations
      const billCtx = {
        companyId: dto.header.companyId,
        branchId: dto.header.branchId,
        tenantId: existing?.avh_tenant_id ?? null,
        accYear: dto.header.accYear,
        voucherId,
        voucherTypeId: type.typeId,
        voucherNo: voucher.voucherLastNo,
        voucherDate: dto.header.date,
        voucherRefno: refno,
        docDate: p.header.docDate,
        userId: actor,
        sessionId: existing?.avh_session_id ?? null,
        actor,
        now,
      };
      const raisedByLine = new Map<number, RaisedBill>();
      const touched: BillKey[] = [];
      for (const b of d.bills) {
        const raised = await raiseBill(tx, billCtx, b, legAvIdByRow.get(b.legRowNo) ?? null);
        raisedByLine.set(b.lineRowNo, raised);
        touched.push(raised);
      }
      touched.push(
        ...(await writeAllocations(tx, billCtx, d.allocations, raisedByLine, legAvIdByRow)),
      );
      if (touched.length > 0) {
        await this.recompute.recomputeBills(tx, touched, now);
      }

      // 11 · the GST view
      if (d.gst) {
        await this.docRegister.write(
          tx,
          this.registerDoc(p, d, voucherId, voucher.voucherLastNo, refno, dto, actor),
          {
            companyEinvoiceFlag:
              d.gst.docFlow === 'OUTWARD' && !!p.party?.gstin
                ? p.company.einvoiceApplicable
                : false,
            interState: d.gst.supplyNature === 'INTER',
          },
        );
      }

      // 12 · the TDS register (a below-threshold row too: it is what the annual
      // threshold counts). One row per deductee — notes (53): a multi-party
      // Payment writes one per party line's party, since 26Q is per deductee.
      for (const t of d.tdsLines) {
        const raised = raisedByLine.get(t.lineRowNo ?? 0) ?? null;
        await tx.$executeRaw`
          INSERT INTO accounts.acc_tds_register (
            atd_company_id, atd_branch_id, atd_tenant_id, atd_acc_year, atd_quarter, atd_direction,
            atd_party_id, atd_pan, atd_party_name, atd_deductee_type, atd_section, atd_rate,
            atd_rate_source, atd_base_amount, atd_tax_amount, atd_voucher_id, atd_voucher_acc_year,
            atd_doc_refno, atd_doc_date, atd_bill_id, atd_bill_acc_year, atd_remarks, atd_created_by
          ) VALUES (
            ${dto.header.companyId}::uuid, ${dto.header.branchId}::uuid, ${existing?.avh_tenant_id ?? null}::uuid,
            ${dto.header.accYear}::char(9), ${quarterOf(dto.header.date)}::bpchar, 'DEDUCTED',
            ${t.party.ledId}::uuid, ${t.party.pan}, ${t.party.name.slice(0, 150)},
            ${t.registerDeductee}, ${t.section}, ${t.rate.toFixed(3)}::numeric,
            ${t.rateSource}, ${t.base.toFixed(2)}::numeric, ${t.tax.toFixed(2)}::numeric,
            ${voucherId}::uuid, ${dto.header.accYear}::char(9),
            ${refno.slice(0, 50)}, ${dto.header.date}::date,
            ${raised?.billId ?? null}::uuid, ${raised?.accYear ?? null}::char(9),
            ${t.reason?.slice(0, 250) ?? null}, ${actor}
          )`;
      }

      // 13 · the trail, then the trial-mode books check
      await appendTxnStatusLog(tx, {
        companyId: dto.header.companyId,
        branchId: dto.header.branchId,
        tenantId: existing?.avh_tenant_id ?? null,
        accYear: dto.header.accYear,
        srcModule: TxnStatusSrcModule.ACCOUNTS,
        srcDocType: statusDocType(type),
        srcDocId: voucherId,
        srcDocRefno: refno,
        event: TxnStatusEvent.POSTED,
        fromStatus: existing ? 'DRAFT' : null,
        toStatus: 'POSTED',
        changedBy: actor,
        changedOn: now,
        deviceId: existing?.avh_device_id ?? null,
        sessionId: existing?.avh_session_id ?? null,
      });
      await assertBooksReconcile(tx, {
        companyId: dto.header.companyId,
        accYear: dto.header.accYear,
        ledgerIds: [...partyIds],
        vouchers: [{ voucherId, accYear: dto.header.accYear }],
      });

      const stored = await this.loadHeader(tx, voucherId, dto.header.accYear);
      return this.assemble(tx, stored!, type, rights);
    }, TX);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §6.11  /delete — a DRAFT only
  // ═════════════════════════════════════════════════════════════════════════

  async deleteDraft(keys: VoucherKeysDto): Promise<DeletePayload> {
    const { userId, actor } = this.caller();
    return this.prisma.$transaction(async (tx) => {
      const stored = await this.lockHeader(tx, keys.voucherId, keys.accYear);
      if (!stored) {
        throwMissing(`No voucher ${keys.voucherId} in ${keys.accYear}`, VCH.NOT_FOUND);
      }
      this.assertScope(stored, keys);
      const type = await this.types.loadTypeById(tx, stored.avh_voucher_type_id);
      const rights = type ? await this.types.rightsFor(tx, userId, type) : null;
      if (!rights?.delete) {
        throwRight('This user may not delete on this voucher type’s menu', VCH.RIGHT_DELETE);
      }
      if (stored.avh_voucher_status !== 'DRAFT') {
        throwState(
          `${stored.avh_voucher_refno ?? keys.voucherId} is ${stored.avh_voucher_status} — a posted voucher is cancelled, never deleted`,
          stored.avh_voucher_status === 'POSTED' ? VCH.POSTED : VCH.CANCELLED,
        );
      }
      const now = new Date();
      await tx.$executeRaw`
        UPDATE accounts.acc_voucher_header
           SET avh_is_deleted = true, avh_is_active = false,
               avh_modified_on = ${now}, avh_modified_by = ${actor}
         WHERE avh_voucher_id = ${keys.voucherId}::uuid AND avh_acc_year = ${keys.accYear}::char(9)`;
      await appendTxnStatusLog(tx, {
        companyId: stored.avh_company_id,
        branchId: stored.avh_branch_id,
        tenantId: stored.avh_tenant_id,
        accYear: stored.avh_acc_year,
        srcModule: TxnStatusSrcModule.ACCOUNTS,
        srcDocType: statusDocType(type!),
        srcDocId: keys.voucherId,
        event: TxnStatusEvent.DELETED,
        fromStatus: 'DRAFT',
        toStatus: 'DRAFT',
        changedBy: actor,
        changedOn: now,
      });
      return { voucherId: keys.voucherId, accYear: keys.accYear, deleted: true };
    }, TX);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  §6.12  /get
  // ═════════════════════════════════════════════════════════════════════════

  async get(keys: VoucherKeysDto): Promise<VoucherPayload> {
    const { userId } = this.caller();
    const tx = this.prisma as unknown as Prisma.TransactionClient;
    const stored = await this.loadHeader(tx, keys.voucherId, keys.accYear);
    if (!stored) {
      throwMissing(`No voucher ${keys.voucherId} in ${keys.accYear}`, VCH.NOT_FOUND);
    }
    this.assertScope(stored, keys);
    const type = await this.types.loadTypeById(tx, stored.avh_voucher_type_id);
    if (!type) {
      throwMissing('The voucher’s type no longer exists', VCH.NOT_FOUND, 'typeCode');
    }
    // A reversal (`Rev`) is read on the ORIGINAL type's menu.
    const rightsType =
      type.menuId === null && stored.avh_against_voucher_id && stored.avh_against_acc_year
        ? await this.typeOfVoucher(tx, stored.avh_against_voucher_id, stored.avh_against_acc_year)
        : type;
    const rights = await this.types.rightsFor(tx, userId, rightsType ?? type);
    if (!rights.view) {
      throwRight('This user may not view on this voucher type’s menu', VCH.RIGHT_VIEW);
    }
    return this.assemble(tx, stored, type, rights);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  shared
  // ═════════════════════════════════════════════════════════════════════════

  async loadRegisterType(
    tx: Prisma.TransactionClient,
    typeCode: string,
  ): Promise<VoucherTypeRules> {
    const type = await this.types.loadTypeByCode(tx, typeCode);
    if (!type) {
      throwMissing(
        `No active voucher type '${typeCode}'`,
        VCH.TYPE_NOT_REGISTER,
        'header.typeCode',
      );
    }
    if (!type.inRegister) {
      throwState(
        `${type.typeName} is not a Voucher Register type`,
        VCH.TYPE_NOT_REGISTER,
        'header.typeCode',
      );
    }
    if (type.affectsInventory) {
      throwState(
        `${type.typeName} moves stock — the register never does`,
        VCH.TYPE_INVENTORY,
        'header.typeCode',
      );
    }
    return type;
  }

  async typeOfVoucher(
    tx: Prisma.TransactionClient,
    voucherId: string,
    accYear: string,
  ): Promise<VoucherTypeRules | null> {
    const rows = await tx.$queryRaw<{ avh_voucher_type_id: number }[]>`
      SELECT avh_voucher_type_id FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${voucherId}::uuid AND avh_acc_year = ${accYear}::char(9)`;
    return rows[0] ? this.types.loadTypeById(tx, rows[0].avh_voucher_type_id) : null;
  }

  async loadHeader(
    tx: Prisma.TransactionClient,
    voucherId: string,
    accYear: string,
    lock = false,
  ): Promise<StoredVoucher | null> {
    const rows = await tx.$queryRaw<StoredVoucher[]>`
      SELECT h.*, p.led_name AS party_name,
             rv.avh_voucher_refno AS reversal_refno, ag.avh_voucher_refno AS against_refno
        FROM accounts.acc_voucher_header h
        LEFT JOIN accounts.acc_ledger_master p ON p.led_id = h.avh_party_id
        LEFT JOIN accounts.acc_voucher_header rv
               ON rv.avh_voucher_id = h.avh_reversal_voucher_id AND rv.avh_acc_year = h.avh_reversal_acc_year
        LEFT JOIN accounts.acc_voucher_header ag
               ON ag.avh_voucher_id = h.avh_against_voucher_id AND ag.avh_acc_year = h.avh_against_acc_year
       WHERE h.avh_voucher_id = ${voucherId}::uuid AND h.avh_acc_year = ${accYear}::char(9)
         AND h.avh_is_deleted = false
       ${lock ? Prisma.sql`FOR UPDATE OF h` : Prisma.empty}`;
    const r = rows[0];
    if (!r) {
      return null;
    }
    return {
      ...r,
      avh_acc_year: r.avh_acc_year.trim(),
      avh_voucher_status: r.avh_voucher_status.trim(),
    };
  }

  lockHeader(
    tx: Prisma.TransactionClient,
    voucherId: string,
    accYear: string,
  ): Promise<StoredVoucher | null> {
    return this.loadHeader(tx, voucherId, accYear, true);
  }

  /** The four keys: a voucher at another company / branch / year is a 404, never a 403. */
  assertScope(
    stored: StoredVoucher,
    keys: { companyId: string; branchId: string; accYear: string },
  ): void {
    if (
      stored.avh_company_id !== keys.companyId ||
      stored.avh_branch_id !== keys.branchId ||
      stored.avh_acc_year !== keys.accYear
    ) {
      throwMissing('No such voucher at this company / branch / year', VCH.NOT_FOUND);
    }
  }

  private assertDateInYear(date: string, accYear: string): void {
    if (accYearOf(date) !== accYear) {
      throwInvalid(
        `${date} falls in ${accYearOf(date)}, not ${accYear}`,
        VCH.DATE_OUTSIDE_YEAR,
        'header.date',
      );
    }
  }

  /** Everything the derivation needs, read once, then `derive()`. */
  private async prepare(
    tx: Prisma.TransactionClient,
    type: VoucherTypeRules,
    rights: VoucherRights,
    dto: ValidateVoucherDto,
    opts: { dryRun: boolean; lock: boolean },
  ): Promise<Prepared> {
    const h = dto.header;
    const ctx = newGuardContext({
      dryRun: opts.dryRun,
      overrides: dto.overrides,
      canOverride: rights.override,
    });
    const company = await loadCompanyFacts(tx, h.companyId);
    if (!company) {
      throwMissing('No such company', VCH.NOT_FOUND, 'header.companyId');
    }

    // the calendar (§7.3 step 2): the year the date falls in, its status, the lock
    if (accYearOf(h.date) !== h.accYear) {
      refuse(
        ctx,
        VCH.DATE_OUTSIDE_YEAR,
        `${h.date} falls in ${accYearOf(h.date)}, not ${h.accYear}`,
        { field: 'header.date' },
      );
    }
    const fy = await tx.$queryRaw<{ fy_status: string; fy_lock_date: Date | null }[]>`
      SELECT fy_status, fy_lock_date FROM public.fiscal_years
       WHERE comp_id = ${h.companyId}::uuid AND fy_year_name = ${h.accYear}::char(9) AND is_deleted = false
       LIMIT 1`;
    if (fy[0]) {
      if (fy[0].fy_status.trim().toUpperCase() !== 'OPEN') {
        refuse(ctx, VCH.YEAR_CLOSED, `Accounting year ${h.accYear} is ${fy[0].fy_status.trim()}`, {
          field: 'header.accYear',
        });
      }
      const lock = fy[0].fy_lock_date ? fy[0].fy_lock_date.toISOString().slice(0, 10) : null;
      if (lock && h.date <= lock) {
        refuse(
          ctx,
          VCH.PERIOD_LOCKED,
          `${h.accYear} is locked up to ${lock}; ${h.date} cannot be posted into`,
          { field: 'header.date' },
        );
      }
    }

    const lines: TypedLineInput[] = dto.lines.map((l) => ({
      rowNo: l.rowNo,
      drCr: l.drCr,
      ledgerId: l.ledgerId,
      amount: new Prisma.Decimal(l.amount),
      remarks: l.remarks?.trim() || null,
      gst: l.gst
        ? {
            taxId: l.gst.taxId,
            hsn: l.gst.hsn ?? null,
            itcEligibility: l.gst.itcEligibility ?? null,
          }
        : null,
      tdsBase: l.tdsBase ?? null,
    }));
    const allocations: AllocationInput[] = (dto.allocations ?? []).map((a, index) => ({
      index,
      lineRowNo: a.lineRowNo,
      billId: a.billId,
      billAccYear: a.billAccYear,
      amount: new Prisma.Decimal(a.amount),
    }));

    const ledgerIds = lines.map((l) => l.ledgerId);
    if (h.partyId) ledgerIds.push(h.partyId);
    const [ledgers, instrumentLedgers, generatedRoleLedgers, taxRates] = await Promise.all([
      loadLedgerFacts(tx, h.companyId, ledgerIds),
      loadInstrumentLedgers(tx, h.companyId),
      loadGeneratedRoleLedgers(tx, h.companyId, h.branchId),
      loadTaxRates(
        tx,
        lines.filter((l) => l.gst).map((l) => l.gst!.taxId),
      ),
    ]);
    const party = h.partyId ? (ledgers.get(h.partyId) ?? null) : null;

    // every (role, rate, nature) the band could ask for — one round trip
    const asks: RoleLedgerAsk[] = [];
    if (type.gstRegister && type.gstSide) {
      const prefix = type.gstSide === 'INPUT' ? 'INPUT_' : 'OUTPUT_';
      const taxIds = [...new Set(lines.filter((l) => l.gst).map((l) => l.gst!.taxId))];
      for (const taxId of taxIds) {
        for (const nature of ['INTRA', 'INTER'] as const) {
          for (const c of ['CGST', 'SGST', 'IGST', 'CESS']) {
            asks.push({ role: `${prefix}${c}`, taxId, supplyNature: nature });
          }
          if (h.reverseCharge && type.gstSide === 'INPUT') {
            for (const c of ['CGST', 'SGST', 'IGST']) {
              asks.push({ role: `RCM_${c}_PAYABLE`, taxId, supplyNature: nature });
            }
          }
        }
      }
    }
    if (type.tdsMode === 'DEDUCT') {
      asks.push({ role: 'TDS_PAYABLE', taxId: null, supplyNature: null });
    }
    const roleLedgers = await resolveRoleLedgerMap(tx, h.companyId, h.branchId, asks);

    const creditDaysByLedger = new Map<string, number>();
    const partyLedgers = new Set<string>();
    if (party) partyLedgers.add(party.ledId);
    for (const l of lines) {
      const f = ledgers.get(l.ledgerId);
      if (f && (f.isParty || f.isBillByBill)) partyLedgers.add(f.ledId);
    }
    for (const id of partyLedgers) {
      creditDaysByLedger.set(id, await loadPartyCreditDays(tx, id));
    }

    let tds: DeriveInput['tds'] = null;
    if (type.tdsMode === 'DEDUCT' && party?.isTdsApplicable && party.tdsSection) {
      const [rate, annualBaseSoFar] = await Promise.all([
        loadTdsRate(tx, h.companyId, party.tdsSection, party.tdsDeducteeType, h.date),
        loadTdsAnnualBase(tx, h.companyId, party.ledId, h.accYear, party.tdsSection),
      ]);
      tds = { rate, annualBaseSoFar };
    }
    // notes (53): a multi-party type deducts per party line, so the same two
    // facts are loaded for every TDS-applicable party ledger on the lines.
    const tdsByParty = new Map<string, NonNullable<DeriveInput['tds']>>();
    if (type.tdsMode === 'DEDUCT' && type.partyMode === 'MANY') {
      for (const l of lines) {
        const f = ledgers.get(l.ledgerId);
        if (!f || tdsByParty.has(f.ledId)) continue;
        if (!(f.isParty || f.isBillByBill) || !f.isTdsApplicable || !f.tdsSection) continue;
        const [rate, annualBaseSoFar] = await Promise.all([
          loadTdsRate(tx, h.companyId, f.tdsSection, f.tdsDeducteeType, h.date),
          loadTdsAnnualBase(tx, h.companyId, f.ledId, h.accYear, f.tdsSection),
        ]);
        tdsByParty.set(f.ledId, { rate, annualBaseSoFar });
      }
    }

    const bills = await loadBills(tx, allocations, opts.lock);

    // the party's document number, seen before? (ux_avh_doc_refno / ux_abl_doc_refno, then softer)
    let docRefnoClash: DeriveInput['docRefnoClash'] = null;
    const docRefno = h.docRefno?.trim() || null;
    if (docRefno && party) {
      const [hit] = await tx.$queryRaw<{ exact: bigint; other: bigint; bill: bigint }[]>`
        SELECT
          (SELECT count(*) FROM accounts.acc_voucher_header x
            WHERE x.avh_company_id = ${h.companyId}::uuid AND x.avh_party_id = ${party.ledId}::uuid
              AND x.avh_voucher_type_id = ${type.typeId}::int AND x.avh_acc_year = ${h.accYear}::char(9)
              AND x.avh_doc_refno = ${docRefno} AND x.avh_is_deleted = false
              AND x.avh_voucher_status <> 'CANCELLED'
              AND (${h.voucherId ?? null}::uuid IS NULL OR x.avh_voucher_id <> ${h.voucherId ?? null}::uuid)) AS exact,
          (SELECT count(*) FROM accounts.acc_voucher_header x
            WHERE x.avh_company_id = ${h.companyId}::uuid AND x.avh_party_id = ${party.ledId}::uuid
              AND x.avh_doc_refno = ${docRefno} AND x.avh_is_deleted = false
              AND x.avh_voucher_status <> 'CANCELLED'
              AND (${h.voucherId ?? null}::uuid IS NULL OR x.avh_voucher_id <> ${h.voucherId ?? null}::uuid)) AS other,
          (SELECT count(*) FROM accounts.acc_bill_balance b
            WHERE b.abl_company_id = ${h.companyId}::uuid AND b.abl_party_id = ${party.ledId}::uuid
              AND b.abl_bill_type = ${type.raiseBillType ?? ''} AND b.abl_acc_year = ${h.accYear}::char(9)
              AND b.abl_doc_refno = ${docRefno} AND b.abl_is_deleted = false) AS bill`;
      if (Number(hit.exact) > 0 || (type.billwiseMode === 'RAISE' && Number(hit.bill) > 0)) {
        docRefnoClash = 'INDEX';
      } else if (Number(hit.other) > 0) {
        docRefnoClash = 'OTHER';
      }
    }

    const backdateMode = await this.backdateMode(tx, h.companyId);
    const input: DeriveInput = {
      type,
      header: {
        date: h.date,
        partyId: h.partyId ?? null,
        posStcd: h.posStcd?.trim() || null,
        reverseCharge: h.reverseCharge ?? false,
        docRefno,
      },
      lines,
      allocations,
      newBill: dto.newBill ? { dueDays: dto.newBill.dueDays ?? null } : null,
      company,
      ledgers,
      instrumentLedgers,
      generatedRoleLedgers,
      taxRates,
      roleLedgers,
      party,
      creditDaysByLedger,
      tds,
      tdsByParty,
      bills,
      docRefnoClash,
      backdateMode,
      today: new Date().toISOString().slice(0, 10),
      ctx,
    };
    const derived = derive(input);
    return {
      type,
      rights,
      company,
      party,
      ledgers,
      derived,
      ctx,
      header: {
        date: h.date,
        docRefno,
        docDate: h.docDate ?? null,
        usrRefno: h.usrRefno?.trim() || null,
        remarks: h.remarks?.trim() || null,
        posStcd: h.posStcd?.trim() || null,
        reverseCharge: h.reverseCharge ?? false,
      },
    };
  }

  /** `accounts.backdate_mode` (OFF | WARN | REFUSE) through the settings resolver; absent = OFF. */
  private async backdateMode(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<'OFF' | 'WARN' | 'REFUSE'> {
    const [row] = await tx.$queryRaw<{ value: string | null }[]>`
      SELECT out_effective_value AS value
        FROM public.fn_app_settings_effective(${companyId}::uuid, NULL::uuid, NULL::uuid, NULL::uuid)
       WHERE out_asd_key = ${BACKDATE_SETTING}`;
    const token = row?.value?.trim().toUpperCase();
    return token === 'WARN' || token === 'REFUSE' ? token : 'OFF';
  }

  /** §7.3 step 11 — the GST document, a snapshot of the party as it is today. */
  private registerDoc(
    p: Prepared,
    d: DerivedInternal,
    voucherId: string,
    voucherNo: bigint,
    refno: string,
    dto: PostVoucherDto,
    actor: string,
  ): RegisterDoc {
    const g = d.gst!;
    const party = p.party!;
    const supplyNature = g.supplyNature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE';
    const tax = g.cgst.plus(g.sgst).plus(g.igst).plus(g.cess);
    const billValue = g.reverseCharge ? g.taxable : g.taxable.plus(tax);
    const n = (v: Prisma.Decimal): number => Number(v.toFixed(2));
    const services = g.lines.filter((l) => l.isService).length;
    const lines: RegisterDetailLine[] = g.lines.map((l) => {
      const ledger = p.ledgers.get(l.taxableLedgerId);
      const lineTax = l.cgst.plus(l.sgst).plus(l.igst).plus(l.cess);
      return {
        rowNo: l.rowNo,
        description: ledger?.name ?? null,
        hsnCode: l.hsn,
        qty: 1,
        rate: n(l.taxable),
        discount: 0,
        isService: l.isService,
        taxableValue: n(l.taxable),
        taxId: l.rate.taxId,
        totalTaxRate: Number(l.rate.ratePerc.toString()),
        cgstRate: Number(l.rate.cgstPerc.toString()),
        sgstRate: Number(l.rate.sgstPerc.toString()),
        igstRate: Number(l.rate.igstPerc.toString()),
        cessRate: Number(l.rate.cessPerc.toString()),
        cgstAmount: n(l.cgst),
        sgstAmount: n(l.sgst),
        igstAmount: n(l.igst),
        cessAmount: n(l.cess),
        otherAmount: 0,
        totalValue: n(l.taxable.plus(lineTax)),
        billValue: n(g.reverseCharge ? l.taxable : l.taxable.plus(lineTax)),
        taxability: detailTaxability(l.rate.taxability),
        supplyNature,
        taxableLedgerId: l.taxableLedgerId,
        cgstLedgerId: l.cgstLedgerId,
        sgstLedgerId: l.sgstLedgerId,
        igstLedgerId: l.igstLedgerId,
        cessLedgerId: l.cessLedgerId,
        itcEligibility: l.itcEligibility as RegisterDetailLine['itcEligibility'],
      };
    });
    return {
      companyId: dto.header.companyId,
      branchId: dto.header.branchId,
      accYear: dto.header.accYear,
      voucherId,
      voucherTypeId: p.type.typeId,
      voucherNo,
      voucherDate: dto.header.date,
      voucherRefno: refno,
      sourceModule: 'ACCOUNTS',
      sourceDocId: voucherId,
      docType: g.docType,
      tranNature: g.tranNature,
      docFlow: g.docFlow,
      docSign: g.docSign,
      docNo: refno,
      docDate: dto.header.date,
      docRefNo: p.header.docRefno,
      taxability: lines.every((l) => l.taxability === lines[0].taxability)
        ? lines[0].taxability
        : 'MIXED',
      supplyClass: services === 0 ? 'GOODS' : services === lines.length ? 'SERVICES' : 'MIXED',
      supplyNature,
      placeOfSupplyCode: g.posStcd,
      placeOfSupplyName: null,
      isReverseCharge: g.reverseCharge,
      igstOnIntra: false,
      partyType: g.docFlow === 'INWARD' ? 'VENDOR' : 'CUSTOMER',
      partyId: party.ledId,
      partyName: party.name,
      partyAddr1: party.addr1,
      partyAddr2: party.addr2,
      partyAddr3: party.addr3,
      partyLocation: party.city,
      partyPin: party.pin,
      partyStateCode: party.stateCode,
      partyStateName: party.stateName,
      partyGstType: party.gstType,
      partyGstin: party.gstin,
      grossValue: n(g.taxable),
      discountValue: 0,
      taxableValue: n(g.taxable),
      cgstValue: n(g.cgst),
      sgstValue: n(g.sgst),
      igstValue: n(g.igst),
      cessValue: n(g.cess),
      stateCessValue: 0,
      tcsValue: 0,
      otherCharge: 0,
      roundOff: 0,
      billValue: n(billValue),
      remarks: p.header.remarks,
      createdBy: actor,
      lines,
    };
  }

  /** §6.12 — header + legs + allocations + bills + GST doc + TDS + rights + locks. */
  async assemble(
    tx: Prisma.TransactionClient,
    s: StoredVoucher,
    type: VoucherTypeRules,
    rights: VoucherRights,
  ): Promise<VoucherPayload> {
    const n = (v: Prisma.Decimal | number | string | null | undefined): number =>
      Number(new Prisma.Decimal(v ?? 0).toFixed(2));
    const iso = (d: Date | null | undefined): string | null =>
      d ? d.toISOString().slice(0, 10) : null;
    const ts = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
    const status = s.avh_voucher_status as VoucherStatus;

    const legRows = await tx.$queryRaw<
      {
        av_id: string;
        av_row_no: number;
        av_dr_cr: string;
        av_ledger_id: string;
        led_name: string;
        acc_group_name: string | null;
        av_amount: Prisma.Decimal;
        av_role: string | null;
        av_remarks: string | null;
        av_opp_ledger_id: string | null;
      }[]
    >`
      SELECT v.av_id, v.av_row_no, v.av_dr_cr, v.av_ledger_id, l.led_name, g.acc_group_name,
             v.av_amount, v.av_role, v.av_remarks, v.av_opp_ledger_id
        FROM accounts.acc_vouchers v
        JOIN accounts.acc_ledger_master l ON l.led_id = v.av_ledger_id
        LEFT JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
       WHERE v.av_voucher_id = ${s.avh_voucher_id}::uuid AND v.av_acc_year = ${s.avh_acc_year}::char(9)
         AND v.av_is_deleted = false
       ORDER BY v.av_row_no`;
    // The generated party leg is the LAST leg on the party's ledger on the party side.
    // Keyed on the STORED header party, not the type's mode today: a voucher
    // posted while its type was ONE keeps its party after the type turned MANY
    // (notes 53, RcpV / PmtV), and a MANY voucher never stores one.
    let partyLegRow = -1;
    if (s.avh_party_id) {
      for (const r of legRows) {
        if (r.av_ledger_id === s.avh_party_id && r.av_dr_cr.trim() === type.partySide)
          partyLegRow = r.av_row_no;
      }
    }
    const legs: VoucherLegPayload[] = legRows.map((r) => ({
      avId: r.av_id,
      rowNo: r.av_row_no,
      drCr: r.av_dr_cr.trim() as DrCr,
      ledgerId: r.av_ledger_id,
      ledgerName: r.led_name,
      groupName: r.acc_group_name,
      amount: n(r.av_amount),
      role: r.av_role,
      generated: (r.av_role !== null && GENERATED.has(r.av_role)) || r.av_row_no === partyLegRow,
      remarks: r.av_remarks,
      oppLedgerId: r.av_opp_ledger_id,
    }));

    const adjRows = await tx.$queryRaw<
      {
        abj_id: string;
        abj_row_no: number;
        abj_bill_id: string;
        abj_bill_acc_year: string;
        abl_doc_refno: string | null;
        abl_bill_type: string | null;
        abj_against_bill_id: string | null;
        abj_against_bill_acc_year: string | null;
        abj_adj_type: string;
        abj_dr_cr: string;
        abj_amount: Prisma.Decimal;
        abj_adj_date: Date;
        abj_reversal_of_id: string | null;
      }[]
    >`
      SELECT j.abj_id, j.abj_row_no, j.abj_bill_id, j.abj_bill_acc_year, b.abl_doc_refno, b.abl_bill_type,
             j.abj_against_bill_id, j.abj_against_bill_acc_year, j.abj_adj_type, j.abj_dr_cr,
             j.abj_amount, j.abj_adj_date, j.abj_reversal_of_id
        FROM accounts.acc_bill_adjustment j
        LEFT JOIN accounts.acc_bill_balance b ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
       WHERE j.abj_is_deleted = false
         AND ((j.abj_voucher_id = ${s.avh_voucher_id}::uuid AND j.abj_voucher_acc_year = ${s.avh_acc_year}::char(9))
           -- the counter-rows a cancel filed against the REVERSAL voucher, shown with what they undo
           OR j.abj_reversal_of_id IN (SELECT o.abj_id FROM accounts.acc_bill_adjustment o
                                        WHERE o.abj_voucher_id = ${s.avh_voucher_id}::uuid
                                          AND o.abj_voucher_acc_year = ${s.avh_acc_year}::char(9)))
       ORDER BY (j.abj_reversal_of_id IS NOT NULL), j.abj_row_no`;
    const allocations: VoucherAllocationPayload[] = adjRows.map((r) => ({
      abjId: r.abj_id,
      rowNo: r.abj_row_no,
      billId: r.abj_bill_id,
      billAccYear: r.abj_bill_acc_year.trim(),
      billRefno: r.abl_doc_refno,
      billType: r.abl_bill_type,
      againstBillId: r.abj_against_bill_id,
      againstBillAccYear: r.abj_against_bill_acc_year?.trim() ?? null,
      adjType: r.abj_adj_type,
      drCr: r.abj_dr_cr.trim() as DrCr,
      amount: n(r.abj_amount),
      adjDate: iso(r.abj_adj_date)!,
      isReversal: r.abj_reversal_of_id !== null,
      reversalOfId: r.abj_reversal_of_id,
    }));

    const billRows = await tx.$queryRaw<
      {
        abl_id: string;
        abl_acc_year: string;
        abl_bill_type: string;
        abl_doc_refno: string;
        abl_doc_date: Date;
        abl_due_date: Date | null;
        abl_dr_cr: string;
        abl_bill_amount: Prisma.Decimal;
        abl_alloc_amount: Prisma.Decimal;
        abl_pending_amount: Prisma.Decimal | null;
        abl_status: string | null;
        abl_is_deleted: boolean;
      }[]
    >`
      SELECT abl_id, abl_acc_year, abl_bill_type, abl_doc_refno, abl_doc_date, abl_due_date, abl_dr_cr,
             abl_bill_amount, abl_alloc_amount, abl_pending_amount, abl_status, abl_is_deleted
        FROM accounts.acc_bill_balance
       WHERE abl_voucher_id = ${s.avh_voucher_id}::uuid AND abl_acc_year = ${s.avh_acc_year}::char(9)
       ORDER BY abl_created_on`;
    const bills: VoucherBillPayload[] = billRows.map((r) => ({
      ablId: r.abl_id,
      ablAccYear: r.abl_acc_year.trim(),
      billType: r.abl_bill_type,
      docRefno: r.abl_doc_refno,
      docDate: iso(r.abl_doc_date)!,
      dueDate: iso(r.abl_due_date),
      side: r.abl_dr_cr.trim() as DrCr,
      billAmount: n(r.abl_bill_amount),
      allocAmount: n(r.abl_alloc_amount),
      pendingAmount: n(r.abl_pending_amount),
      status: r.abl_status,
      isDeleted: r.abl_is_deleted,
    }));

    const gdrRows = await tx.$queryRaw<
      {
        gdr_id: string;
        gdr_doc_type: string;
        gdr_doc_status: string;
        gdr_doc_no: string;
        gdr_doc_date: Date;
        gdr_supply_nature: string | null;
        gdr_place_of_supply_code: string | null;
        gdr_is_reverse_charge: boolean;
        gdr_is_einvoice_applicable: boolean;
        gdr_taxable_value: Prisma.Decimal;
        gdr_cgst_value: Prisma.Decimal;
        gdr_sgst_value: Prisma.Decimal;
        gdr_igst_value: Prisma.Decimal;
        gdr_cess_value: Prisma.Decimal;
        gdr_bill_value: Prisma.Decimal;
      }[]
    >`
      SELECT gdr_id, gdr_doc_type::text AS gdr_doc_type, gdr_doc_status::text AS gdr_doc_status, gdr_doc_no,
             gdr_doc_date, gdr_supply_nature::text AS gdr_supply_nature, gdr_place_of_supply_code,
             gdr_is_reverse_charge, gdr_is_einvoice_applicable, gdr_taxable_value, gdr_cgst_value,
             gdr_sgst_value, gdr_igst_value, gdr_cess_value, gdr_bill_value
        FROM accounts.acc_voucher_doc_register
       WHERE gdr_voucher_id = ${s.avh_voucher_id}::uuid AND gdr_acc_year = ${s.avh_acc_year}::char(9)
         AND gdr_is_deleted = false
       ORDER BY gdr_created_on DESC LIMIT 1`;
    let gstDoc: VoucherGstDocPayload | null = null;
    if (gdrRows[0]) {
      const g = gdrRows[0];
      const vtx = await tx.$queryRaw<
        {
          vtx_row_no: number;
          vtx_tax_id: string | null;
          vtx_hsn_code: string | null;
          vtx_is_service: boolean;
          vtx_taxable_value: Prisma.Decimal;
          vtx_total_tax_rate: Prisma.Decimal;
          vtx_cgst_amount: Prisma.Decimal;
          vtx_sgst_amount: Prisma.Decimal;
          vtx_igst_amount: Prisma.Decimal;
          vtx_cess_amount: Prisma.Decimal;
          vtx_itc_eligibility: string | null;
        }[]
      >`
        SELECT vtx_row_no, vtx_tax_id, vtx_hsn_code, vtx_is_service, vtx_taxable_value, vtx_total_tax_rate,
               vtx_cgst_amount, vtx_sgst_amount, vtx_igst_amount, vtx_cess_amount, vtx_itc_eligibility
          FROM accounts.acc_voucher_doc_detail
         WHERE vtx_gdr_id = ${g.gdr_id}::uuid AND vtx_acc_year = ${s.avh_acc_year}::char(9)
           AND vtx_is_deleted = false
         ORDER BY vtx_row_no`;
      gstDoc = {
        gdrId: g.gdr_id,
        docType: g.gdr_doc_type,
        docStatus: g.gdr_doc_status,
        docNo: g.gdr_doc_no,
        docDate: iso(g.gdr_doc_date)!,
        supplyNature: g.gdr_supply_nature,
        placeOfSupply: g.gdr_place_of_supply_code?.trim() ?? null,
        isReverseCharge: g.gdr_is_reverse_charge,
        isEinvoiceApplicable: g.gdr_is_einvoice_applicable,
        taxable: n(g.gdr_taxable_value),
        cgst: n(g.gdr_cgst_value),
        sgst: n(g.gdr_sgst_value),
        igst: n(g.gdr_igst_value),
        cess: n(g.gdr_cess_value),
        billValue: n(g.gdr_bill_value),
        lines: vtx.map((l) => ({
          rowNo: l.vtx_row_no,
          taxId: l.vtx_tax_id,
          hsn: l.vtx_hsn_code,
          isService: l.vtx_is_service,
          taxable: n(l.vtx_taxable_value),
          ratePerc: Number(l.vtx_total_tax_rate.toString()),
          cgst: n(l.vtx_cgst_amount),
          sgst: n(l.vtx_sgst_amount),
          igst: n(l.vtx_igst_amount),
          cess: n(l.vtx_cess_amount),
          itcEligibility: l.vtx_itc_eligibility,
        })),
      };
    }

    const tdsRows = await tx.$queryRaw<
      {
        atd_id: string;
        atd_section: string;
        atd_deductee_type: string | null;
        atd_rate: Prisma.Decimal;
        atd_rate_source: string;
        atd_base_amount: Prisma.Decimal;
        atd_tax_amount: Prisma.Decimal;
        atd_challan_no: string | null;
        atd_reversal_of_id: string | null;
      }[]
    >`
      SELECT atd_id, atd_section, atd_deductee_type, atd_rate, atd_rate_source, atd_base_amount,
             atd_tax_amount, atd_challan_no, atd_reversal_of_id
        FROM accounts.acc_tds_register
       WHERE atd_is_deleted = false
         AND ((atd_voucher_id = ${s.avh_voucher_id}::uuid AND atd_voucher_acc_year = ${s.avh_acc_year}::char(9))
           OR atd_reversal_of_id IN (SELECT o.atd_id FROM accounts.acc_tds_register o
                                      WHERE o.atd_voucher_id = ${s.avh_voucher_id}::uuid
                                        AND o.atd_voucher_acc_year = ${s.avh_acc_year}::char(9)))
       ORDER BY (atd_reversal_of_id IS NOT NULL), atd_created_on`;
    const tds: VoucherTdsPayload[] = tdsRows.map((r) => ({
      atdId: r.atd_id,
      section: r.atd_section,
      deducteeType: r.atd_deductee_type,
      rate: Number(r.atd_rate.toString()),
      rateSource: r.atd_rate_source,
      base: n(r.atd_base_amount),
      tax: n(r.atd_tax_amount),
      challanNo: r.atd_challan_no,
      isReversal: r.atd_reversal_of_id !== null,
    }));

    const [fy] = await tx.$queryRaw<{ fy_lock_date: Date | null }[]>`
      SELECT fy_lock_date FROM public.fiscal_years
       WHERE comp_id = ${s.avh_company_id}::uuid AND fy_year_name = ${s.avh_acc_year}::char(9) AND is_deleted = false
       LIMIT 1`;
    const lock = fy?.fy_lock_date ? fy.fy_lock_date.toISOString().slice(0, 10) : null;
    const elsewhere =
      status === 'POSTED'
        ? await otherVoucherOnRaisedBills(tx, s.avh_voucher_id, s.avh_acc_year)
        : [];

    const header: VoucherHeaderPayload = {
      voucherId: s.avh_voucher_id,
      companyId: s.avh_company_id,
      branchId: s.avh_branch_id,
      accYear: s.avh_acc_year,
      typeId: type.typeId,
      typeCode: type.typeCode,
      typeName: type.typeName,
      voucherNo: s.avh_voucher_no === null ? null : Number(s.avh_voucher_no),
      voucherRefno: s.avh_voucher_refno,
      date: iso(s.avh_voucher_date)!,
      partyId: s.avh_party_id,
      partyName: s.party_name,
      docRefno: s.avh_doc_refno,
      docDate: iso(s.avh_doc_date),
      usrRefno: s.avh_usr_refno,
      remarks: s.avh_remarks,
      docAmount: n(s.avh_doc_amount),
      totalDebit: n(s.avh_total_debit),
      totalCredit: n(s.avh_total_credit),
      status,
      statusOn: ts(s.avh_status_on),
      postedOn: ts(s.avh_posted_on),
      cancelReason: s.avh_cancel_reason,
      reversalVoucherId: s.avh_reversal_voucher_id,
      reversalAccYear: s.avh_reversal_acc_year?.trim() ?? null,
      reversalRefno: s.reversal_refno,
      againstVoucherId: s.avh_against_voucher_id,
      againstAccYear: s.avh_against_acc_year?.trim() ?? null,
      againstRefno: s.against_refno,
      createdBy: s.avh_created_by,
      createdOn: ts(s.avh_created_on),
      modifiedBy: s.avh_modified_by,
      modifiedOn: ts(s.avh_modified_on),
    };
    return {
      header,
      rules: type,
      rights,
      locks: {
        editable: status === 'DRAFT' && rights.edit,
        dayClosed: false,
        periodLocked: lock !== null && header.date <= lock,
        allocatedElsewhere: elsewhere.length > 0,
      },
      legs,
      allocations,
      bills,
      gstDoc,
      tds,
      draft:
        status === 'DRAFT' && s.avh_draft_lines && typeof s.avh_draft_lines === 'object'
          ? (s.avh_draft_lines as Record<string, unknown>)
          : null,
    };
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** The Indian April–March year an ISO date falls in. */
export function accYearOf(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return `${start}-${start + 1}`;
}

export function quarterOf(iso: string): string {
  const m = Number(iso.slice(5, 7));
  if (m >= 4 && m <= 6) return 'Q1';
  if (m >= 7 && m <= 9) return 'Q2';
  if (m >= 10) return 'Q3';
  return 'Q4';
}

export function statusDocType(type: VoucherTypeRules): TxnStatusDocType {
  switch (type.nature) {
    case 'RECEIPT':
      return TxnStatusDocType.RECEIPT;
    case 'PAYMENT':
      return TxnStatusDocType.PAYMENT;
    default:
      return TxnStatusDocType.JOURNAL;
  }
}

function detailTaxability(rate: string): RegisterDetailLine['taxability'] {
  switch (rate.toUpperCase()) {
    case 'EXEMPT':
      return 'EXEMPT';
    case 'NIL_RATED':
      return 'NIL_RATED';
    case 'NON_GST':
      return 'NON_GST';
    default:
      return 'TAXABLE';
  }
}

export { registerDeductee, roleKey };
