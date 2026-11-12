import { HttpException, Injectable } from '@nestjs/common';
import { Prisma, type TransporterMaster } from '@prisma/client';
import { formatRupees, withFigures, PartyBalanceService } from 'src/common/party/party-balance.service';
import { ledgerGstFieldsOf } from 'src/common/party/party-gst-type';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  DEFAULT_ACTOR,
  isUniqueConstraintError,
  throwConflict,
  throwForbidden,
  throwNotFound,
  throwUnprocessable,
  type ModuleErrorDetail,
} from 'src/common/utils/module-shared.utils';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AccountLedgerMastersService } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.service';
import type { SaveAccountLedgerMasterDto } from '../../accountsModule/accountLedgerMasters/dto/save-account-ledger-master.dto';
import { AccountLedgerErrorCode } from '../../accountsModule/accountLedgerMasters/types/account-ledger-master-error-codes';
import { AuditLogService } from '../../audit-log/audit-log.service';
import type { SaveTransporterDto } from './dto/save-transporter.dto';
import { TRANSPORTER_RIGHT_PREFIX, TransporterErrorCode } from './types/transporter-error-codes';

/**
 * Transporters (menu 149 under Purchase Masters; plan-vehicle-master-2026-11-11 §5.2).
 * Each transporter IS a ledger, as a supplier or an agent is (D28, D31): its own
 * account ledger is made on the first save in the same transaction, under the shared
 * group "Transporters" (Sundry Creditors), and trn_id = trn_ledger_id = led_id. Every
 * save keeps the ledger in step (D32); delete follows the supplier rule (D34).
 */
export const TRANSPORTER_MENU_ID = 149;
export const TRANSPORTER_AUDIT_SCREEN_NAME = 'Transporter Master';
export const TRANSPORTER_TABLE_NAME = 'public.transporter_master';
/** accounts.acc_group_master "Transporters" (shared, reserved, under Sundry Creditors). */
export const TRANSPORTER_LEDGER_GROUP_ID = '01a1ca91-1010-73d8-a329-f97aa1de5c9c';

const GSTIN_SHAPE = /^[A-Z0-9]{15}$/;
const GSTIN_STATE_PREFIX = /^[0-9]{2}/;

const trimOrNull = (v: string | null | undefined): string | null => (v && v.trim() ? v.trim() : null);

export interface TransporterPayload {
  trnId: string;
  companyId: string | null;
  code: string | null;
  name: string;
  gstin: string | null;
  isEnrolmentId: boolean;
  mode: string;
  phone: string | null;
  email: string | null;
  addr: string | null;
  place: string | null;
  pin: string | null;
  stateCode: string | null;
  stateName: string | null;
  remarks: string | null;
  isActive: boolean;
  ledgerId: string | null;
  ledgerName: string | null;
  ledgerGroupName: string | null;
  vehicleCount: number;
  createdBy: string | null;
  createdOn: string | null;
  modifiedBy: string | null;
  modifiedOn: string | null;
}

interface TransporterRow {
  trn_id: string;
  trn_company_id: string | null;
  trn_code: string | null;
  trn_name: string;
  trn_gstin: string | null;
  trn_is_enrolment_id: boolean;
  trn_mode: string;
  trn_phone: string | null;
  trn_email: string | null;
  trn_addr: string | null;
  trn_place: string | null;
  trn_pin: string | null;
  trn_state_code: string | null;
  state_name: string | null;
  trn_remarks: string | null;
  trn_is_active: boolean;
  trn_ledger_id: string | null;
  led_name: string | null;
  acc_group_name: string | null;
  vehicle_count: number;
  trn_created_by: string | null;
  trn_created_on: Date | null;
  trn_modified_by: string | null;
  trn_modified_on: Date | null;
}

