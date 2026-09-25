import { Injectable } from '@nestjs/common';
import { ChargeMaster, Prisma } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { GetChargeMasterQueryDto } from './dto/get-charge-master-query.dto';
import { SaveChargeMasterDto } from './dto/save-charge-master.dto';
import {
  CHARGE_UNIQUE_ROLES,
  CHARGE_VALUE_GUARDS,
  ChargeGuardedValues,
  ChargeLedgerDetail,
  ChargeMasterDeleteResult,
  ChargeMasterErrorDetail,
  ChargeMasterPayload,
  ChargeTaxDetail,
  resolveChargeModules,
} from './types/charge-master-api.types';
import { assertTaxRateRefs } from '../../Inventory/tax-rate-master/utils/tax-rate-reference.helper';
import {
  DEFAULT_ACTOR,
  MasterWriteClient,
  applyPresentFields,
  hasOwnProperty,
  isForeignKeyConstraintError,
  normalizeNullableString,
  normalizeRequiredText,
  toNullableNumber,
  throwMasterBadRequest,
  throwMasterConflict,
  throwMasterNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
const CHARGE_MASTER_TABLE_NAME = 'charge master';
const CHARGE_MASTER_AUDIT_SCREEN_NAME = 'Charge Master';
// Optional scalar fields copied verbatim from the DTO (already normalized by its
// decorators) onto the create/update payload; only keys present on the request
// are applied, so partial updates stay partial.
const CHARGE_OPTIONAL_FIELDS = [
  'chgCode',
  'chgRole',
  'chgType',
  'chgDefaultRate',
  'chgLandingCost',
  'chgCostAlloc',
  'chgTaxApl',
  'chgBeforeTax',
  'chgTaxId',
  'chgSepPost',
  'chgManParty',
  'chgDispOrder',
  'chgAutoApply',
  'chgIsActive',
];
// The rate a charge is taxed at: the charge's own (chg_tax_id) or, when that
// is null, the posting ledger's (led_tax_id). Both point at
// inventory.tax_rate_master, and this is what a read pulls from it.
const CHARGE_TAX_SELECT = {
  taxId: true,
  taxName: true,
  taxRatePerc: true,
  taxCgstPerc: true,
  taxSgstPerc: true,
  taxIgstPerc: true,
  taxCessPerc: true,
  taxTaxability: true,
} as const satisfies Prisma.TaxRateMasterSelect;
// Columns pulled from the mapped acc_ledger_master row and echoed on the
// payload: display label, the HSN/SAC the charge inherits, and the ledger's
// rate. 20260912100000 replaced the ledger's bare ledGstRate / ledTaxability
// with led_tax_id; the rate behind it is resolved here (CHG-TAX), so a
// freshly picked after-tax taxable charge prices at its real rate again.
const CHARGE_LEDGER_SELECT = {
  ledName: true,
  ledHsnSac: true,
  ledTaxId: true,
  taxRate: { select: CHARGE_TAX_SELECT },
} as const satisfies Prisma.AccLedgerMasterSelect;
// Both relations a read resolves alongside the charge row.
const CHARGE_RELATIONS = {
  ledger: { select: CHARGE_LEDGER_SELECT },
  tax: { select: CHARGE_TAX_SELECT },
} satisfies Prisma.ChargeMasterInclude;
type ChargeMasterWriteClient = MasterWriteClient;
@Injectable()
export class ChargeMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveChargeMasterDto: SaveChargeMasterDto): Promise<ChargeMasterPayload> {
    if (saveChargeMasterDto.chgId) {
      return this.updateCharge(saveChargeMasterDto);
    }
    return this.createCharge(saveChargeMasterDto);
  }
  // Single endpoint, two lookups: by id it answers with one charge, by module
  // with every active charge that module can apply.
  async get(
    getChargeMasterQueryDto: GetChargeMasterQueryDto,
  ): Promise<ChargeMasterPayload | ChargeMasterPayload[]> {
    const { chgId, chgModule } = getChargeMasterQueryDto;
    if (chgId && chgModule) {
      throwMasterBadRequest<ChargeMasterErrorDetail>('Ambiguous charge lookup', [
        { field: 'chgId', message: 'Send either chgId or chgModule, not both' },
      ]);
    }
    if (chgId) {
      return this.getById(chgId);
    }
    if (chgModule) {
      return this.getByModule(chgModule);
    }
    throwMasterBadRequest<ChargeMasterErrorDetail>('Missing charge lookup', [
      { field: 'chgId', message: 'Either chgId or chgModule is required' },
    ]);
  }
  async getById(chgId: string): Promise<ChargeMasterPayload> {
    const record = await this.prisma.chargeMaster.findFirst({
      where: { chgId, chgIsDeleted: false },
      include: CHARGE_RELATIONS,
    });
    if (!record) {
      this.throwNotFound(chgId);
    }
    return this.toPayload(record, record.ledger ?? null, record.tax ?? null);
  }
  // Lookup for the purchase / sales entry screens: only charges that are usable
  // right now, so soft-deleted and inactive rows are left out. Ordered by the
  // display order the master defines, with unordered rows last.
  async getByModule(chgModule: string): Promise<ChargeMasterPayload[]> {
    const records = await this.prisma.chargeMaster.findMany({
      where: {
        chgIsDeleted: false,
        chgIsActive: true,
        chgModule: { in: [...resolveChargeModules(chgModule)] },
      },
      include: CHARGE_RELATIONS,
      orderBy: [{ chgDispOrder: { sort: 'asc', nulls: 'last' } }, { chgName: 'asc' }],
    });
    return records.map((record) =>
      this.toPayload(record, record.ledger ?? null, record.tax ?? null),
    );
  }
  async softDelete(chgId: string): Promise<ChargeMasterDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.chargeMaster.findFirst({
        where: { chgId, chgIsDeleted: false },
      });
      if (!existing) {
        this.throwNotFound(chgId);
      }
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const modifiedOn = new Date();
      const result = await tx.chargeMaster.updateMany({
        where: { chgId, chgIsDeleted: false },
        data: {
          chgIsDeleted: true,
          chgIsActive: false,
          chgModifiedOn: modifiedOn,
          chgModifiedBy: actor,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(chgId);
      }
      const modifiedRecord = this.toPayload({
        ...existing,
        chgIsDeleted: true,
        chgIsActive: false,
        chgModifiedOn: modifiedOn,
        chgModifiedBy: actor,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: CHARGE_MASTER_TABLE_NAME,
          screenName: CHARGE_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: chgId,
          displayName: existing.chgName,
          originalRecord: this.toPayload(existing),
          modifiedRecord,
          userId: actor,
          notes: 'Charge soft deleted',
        },
        tx,
      );
      return { chgId, deleted: true };
    });
  }
  private async createCharge(
    saveChargeMasterDto: SaveChargeMasterDto,
  ): Promise<ChargeMasterPayload> {
    const now = new Date();
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const normalizedName = normalizeRequiredText<ChargeMasterErrorDetail>(
      saveChargeMasterDto.chgName,
      'chgName',
    );
    const normalizedCode = normalizeNullableString(saveChargeMasterDto.chgCode) ?? null;
    const role = saveChargeMasterDto.chgRole ?? null;
    const module = saveChargeMasterDto.chgModule;
    const taxId = saveChargeMasterDto.chgTaxId ?? null;
    this.ensureValuesAreAllowed(this.guardedValues(saveChargeMasterDto));
    this.ensureTaxIdIsApplicable(
      taxId,
      saveChargeMasterDto.chgTaxApl ?? false,
      saveChargeMasterDto.chgBeforeTax ?? false,
    );
    const data: Prisma.ChargeMasterUncheckedCreateInput = {
      chgName: normalizedName,
      chgModule: module,
      chgMethod: saveChargeMasterDto.chgMethod,
      chgApplyOn: saveChargeMasterDto.chgApplyOn,
      chgLedgerCode: saveChargeMasterDto.chgLedgerCode,
      chgCreatedOn: now,
      chgCreatedBy: saveChargeMasterDto.chgCreatedBy ?? actor,
      chgModifiedOn: now,
      chgModifiedBy: saveChargeMasterDto.chgModifiedBy ?? actor,
    };
    this.applyOptionalFields(data, saveChargeMasterDto);
    data.chgCode = normalizedCode;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const ledgerName = await this.ensureLedgerExists(tx, saveChargeMasterDto.chgLedgerCode);
        const tax = await this.resolveTaxRate(tx, taxId, true);
        await this.ensureCodeIsUnique(tx, normalizedCode);
        await this.ensureRoleIsUnique(tx, role, module);
        const created = await tx.chargeMaster.create({ data });
        const payload = this.toPayload(created, ledgerName, tax);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: CHARGE_MASTER_TABLE_NAME,
            screenName: CHARGE_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.chgId,
            displayName: payload.chgName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: actor,
            notes: 'Charge created',
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
  private async updateCharge(
    saveChargeMasterDto: SaveChargeMasterDto,
  ): Promise<ChargeMasterPayload> {
    const chgId = saveChargeMasterDto.chgId!;
    const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.chargeMaster.findFirst({
          where: { chgId, chgIsDeleted: false },
        });
        if (!existing) {
          this.throwNotFound(chgId);
        }
        const normalizedName = normalizeRequiredText<ChargeMasterErrorDetail>(
          saveChargeMasterDto.chgName,
          'chgName',
        );
        const nextModule = saveChargeMasterDto.chgModule;
        const nextCode = hasOwnProperty(saveChargeMasterDto, 'chgCode')
          ? (normalizeNullableString(saveChargeMasterDto.chgCode) ?? null)
          : existing.chgCode;
        const nextRole = hasOwnProperty(saveChargeMasterDto, 'chgRole')
          ? (saveChargeMasterDto.chgRole ?? null)
          : existing.chgRole;
        const nextTaxId = hasOwnProperty(saveChargeMasterDto, 'chgTaxId')
          ? (saveChargeMasterDto.chgTaxId ?? null)
          : existing.chgTaxId;
        const nextTaxApl = hasOwnProperty(saveChargeMasterDto, 'chgTaxApl')
          ? (saveChargeMasterDto.chgTaxApl ?? false)
          : existing.chgTaxApl;
        const nextBeforeTax = hasOwnProperty(saveChargeMasterDto, 'chgBeforeTax')
          ? (saveChargeMasterDto.chgBeforeTax ?? false)
          : existing.chgBeforeTax;
        this.ensureValuesAreAllowed(
          this.guardedValues(saveChargeMasterDto, { chgModule: nextModule, chgRole: nextRole }),
        );
        this.ensureTaxIdIsApplicable(nextTaxId, nextTaxApl, nextBeforeTax);
        const ledgerName = await this.ensureLedgerExists(tx, saveChargeMasterDto.chgLedgerCode);
        // Only a rate the request itself names is checked for being live: a
        // stored rate that has since been retired must not block an edit that
        // leaves it alone.
        const tax = await this.resolveTaxRate(tx, nextTaxId, nextTaxId !== existing.chgTaxId);
        await this.ensureCodeIsUnique(tx, nextCode, chgId);
        await this.ensureRoleIsUnique(tx, nextRole, nextModule, chgId);
        const data: Prisma.ChargeMasterUncheckedUpdateInput = {
          chgName: normalizedName,
          chgModule: nextModule,
          chgMethod: saveChargeMasterDto.chgMethod,
          chgApplyOn: saveChargeMasterDto.chgApplyOn,
          chgLedgerCode: saveChargeMasterDto.chgLedgerCode,
          chgModifiedOn: new Date(),
          chgModifiedBy: saveChargeMasterDto.chgModifiedBy ?? actor,
        };
        this.applyOptionalFields(data, saveChargeMasterDto);
        data.chgCode = nextCode;
        const updated = await tx.chargeMaster.update({ where: { chgId }, data });
        const payload = this.toPayload(updated, ledgerName, tax);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: CHARGE_MASTER_TABLE_NAME,
            screenName: CHARGE_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: chgId,
            displayName: payload.chgName,
            // Audit tracks stored columns only; chgLedgerName, ledHsnSac and
            // chgTaxName are derived from the ledger and the rate, so keep them
            // out of both snapshots to avoid a spurious "changed" diff on every
            // update. chgTaxId itself IS stored, so it is diffed like any column.
            originalRecord: this.toPayload(existing),
            modifiedRecord: this.toPayload(updated),
            userId: actor,
            notes: 'Charge updated',
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
  // chg_ledger_code has a DB foreign key to acc_ledger_master, but that only
  // guarantees the row exists — not that it is active. Verify it is not
  // soft-deleted to reject orphan mappings early, and return the ledger detail
  // so callers can echo it back in the payload.
  private async ensureLedgerExists(
    tx: ChargeMasterWriteClient,
    ledgerCode: string,
  ): Promise<ChargeLedgerDetail> {
    const ledger = await tx.accLedgerMaster.findFirst({
      where: { ledId: ledgerCode, ledIsDeleted: false },
      select: CHARGE_LEDGER_SELECT,
    });
    if (!ledger) {
      throwMasterBadRequest<ChargeMasterErrorDetail>('Ledger does not exist', [
        { field: 'chgLedgerCode', message: `No active ledger found with id ${ledgerCode}` },
      ]);
    }
    return ledger;
  }
  // fk_chg_tax proves the rate EXISTS and nothing more: a soft-deleted rate
  // still satisfies it, and so does one withdrawn from new documents. Check
  // both when the request names a rate, so a bad reference is a 400 naming
  // chgTaxId rather than a P2003 surfacing as a 500. The rate's name comes
  // back so the payload can echo it.
  private async resolveTaxRate(
    tx: ChargeMasterWriteClient,
    taxId: string | null,
    validate: boolean,
  ): Promise<ChargeTaxDetail | null> {
    if (taxId === null) {
      return null;
    }
    if (validate) {
      await assertTaxRateRefs(tx, [{ taxId, field: 'chgTaxId' }], 'Invalid charge tax rate');
    }
    return tx.taxRateMaster.findUnique({ where: { taxId }, select: CHARGE_TAX_SELECT });
  }
  // Mirrors the DB CHECK ck_chg_tax_id (migration 20260912070000_add_chg_tax_id).
  // A before-tax charge is taxed at the ITEM's rate inside the item line and a
  // non-taxable charge is never taxed, so either way a rate here would be one
  // nothing reads. Same rule txn_charge_detail restates for cdTaxCode.
  private ensureTaxIdIsApplicable(taxId: string | null, taxApl: boolean, beforeTax: boolean): void {
    if (taxId !== null && (!taxApl || beforeTax)) {
      throwMasterBadRequest<ChargeMasterErrorDetail>('Invalid charge tax rate', [
        {
          field: 'chgTaxId',
          message:
            'chgTaxId is only meaningful on a charge that carries its own GST — set chgTaxApl and leave chgBeforeTax false, or clear chgTaxId',
        },
      ]);
    }
  }
  private async ensureCodeIsUnique(
    tx: ChargeMasterWriteClient,
    chargeCode: string | null,
    excludeId?: string,
  ): Promise<void> {
    if (chargeCode === null) {
      return;
    }
    const existing = await tx.chargeMaster.findFirst({
      where: {
        chgIsDeleted: false,
        chgCode: { equals: chargeCode, mode: 'insensitive' },
        ...(excludeId ? { chgId: { not: excludeId } } : {}),
      },
      select: { chgId: true },
    });
    if (existing) {
      throwMasterConflict<ChargeMasterErrorDetail>('Charge code already exists', [
        { field: 'chgCode', message: 'Duplicate charge code is not allowed' },
      ]);
    }
  }
  // Replaces the dropped CHECK constraints ck_chg_module / ck_chg_role /
  // ck_chg_method / ck_chg_type / ck_chg_apply_on / ck_chg_cost_alloc (see
  // migration 20260724130000_drop_charge_master_check_constraints). The DTO's
  // @IsIn lists already reject bad values on the HTTP path; repeating the check
  // on the write path keeps the invariant for any other caller of the service
  // now that the database no longer backstops it.
  private ensureValuesAreAllowed(values: ChargeGuardedValues): void {
    const details: ChargeMasterErrorDetail[] = [];
    for (const guard of CHARGE_VALUE_GUARDS) {
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
    if (details.length > 0) {
      throwMasterBadRequest<ChargeMasterErrorDetail>('Invalid charge value', details);
    }
  }
  // Picks the values the guards apply to out of the request. Optional columns
  // are reported as undefined when absent so a partial update is not judged on
  // values it never sent; `overrides` carries the merged values an update
  // resolved against the stored row.
  private guardedValues(
    saveChargeMasterDto: SaveChargeMasterDto,
    overrides: ChargeGuardedValues = {},
  ): ChargeGuardedValues {
    return {
      chgModule: saveChargeMasterDto.chgModule,
      chgRole: hasOwnProperty(saveChargeMasterDto, 'chgRole')
        ? (saveChargeMasterDto.chgRole ?? null)
        : undefined,
      chgMethod: saveChargeMasterDto.chgMethod,
      chgType: hasOwnProperty(saveChargeMasterDto, 'chgType')
        ? (saveChargeMasterDto.chgType ?? null)
        : undefined,
      chgApplyOn: saveChargeMasterDto.chgApplyOn,
      chgCostAlloc: hasOwnProperty(saveChargeMasterDto, 'chgCostAlloc')
        ? (saveChargeMasterDto.chgCostAlloc ?? null)
        : undefined,
      ...overrides,
    };
  }
  // Mirrors the DB-only partial unique index uq_charge_role: at most one
  // FREIGHT/LOADING/UNLOADING/CASH_DISC/OTHERS charge per module among non-deleted
  // rows. The predicate is not expressible in Prisma, so it is enforced here.
  private async ensureRoleIsUnique(
    tx: ChargeMasterWriteClient,
    role: string | null,
    module: string,
    excludeId?: string,
  ): Promise<void> {
    if (
      role === null ||
      !CHARGE_UNIQUE_ROLES.includes(role as (typeof CHARGE_UNIQUE_ROLES)[number])
    ) {
      return;
    }
    const existing = await tx.chargeMaster.findFirst({
      where: {
        chgIsDeleted: false,
        chgRole: role,
        chgModule: module,
        ...(excludeId ? { chgId: { not: excludeId } } : {}),
      },
      select: { chgId: true },
    });
    if (existing) {
      throwMasterConflict<ChargeMasterErrorDetail>(
        `A ${role} charge already exists for module ${module}`,
        [
          {
            field: 'chgRole',
            message: `Only one ${role} charge is allowed per module`,
          },
        ],
      );
    }
  }
  private applyOptionalFields(
    data: Prisma.ChargeMasterUncheckedCreateInput | Prisma.ChargeMasterUncheckedUpdateInput,
    saveChargeMasterDto: SaveChargeMasterDto,
  ): void {
    applyPresentFields(data, saveChargeMasterDto, CHARGE_OPTIONAL_FIELDS);
  }
  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<ChargeMasterErrorDetail>(error, 'Charge already exists', [
      { field: 'chgCode', message: 'Duplicate charge is not allowed' },
    ]);
    if (isForeignKeyConstraintError(error)) {
      throwMasterBadRequest<ChargeMasterErrorDetail>('Invalid relation reference', [
        { field: 'request', message: 'Referenced ledger or tax rate does not exist' },
      ]);
    }
  }
  private throwNotFound(chgId: string): never {
    throwMasterNotFound<ChargeMasterErrorDetail>(
      'Charge not found',
      'chgId',
      `No active charge found with id ${chgId}`,
    );
  }
  // The rate the entry screens price the charge at (CHG-TAX). The charge's own
  // rate wins; a null chgTaxId inherits the ledger's. Read-only, derived, and
  // like chgLedgerName kept out of the audit snapshots (a toPayload with no
  // ledger and no tax answers null for every one of them).
  private taxFields(
    own: ChargeTaxDetail | null,
    inherited: ChargeTaxDetail | null,
    ledTaxId: string | null,
  ): Pick<
    ChargeMasterPayload,
    | 'ledTaxId'
    | 'ledgerTaxPerc'
    | 'chgTaxSource'
    | 'chgTaxRate'
    | 'chgTaxCgstPerc'
    | 'chgTaxSgstPerc'
    | 'chgTaxIgstPerc'
    | 'chgTaxCessPerc'
    | 'chgTaxTaxability'
    | 'ledGstRate'
  > {
    const effective = own ?? inherited;
    const rate = effective ? toNullableNumber(effective.taxRatePerc) : null;
    return {
      ledTaxId,
      ledgerTaxPerc: inherited ? toNullableNumber(inherited.taxRatePerc) : null,
      chgTaxSource: own ? 'CHARGE' : inherited ? 'LEDGER' : null,
      chgTaxRate: rate,
      chgTaxCgstPerc: effective ? toNullableNumber(effective.taxCgstPerc) : null,
      chgTaxSgstPerc: effective ? toNullableNumber(effective.taxSgstPerc) : null,
      chgTaxIgstPerc: effective ? toNullableNumber(effective.taxIgstPerc) : null,
      chgTaxCessPerc: effective ? toNullableNumber(effective.taxCessPerc) : null,
      chgTaxTaxability: effective?.taxTaxability ?? null,
      // The name the Qt charge grid still reads (it was a column until
      // 20260912100000). Same figure as chgTaxRate; new clients read that.
      ledGstRate: rate,
    };
  }

  private toPayload(
    record: ChargeMaster,
    ledger: ChargeLedgerDetail | null = null,
    tax: ChargeTaxDetail | null = null,
  ): ChargeMasterPayload {
    return {
      chgId: record.chgId,
      chgName: record.chgName,
      chgCode: record.chgCode,
      chgModule: record.chgModule,
      chgRole: record.chgRole,
      chgMethod: record.chgMethod,
      chgType: record.chgType,
      chgApplyOn: record.chgApplyOn,
      chgDefaultRate: toNullableNumber(record.chgDefaultRate),
      chgLandingCost: record.chgLandingCost,
      chgCostAlloc: record.chgCostAlloc,
      chgLedgerCode: record.chgLedgerCode,
      chgLedgerName: ledger?.ledName ?? null,
      ledHsnSac: ledger?.ledHsnSac ?? null,
      chgTaxApl: record.chgTaxApl,
      chgBeforeTax: record.chgBeforeTax,
      chgTaxId: record.chgTaxId,
      chgTaxName: tax?.taxName ?? null,
      ...this.taxFields(tax, ledger?.taxRate ?? null, ledger?.ledTaxId ?? null),
      chgSepPost: record.chgSepPost,
      chgManParty: record.chgManParty,
      chgDispOrder: record.chgDispOrder,
      chgAutoApply: record.chgAutoApply,
      chgIsActive: record.chgIsActive,
      chgIsDeleted: record.chgIsDeleted,
      chgSyncDate: record.chgSyncDate ? record.chgSyncDate.toISOString() : null,
      chgCreatedOn: record.chgCreatedOn.toISOString(),
      chgCreatedBy: record.chgCreatedBy,
      chgModifiedOn: record.chgModifiedOn ? record.chgModifiedOn.toISOString() : null,
      chgModifiedBy: record.chgModifiedBy,
    };
  }
}
