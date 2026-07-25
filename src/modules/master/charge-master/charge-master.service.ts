import { Injectable } from '@nestjs/common';
import { ChargeMaster, Prisma } from '@prisma/client';
import {  ConfiguredGridSqlService} from '../../../common/configured-grid-sql/configured-grid-sql.service';
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
  resolveChargeModules,
} from './types/charge-master-api.types';
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
  'chgSepPost',
  'chgManParty',
  'chgDispOrder',
  'chgAutoApply',
  'chgIsActive',
];
// Columns pulled from the mapped acc_ledger_master row and echoed on the
// payload (display label + the GST attributes the charge inherits).
const CHARGE_LEDGER_SELECT = {
  ledName: true,
  ledHsnSac: true,
  ledGstRate: true,
  ledTaxability: true,
} as const satisfies Prisma.AccLedgerMasterSelect;
type ChargeMasterWriteClient = MasterWriteClient;
@Injectable()
export class ChargeMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
  ) { }
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
      include: { ledger: { select: CHARGE_LEDGER_SELECT } },
    });
    if (!record) {
      this.throwNotFound(chgId);
    }
    return this.toPayload(record, record.ledger ?? null);
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
      include: { ledger: { select: CHARGE_LEDGER_SELECT } },
      orderBy: [{ chgDispOrder: { sort: 'asc', nulls: 'last' } }, { chgName: 'asc' }],
    });
    return records.map((record) => this.toPayload(record, record.ledger ?? null));
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
    this.ensureValuesAreAllowed(this.guardedValues(saveChargeMasterDto));
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
        await this.ensureCodeIsUnique(tx, normalizedCode);
        await this.ensureRoleIsUnique(tx, role, module);
        const created = await tx.chargeMaster.create({ data });
        const payload = this.toPayload(created, ledgerName);
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
        this.ensureValuesAreAllowed(
          this.guardedValues(saveChargeMasterDto, { chgModule: nextModule, chgRole: nextRole }),
        );
        const ledgerName = await this.ensureLedgerExists(tx, saveChargeMasterDto.chgLedgerCode);
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
        const payload = this.toPayload(updated, ledgerName);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: CHARGE_MASTER_TABLE_NAME,
            screenName: CHARGE_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: chgId,
            displayName: payload.chgName,
            // Audit tracks stored columns only; chgLedgerName and the led*
            // tax fields are derived from the ledger, so keep them out of both
            // snapshots to avoid a spurious "changed" diff on every update.
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
    if (role === null || !CHARGE_UNIQUE_ROLES.includes(role as (typeof CHARGE_UNIQUE_ROLES)[number])) {
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
        { field: 'request', message: 'Referenced ledger does not exist' },
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
  private toPayload(
    record: ChargeMaster,
    ledger: ChargeLedgerDetail | null = null,
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
      ledGstRate: toNullableNumber(ledger?.ledGstRate ?? null),
      ledTaxability: ledger?.ledTaxability ?? null,
      chgTaxApl: record.chgTaxApl,
      chgBeforeTax: record.chgBeforeTax,
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