/** The ledger fields a transporter writes (D32): GSTIN only when it is one, not a TRANSIN. */
export function transporterLedgerFields(t: {
  name: string;
  companyId: string;
  gstin: string | null;
  isEnrolmentId: boolean;
  stateCode: string | null;
  stateName: string | null;
  phone: string | null;
  email: string | null;
  addr: string | null;
  place: string | null;
  pin: string | null;
  isActive: boolean;
}): Partial<SaveAccountLedgerMasterDto> {
  const realGstin = t.gstin && !t.isEnrolmentId ? t.gstin : null;
  return {
    ledGroupId: TRANSPORTER_LEDGER_GROUP_ID,
    ledName: t.name,
    ledCompanyId: t.companyId,
    ledIsBillByBill: true,
    ...ledgerGstFieldsOf(realGstin ? 'REGULAR' : 'UNREGISTERED'),
    ledGstinNo: realGstin,
    ledStateCode: t.stateCode,
    ledStateName: t.stateName,
    ledPhone1: t.phone,
    ledEmail: t.email,
    ledAddr1: t.addr,
    ledCity: t.place,
    ledPin: t.pin,
    ledIsActive: t.isActive,
  };
}

/** The ledger service's LEDGER_NAME_TAKEN (or the unique index itself) → TRN_LEDGER_NAME_TAKEN (D33). */
export function isLedgerNameTaken(error: unknown): boolean {
  if (isUniqueConstraintError(error)) {
    return true;
  }
  if (error instanceof HttpException) {
    const body = error.getResponse() as { errors?: { code?: string }[] } | string;
    return typeof body === 'object' && (body.errors ?? []).some((e) => e.code === AccountLedgerErrorCode.NAME_TAKEN);
  }
  return false;
}

type Client = Prisma.TransactionClient | PrismaService;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

@Injectable()
export class TransporterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContextService,
    private readonly auditLogService: AuditLogService,
    private readonly ledgers: AccountLedgerMastersService,
    private readonly partyBalance: PartyBalanceService,
  ) {}

  private actor(): string {
    return this.ctx.getUserId() ?? DEFAULT_ACTOR;
  }

  private assertRight(client: Client, right: MenuRight, action: string): Promise<unknown> {
    return assertMenuRight(client, {
      userId: this.ctx.getUserId() ?? null,
      menuId: TRANSPORTER_MENU_ID,
      right,
      codePrefix: TRANSPORTER_RIGHT_PREFIX,
      action,
    });
  }

  /**
   * The token's company: the user's own company (user_master.usr_company_id), or null
   * for a user bound to none (a super admin working in several companies, e.g. VKPOS).
   */
  private loginCompany(): string | null {
    return this.ctx.getCompanyId()?.toLowerCase() ?? null;
  }

  /**
   * D25 as built: the body's company is the one saved for. A user bound to a company may
   * only name that one; a user bound to none may name any live company.
   */
  private async resolveCompany(client: Client, bodyCompanyId: string): Promise<string> {
    const token = this.loginCompany();
    const body = bodyCompanyId.toLowerCase();
    let refusal: string | null = null;
    if (token && token !== body) {
      refusal = `companyId ${body} is not the login company ${token}`;
    } else if (!token) {
      const [c] = await client.$queryRaw<{ comp_id: string }[]>`
        SELECT comp_id FROM public.companys
         WHERE comp_id = ${body}::uuid AND coalesce(comp_is_deleted, false) = false`;
      if (!c) {
        refusal = `companyId ${body} is not a live company`;
      }
    }
    if (refusal) {
      throwForbidden<ModuleErrorDetail>('Transporter belongs to another company', [
        { field: 'companyId', message: refusal, code: TransporterErrorCode.COMPANY_MISMATCH },
      ]);
    }
    return body;
  }

  private refuse(code: TransporterErrorCode, field: string, message: string): never {
    throwUnprocessable<ModuleErrorDetail>(message, [{ field, message, code }]);
  }

  private notFound(trnId: string): never {
    throwNotFound<ModuleErrorDetail>(
      'Transporter not found',
      'trnId',
      `No live transporter of this company with id ${trnId}`,
      TransporterErrorCode.NOT_FOUND,
    );
  }

  /**
   * The live row (of `company` or shared) or 404 TRN_NOT_FOUND. `company` defaults to
   * the token's; a user bound to no company reaches every company's row.
   */
  private async loadLive(client: Client, trnId: string, company: string | null = this.loginCompany()): Promise<TransporterMaster> {
    const row = await client.transporterMaster.findFirst({
      where: {
        trnId,
        trnIsDeleted: false,
        ...(company ? { OR: [{ trnCompanyId: company }, { trnCompanyId: null }] } : {}),
      },
    });
    if (!row) {
      this.notFound(trnId);
    }
    return row;
  }

  async save(dto: SaveTransporterDto): Promise<TransporterPayload> {
    const isCreate = !dto.trnId;
    let id: string;
    try {
      id = await this.prisma.$transaction(
        async (tx) => {
          // 1 · the right, the company (D25)
          await this.assertRight(
            tx,
            isCreate ? 'create' : 'edit',
            isCreate ? 'make transporters' : 'change transporters',
          );
          const company = await this.resolveCompany(tx, dto.companyId);
          // 2 · name, GSTIN / TRANSIN, state
          const name = (dto.name ?? '').replace(/\s+/g, ' ').trim();
          if (!name) {
            this.refuse(TransporterErrorCode.NAME_REQUIRED, 'name', 'The transporter name is empty');
          }
          const isEnrolmentId = dto.isEnrolmentId ?? false;
          const gstin = trimOrNull(dto.gstin)?.toUpperCase().replace(/\s+/g, '') ?? null;
          if (gstin && (!GSTIN_SHAPE.test(gstin) || (!isEnrolmentId && !GSTIN_STATE_PREFIX.test(gstin)))) {
            this.refuse(
              TransporterErrorCode.GSTIN_INVALID,
              'gstin',
              `${gstin} is ${gstin.length} characters${isEnrolmentId ? '' : ' (a GSTIN starts with the 2-digit state code)'}`,
            );
          }
          const stateCode = trimOrNull(dto.stateCode);
          let stateName: string | null = null;
          if (stateCode) {
            const [st] = await tx.$queryRaw<{ state_name: string }[]>`
              SELECT state_name FROM fixed.state_codes
               WHERE state_code = ${stateCode} AND is_active = true AND is_deleted = false`;
            if (!st) {
              this.refuse(TransporterErrorCode.STATE_INVALID, 'stateCode', `${stateCode} is not a GST state code`);
            }
            stateName = st.state_name;
          }
          // 3 · update: the row must be there
          const existing = isCreate ? null : await this.loadLive(tx, dto.trnId!, company);
          // 4 · the same name twice — only when new or renamed (D24)
          if (isCreate || existing!.trnName.toLowerCase() !== name.toLowerCase()) {
            const [dup] = await tx.$queryRaw<{ trn_id: string }[]>`
              SELECT trn_id FROM public.transporter_master
               WHERE lower(trn_name) = lower(${name})
                 AND trn_is_deleted = false
                 AND (trn_company_id IS NULL OR trn_company_id = ${company}::uuid)
                 AND (${dto.trnId ?? null}::uuid IS NULL OR trn_id <> ${dto.trnId ?? null}::uuid)
               LIMIT 1`;
            if (dup) {
              throwConflict<ModuleErrorDetail>('Transporter name already used', [
                {
                  field: 'name',
                  message: `A transporter named ${name} already exists`,
                  code: TransporterErrorCode.NAME_TAKEN,
                },
              ]);
            }
          }
          const data = {
            trnCompanyId: company,
            trnCode: trimOrNull(dto.code),
            trnName: name,
            trnGstin: gstin,
            trnIsEnrolmentId: isEnrolmentId,
            trnMode: dto.mode ?? 'ROAD',
            trnPhone: trimOrNull(dto.phone),
            trnEmail: trimOrNull(dto.email),
            trnAddr: trimOrNull(dto.addr),
            trnPlace: trimOrNull(dto.place),
            trnPin: trimOrNull(dto.pin),
            trnStateCode: stateCode,
            trnRemarks: trimOrNull(dto.remarks),
            trnIsActive: dto.isActive ?? true,
          };
          const ledgerFields = transporterLedgerFields({
            name,
            companyId: company,
            gstin,
            isEnrolmentId,
            stateCode,
            stateName,
            phone: data.trnPhone,
            email: data.trnEmail,
            addr: data.trnAddr,
            place: data.trnPlace,
            pin: data.trnPin,
            isActive: data.trnIsActive,
          });
          let saved: TransporterMaster;
          if (isCreate) {
            // 5 · the ledger first: its id is the transporter's (D31)
            const ledger = await this.ledgers.createLedgerWithinTx(
              ledgerFields as SaveAccountLedgerMasterDto,
              tx,
            );
            saved = await tx.transporterMaster.create({
              data: { trnId: ledger.ledId, trnLedgerId: ledger.ledId, ...data, trnCreatedBy: this.actor() },
            });
          } else {
            saved = await tx.transporterMaster.update({
              where: { trnId: dto.trnId },
              data: { ...data, trnModifiedBy: this.actor(), trnModifiedOn: new Date() },
            });
            // 6 · the ledger follows: rename, GSTIN / state / contact, Active (D32)
            const ledId = existing!.trnLedgerId;
            if (ledId) {
              const led = await tx.accLedgerMaster.findFirst({
                where: { ledId, ledIsDeleted: false },
                select: { ledGroupId: true },
              });
              if (led) {
                await this.ledgers.updateLedgerWithinTx(
                  { ...ledgerFields, ledId, ledGroupId: led.ledGroupId } as SaveAccountLedgerMasterDto,
                  tx,
                );
              }
            }
          }
          await this.auditLogService.logEntityChange(
            {
              action: isCreate ? 'New' : 'update',
              tableName: TRANSPORTER_TABLE_NAME,
              screenName: TRANSPORTER_AUDIT_SCREEN_NAME,
              screenType: 'master',
              pk: saved.trnId,
              displayName: saved.trnName,
              originalRecord: existing,
              modifiedRecord: saved,
              userId: this.actor(),
              notes: isCreate ? 'Transporter created with its ledger' : 'Transporter updated; its ledger follows',
            },
            tx,
          );
          return saved.trnId;
        },
        { timeout: 30000, maxWait: 10000 },
      );
    } catch (error: unknown) {
      // 7 · the ledger's name is taken: nothing was written (the transaction rolled back)
      if (isLedgerNameTaken(error)) {
        throwConflict<ModuleErrorDetail>('Transporter name already a ledger', [
          {
            field: 'name',
            message: `Another ledger of this company (or a shared one) is named ${dto.name?.trim()}`,
            code: TransporterErrorCode.LEDGER_NAME_TAKEN,
          },
        ]);
      }
      throw error;
    }
    return this.load(this.prisma, id);
  }

  async getById(trnId: string): Promise<TransporterPayload> {
    await this.assertRight(this.prisma, 'view', 'open transporters');
    await this.loadLive(this.prisma, trnId);
    return this.load(this.prisma, trnId);
  }

  /** D34: refused while the ledger has a balance or a cheque in hand; else both go. */
  async softDelete(trnId: string): Promise<{ trnId: string; deleted: true; name: string }> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.assertRight(tx, 'delete', 'delete transporters');
        const existing = await this.loadLive(tx, trnId);
        const ledId = existing.trnLedgerId;
        const ledger = ledId ? await this.partyBalance.lockLedger(tx, ledId) : undefined;
        if (ledId && ledger && !ledger.ledIsDeleted) {
          const balances = await this.partyBalance.balances(tx, ledId);
          if (balances.length > 0) {
            const first = balances[0];
            const side = first.amount.isNegative() ? 'Cr' : 'Dr';
            throwConflict('Transporter cannot be deleted', [
              withFigures(
                {
                  field: 'trnId',
                  code: TransporterErrorCode.HAS_BALANCE,
                  message: `The transporter's ledger balance is ${first.amount.abs().toFixed(2)} ${side.toUpperCase()} in company ${first.companyId}; a transporter is deleted only at a zero balance`,
                },
                `This transporter still has ₹${formatRupees(first.amount.abs())} ${side} in ${first.companyName ?? 'a company'}.`,
              ),
            ]);
          }
          const cheques = await this.partyBalance.chequesInHand(tx, ledId);
          if (cheques > 0) {
            throwConflict<ModuleErrorDetail>('Transporter cannot be deleted', [
              {
                field: 'trnId',
                code: TransporterErrorCode.HAS_CHEQUE_IN_HAND,
                message: `${cheques} cheque(s) of this transporter are HELD / DEPOSITED and post only on clearing`,
              },
            ]);
          }
        }
        const now = new Date();
        const saved = await tx.transporterMaster.update({
          where: { trnId },
          data: { trnIsDeleted: true, trnIsActive: false, trnModifiedBy: this.actor(), trnModifiedOn: now },
        });
        if (ledId) {
          await tx.accLedgerMaster.updateMany({
            where: { ledId, ledIsDeleted: false },
            data: { ledIsDeleted: true, ledIsActive: false, ledModifiedBy: this.actor(), ledModifiedOn: now },
          });
        }
        await this.auditLogService.logEntityChange(
          {
            action: 'cancel',
            tableName: TRANSPORTER_TABLE_NAME,
            screenName: TRANSPORTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: trnId,
            displayName: existing.trnName,
            originalRecord: existing,
            modifiedRecord: saved,
            userId: this.actor(),
            notes: 'Transporter and its ledger soft deleted',
          },
          tx,
        );
        return { trnId, deleted: true as const, name: existing.trnName };
      },
      { timeout: 30000, maxWait: 10000 },
    );
  }

  private async load(client: Client, trnId: string): Promise<TransporterPayload> {
    const [r] = await client.$queryRaw<TransporterRow[]>`
      SELECT t.trn_id, t.trn_company_id, t.trn_code, t.trn_name, t.trn_gstin, t.trn_is_enrolment_id,
             t.trn_mode, t.trn_phone, t.trn_email, t.trn_addr, t.trn_place, t.trn_pin, t.trn_state_code,
             s.state_name, t.trn_remarks, t.trn_is_active, t.trn_ledger_id, l.led_name, g.acc_group_name,
             (SELECT count(*)::int FROM public.vehicle_master v
               WHERE v.veh_transporter_id = t.trn_id AND v.veh_is_deleted = false) AS vehicle_count,
             t.trn_created_by, t.trn_created_on, t.trn_modified_by, t.trn_modified_on
        FROM public.transporter_master t
        LEFT JOIN fixed.state_codes s ON s.state_code = t.trn_state_code
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = t.trn_ledger_id
        LEFT JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
       WHERE t.trn_id = ${trnId}::uuid AND t.trn_is_deleted = false`;
    if (!r) {
      this.notFound(trnId);
    }
    return toTransporterPayload(r);
  }
}

export function toTransporterPayload(r: TransporterRow): TransporterPayload {
  return {
    trnId: r.trn_id,
    companyId: r.trn_company_id,
    code: r.trn_code,
    name: r.trn_name,
    gstin: r.trn_gstin,
    isEnrolmentId: r.trn_is_enrolment_id,
    mode: r.trn_mode,
    phone: r.trn_phone,
    email: r.trn_email,
    addr: r.trn_addr,
    place: r.trn_place,
    pin: r.trn_pin,
    stateCode: r.trn_state_code,
    stateName: r.state_name,
    remarks: r.trn_remarks,
    isActive: r.trn_is_active,
    ledgerId: r.trn_ledger_id,
    ledgerName: r.led_name,
    ledgerGroupName: r.acc_group_name,
    vehicleCount: Number(r.vehicle_count ?? 0),
    createdBy: r.trn_created_by,
    createdOn: iso(r.trn_created_on),
    modifiedBy: r.trn_modified_by,
    modifiedOn: iso(r.trn_modified_on),
  };
}
