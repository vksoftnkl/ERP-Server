import { Injectable } from '@nestjs/common';
import { AccLedgerMaster, Prisma, Supplier } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AccountLedgerMastersService } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { SaveAccountLedgerMasterDto } from '../../accountsModule/accountLedgerMasters/dto/save-account-ledger-master.dto';
import { SaveSupplierDto } from './dto/save-supplier.dto';
import { LedgerBankAccountPayload, SupplierPayload } from './types/supplier-api.types';
import {
  DEFAULT_ACTOR,
  PurchaseWriteClient,
  hasOwnProperty,
  normalizeRequiredText,
  resolveActor,
  throwOnUniqueConstraintError,
  throwPurchaseBadRequest,
  throwPurchaseConflict,
  throwPurchaseNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const SUPPLIER_TABLE_NAME = 'suppliers';
const SUPPLIER_AUDIT_SCREEN_NAME = 'Supplier Master';
// Every supplier is provisioned with a linked account ledger under this fixed
// account group, and the supplier reuses that ledger's id as its own primary key.
const SUPPLIER_LINKED_LEDGER_GROUP_ID = '019f081c-98cc-757a-9346-4cfba810c47f';
// Supplier field -> linked-ledger field copy map. Each entry is copied onto the
// ledger DTO only when the supplier payload actually carries that key.
const SUPPLIER_TO_LEDGER_FIELD_MAP: ReadonlyArray<
  [keyof SaveSupplierDto, keyof SaveAccountLedgerMasterDto]
> = [
  ['supCompanyId', 'ledCompanyId'],
  ['supBranchId', 'ledBranchId'],
  ['supShort', 'ledShort'],
  ['supMailId', 'ledEmail'],
  ['supTel', 'ledTel'],
  ['supPhone', 'ledPhone1'],
  ['supWhatsappNo', 'ledWhatsappNo'],
  ['supAddr1', 'ledAddr1'],
  ['supAddr2', 'ledAddr2'],
  ['supAddr3', 'ledAddr3'],
  ['supCity', 'ledCity'],
  ['supDistrict', 'ledDistrict'],
  ['supPincode', 'ledPin'],
  ['supCountry', 'ledCountry'],
  ['supRegionName', 'ledRegionName'],
  ['supRegionAddr1', 'ledRegionAddr1'],
  ['supRegionAddr2', 'ledRegionAddr2'],
  ['supRegionAddr3', 'ledRegionAddr3'],
  ['supRegionCity', 'ledRegionCity'],
  ['supRegionDistrict', 'ledRegionDistrict'],
  ['supRegionStateName', 'ledRegionStateName'],
  ['supRegionCountry', 'ledRegionCountry'],
  ['supGstNo', 'ledGstinNo'],
  ['supPanNo', 'ledPanNo'],
  ['supNotes', 'ledRemarks'],
  ['supIsActive', 'ledIsActive'],
];
// Notes 81 — on a create with supLinkLedId the supplier row starts from the ledger it joins:
// each of these fields the payload leaves blank takes the ledger's value. It is the sync map
// above read backwards, less the active flag and the notes (they belong to the role), plus the
// three columns the ledger requires.
const SUPPLIER_FIELDS_FROM_LINKED_LEDGER: ReadonlyArray<[keyof SaveSupplierDto, string]> = [
  ['supName', 'ledName'],
  ['supStateName', 'ledStateName'],
  ['supStateCode', 'ledStateCode'],
  ...SUPPLIER_TO_LEDGER_FIELD_MAP.filter(
    ([supField]) => supField !== 'supIsActive' && supField !== 'supNotes',
  ),
];
// Supplier columns narrower than the ledger's. A ledger value that would not fit is left out
// rather than cut short, so the save cannot fail on a column width.
const SUPPLIER_LINK_MAX_LENGTH: Partial<Record<keyof SaveSupplierDto, number>> = {
  supMailId: 120,
  supRegionName: 200,
};
type SupplierWriteClient = PurchaseWriteClient;
@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
    private readonly accountLedgerMastersService: AccountLedgerMastersService,
  ) {}
  async save(saveSupplierDto: SaveSupplierDto): Promise<SupplierPayload> {
    if (saveSupplierDto.supId) {
      // A client may echo the link it created the supplier with; only a different ledger is wrong.
      if (saveSupplierDto.supLinkLedId && saveSupplierDto.supLinkLedId !== saveSupplierDto.supId) {
        throwPurchaseBadRequest('Validation failed', [
          { field: 'supLinkLedId', message: 'supLinkLedId applies to a create only' },
        ]);
      }
      return this.updateSupplier(saveSupplierDto);
    }
    return this.createSupplier(saveSupplierDto);
  }
  async getById(supId: string): Promise<SupplierPayload> {
    const record = await this.prisma.supplier.findFirst({
      where: { supId, supIsDeleted: false },
    });
    if (!record) {
      throwPurchaseNotFound(
        'Supplier not found',
        'supId',
        `No active supplier found with id ${supId}`,
      );
    }
    // Bank accounts live on the linked account ledger (it shares sup_id as its PK), so load
    // them alongside the related master names and embed them in the supplier payload.
    const [relatedNames, ledgerBankAccount] = await Promise.all([
      this.resolveRelatedNames(this.prisma, record),
      this.accountLedgerMastersService.listBankAccountPayloads(record.supId),
    ]);
    const payload = this.toPayload(record, ledgerBankAccount);
    return { ...payload, ...relatedNames };
  }
  async softDelete(supId: string): Promise<{ supId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.supplier.findFirst({
        where: { supId, supIsDeleted: false },
      });
      if (!existing) {
        throwPurchaseNotFound(
          'Supplier not found',
          'supId',
          `No active supplier found with id ${supId}`,
        );
      }
      const modifiedOn = new Date();
      const result = await tx.supplier.updateMany({
        where: { supId, supIsDeleted: false },
        data: {
          supIsDeleted: true,
          supIsActive: false,
          supModifiedOn: modifiedOn,
          supModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwPurchaseNotFound(
          'Supplier not found',
          'supId',
          `No active supplier found with id ${supId}`,
        );
      }
      // Soft delete the linked account ledger (shares sup_id as its PK) so it can't stay active
      // while the supplier is logically deleted. No-op for legacy rows with no linked ledger.
      // Notes 81: a ledger that is also a live customer's stays, with the customer's active flag.
      const customerRole = await this.findCustomerRole(tx, supId);
      await tx.accLedgerMaster.updateMany({
        where: { ledId: supId, ledIsDeleted: false },
        data: customerRole
          ? {
              ledIsActive: customerRole.cusIsActive,
              ledModifiedOn: modifiedOn,
              ledModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            }
          : {
              ledIsDeleted: true,
              ledIsActive: false,
              ledModifiedOn: modifiedOn,
              ledModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
            },
      });
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        supIsDeleted: true,
        supIsActive: false,
        supModifiedOn: modifiedOn,
        supModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: SUPPLIER_TABLE_NAME,
          screenName: SUPPLIER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: supId,
          displayName: existing.supName,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: customerRole
            ? 'Supplier soft deleted; its ledger stays with the customer'
            : 'Supplier soft deleted',
        },
        tx,
      );
      return { supId, deleted: true };
    });
  }
  private async createSupplier(saveSupplierDto: SaveSupplierDto): Promise<SupplierPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Notes 81: with supLinkLedId the supplier joins an existing party ledger instead of
        // provisioning one, so a party we sell to and buy from keeps one ledger and one balance.
        const linkLedger = saveSupplierDto.supLinkLedId
          ? await this.loadLedgerToLink(tx, saveSupplierDto.supLinkLedId)
          : null;
        // The link create leaves the ledger untouched, bank accounts included; they ride on the
        // next supplier save, or go on from the ledger master.
        if (linkLedger && (saveSupplierDto.ledgerBankAccount?.length ?? 0) > 0) {
          throwPurchaseBadRequest('Validation failed', [
            {
              field: 'ledgerBankAccount',
              message: 'Bank accounts cannot be sent with supLinkLedId; save them afterwards',
            },
          ]);
        }
        const dto = linkLedger
          ? this.withLinkedLedgerDefaults(saveSupplierDto, linkLedger)
          : saveSupplierDto;
        const normalizedName = normalizeRequiredText(dto.supName, 'supName');
        const normalizedPurchaseType = normalizeRequiredText(
          dto.supPurchaseType,
          'supPurchaseType',
        );
        const normalizedStateName = normalizeRequiredText(dto.supStateName, 'supStateName');
        const normalizedStateCode = this.normalizeStateCode(dto.supStateCode);
        const normalizedGstType = normalizeRequiredText(dto.supGstType, 'supGstType');
        const now = new Date();
        const createdBy = resolveActor(dto.supCreatedBy, this.requestContextService.getUserId());
        const data: Prisma.SupplierUncheckedCreateInput = {
          supGroupId: dto.supGroupId,
          supPurchaseType: normalizedPurchaseType,
          supName: normalizedName,
          supStateName: normalizedStateName,
          supStateCode: normalizedStateCode,
          supGstType: normalizedGstType,
          supBilledDate: now,
          supCreatedOn: now,
          supCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, dto);
        await this.ensureSupplierGroupExists(tx, data.supGroupId);
        const companyId = hasOwnProperty(dto, 'supCompanyId') ? (dto.supCompanyId ?? null) : null;
        await this.ensureNameIsUnique(tx, normalizedName, companyId, linkLedger?.ledId);
        if (linkLedger) {
          return this.createSupplierOnLedger(tx, data, linkLedger);
        }
        // Provision the linked account ledger first, then reuse its led_id as the
        // supplier's sup_id so the two masters share one identity (1:1 link).
        const ledgerDto = this.buildLinkedLedgerDto(dto, {
          name: normalizedName,
          stateName: normalizedStateName,
          stateCode: normalizedStateCode,
        });
        const ledger = await this.accountLedgerMastersService.createLedgerWithinTx(ledgerDto, tx);
        data.supId = ledger.ledId;
        const created = await tx.supplier.create({ data });
        const payload = this.toPayload(created, ledger.ledgerBankAccount);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: SUPPLIER_TABLE_NAME,
            screenName: SUPPLIER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.supId,
            displayName: payload.supName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Supplier created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError(error, 'Supplier already exists', [
        { field: 'supName', message: 'Duplicate supplier name is not allowed' },
      ]);
      throw error;
    }
  }
  // Notes 81 — insert only the supplier row, keyed by the ledger's id. The ledger is not
  // written at all: no rename, no field sync and, above all, no move to the Suppliers group,
  // because a customer's ledger stays under its area. Nor is the ledger's name checked for
  // uniqueness, since the name it would clash with is this very party's own.
  //
  // A supplier row deleted earlier while the ledger lived on (it was a customer's too) is
  // brought back rather than refused: sup_id is the PK, so a second row cannot exist, and
  // refusing would leave the party unable ever to be a supplier again.
  private async createSupplierOnLedger(
    tx: SupplierWriteClient,
    data: Prisma.SupplierUncheckedCreateInput,
    ledger: AccLedgerMaster,
  ): Promise<SupplierPayload> {
    const supId = ledger.ledId;
    const previous = await tx.supplier.findUnique({ where: { supId } });
    if (previous && !previous.supIsDeleted) {
      throwPurchaseConflict('Supplier already exists', [
        { field: 'supLinkLedId', message: `Ledger "${ledger.ledName}" is already a supplier` },
      ]);
    }
    let saved: Supplier;
    if (previous) {
      // The row keeps its original creation stamp; this save is its latest modification.
      const { supCreatedOn, supCreatedBy, ...revived } = data;
      saved = await tx.supplier.update({
        where: { supId },
        data: {
          ...revived,
          supIsDeleted: false,
          supIsActive: data.supIsActive ?? true,
          supModifiedOn: supCreatedOn,
          supModifiedBy: supCreatedBy,
        },
      });
    } else {
      saved = await tx.supplier.create({ data: { ...data, supId } });
    }
    const ledgerBankAccount = await this.accountLedgerMastersService.listBankAccountPayloads(supId);
    const payload = this.toPayload(saved, ledgerBankAccount);
    await this.auditLogService.logEntityChange(
      {
        action: previous ? 'update' : 'New',
        tableName: SUPPLIER_TABLE_NAME,
        screenName: SUPPLIER_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: supId,
        displayName: payload.supName,
        originalRecord: previous ? this.toPayload(previous) : null,
        modifiedRecord: payload,
        userId: saved.supModifiedBy,
        notes: previous
          ? 'Supplier restored on its existing ledger'
          : 'Supplier created on an existing ledger',
      },
      tx,
    );
    return payload;
  }
  // The ledger a link create joins: live, and a party's. A NULL type is accepted on a ledger
  // that already backs a live customer — those were provisioned in June 2026 before
  // createLedgerWithinTx stamped PARTY, and the customer row says what they are.
  private async loadLedgerToLink(tx: SupplierWriteClient, ledId: string): Promise<AccLedgerMaster> {
    const ledger = await tx.accLedgerMaster.findFirst({ where: { ledId, ledIsDeleted: false } });
    if (!ledger) {
      throwPurchaseBadRequest('Ledger does not exist', [
        { field: 'supLinkLedId', message: `No active account ledger found with id ${ledId}` },
      ]);
    }
    if (ledger.ledLedgerType !== 'PARTY' && !(await this.findCustomerRole(tx, ledId))) {
      throwPurchaseBadRequest('Ledger is not a party ledger', [
        {
          field: 'supLinkLedId',
          message: `Ledger "${ledger.ledName}" is a ${ledger.ledLedgerType ?? 'untyped'} ledger; only a PARTY ledger can be a supplier`,
        },
      ]);
    }
    return ledger;
  }
  private async updateSupplier(saveSupplierDto: SaveSupplierDto): Promise<SupplierPayload> {
    const supId = saveSupplierDto.supId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.supplier.findFirst({
          where: { supId, supIsDeleted: false },
        });
        if (!existing) {
          throwPurchaseNotFound(
            'Supplier not found',
            'supId',
            `No active supplier found with id ${supId}`,
          );
        }
        const normalizedName = normalizeRequiredText(saveSupplierDto.supName, 'supName');
        const normalizedPurchaseType = normalizeRequiredText(
          saveSupplierDto.supPurchaseType,
          'supPurchaseType',
        );
        const normalizedStateName = normalizeRequiredText(
          saveSupplierDto.supStateName,
          'supStateName',
        );
        const normalizedStateCode = this.normalizeStateCode(saveSupplierDto.supStateCode);
        const normalizedGstType = normalizeRequiredText(saveSupplierDto.supGstType, 'supGstType');
        await this.ensureSupplierGroupExists(tx, saveSupplierDto.supGroupId);
        const nextCompanyId = hasOwnProperty(saveSupplierDto, 'supCompanyId')
          ? (saveSupplierDto.supCompanyId ?? null)
          : existing.supCompanyId;
        await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, supId);
        const now = new Date();
        const data: Prisma.SupplierUncheckedUpdateInput = {
          supGroupId: saveSupplierDto.supGroupId,
          supPurchaseType: normalizedPurchaseType,
          supName: normalizedName,
          supStateName: normalizedStateName,
          supStateCode: normalizedStateCode,
          supGstType: normalizedGstType,
          supBilledDate: now,
          supModifiedOn: now,
          supModifiedBy: resolveActor(
            saveSupplierDto.supModifiedBy,
            this.requestContextService.getUserId(),
          ),
        };
        this.applyOptionalFields(data, saveSupplierDto);
        const updated = await tx.supplier.update({ where: { supId }, data });
        // Keep the linked account ledger (shares sup_id as its PK) in sync with the edited
        // supplier fields, mirroring how createSupplier provisions it. Same transaction =>
        // atomic. Guarded so legacy suppliers with no linked ledger stay a no-op.
        const linkedLedger = await tx.accLedgerMaster.findFirst({
          where: { ledId: supId, ledIsDeleted: false },
          select: { ledId: true, ledGroupId: true },
        });
        let ledgerBankAccount: LedgerBankAccountPayload[] = [];
        if (linkedLedger) {
          const ledgerDto = this.buildLinkedLedgerDto(saveSupplierDto, {
            name: normalizedName,
            stateName: normalizedStateName,
            stateCode: normalizedStateCode,
          });
          ledgerDto.ledId = supId;
          // Notes 81: a ledger that is also a live customer's is one party with one group, which
          // a supplier edit must not flip to Suppliers (that moves the balance from Assets to
          // Liabilities). Nor may deactivating the supplier switch off the customer's ledger.
          const customerRole = await this.findCustomerRole(tx, supId);
          if (customerRole) {
            ledgerDto.ledGroupId = linkedLedger.ledGroupId;
            ledgerDto.ledIsActive = updated.supIsActive || customerRole.cusIsActive;
          }
          const ledger = await this.accountLedgerMastersService.updateLedgerWithinTx(ledgerDto, tx);
          ledgerBankAccount = ledger.ledgerBankAccount;
        }
        const payload = this.toPayload(updated, ledgerBankAccount);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: SUPPLIER_TABLE_NAME,
            screenName: SUPPLIER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: supId,
            displayName: payload.supName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.supModifiedBy,
            notes: 'Supplier updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError(error, 'Supplier already exists', [
        { field: 'supName', message: 'Duplicate supplier name is not allowed' },
      ]);
      throw error;
    }
  }
  private async resolveRelatedNames(
    client: SupplierWriteClient,
    record: Pick<Supplier, 'supCompanyId' | 'supBranchId' | 'supGroupId'>,
  ): Promise<{
    supCompanyName: string | null;
    supBranchName: string | null;
    supGroupName: string | null;
  }> {
    const [company, branch, group] = await Promise.all([
      record.supCompanyId
        ? client.company.findFirst({
            where: { compId: record.supCompanyId },
            select: { compName: true },
          })
        : null,
      record.supBranchId
        ? client.branchMaster.findFirst({
            where: { brId: record.supBranchId },
            select: { brName: true },
          })
        : null,
      record.supGroupId
        ? client.supplierGroup.findFirst({
            where: { spgId: record.supGroupId },
            select: { spgName: true },
          })
        : null,
    ]);
    return {
      supCompanyName: company?.compName ?? null,
      supBranchName: branch?.brName ?? null,
      supGroupName: group?.spgName ?? null,
    };
  }
  // The customer row sharing this ledger, if it is live. Deleted rows don't count: a ledger
  // whose customer is gone is the supplier's alone again.
  private findCustomerRole(
    tx: SupplierWriteClient,
    ledId: string,
  ): Promise<{ cusIsActive: boolean } | null> {
    return tx.customer.findFirst({
      where: { cusId: ledId, cusIsDeleted: false },
      select: { cusIsActive: true },
    });
  }
  // A copy of the payload with every blank SUPPLIER_FIELDS_FROM_LINKED_LEDGER field filled from
  // the ledger. Blank is undefined, null or ''; the client opens the form prefilled, so a field it
  // sends empty means "not filled in", not "clear".
  private withLinkedLedgerDefaults(
    saveSupplierDto: SaveSupplierDto,
    ledger: AccLedgerMaster,
  ): SaveSupplierDto {
    const dto: Record<string, unknown> = { ...saveSupplierDto };
    const ledgerRecord = ledger as unknown as Record<string, unknown>;
    for (const [supField, ledField] of SUPPLIER_FIELDS_FROM_LINKED_LEDGER) {
      const current = dto[supField];
      const fallback = ledgerRecord[ledField];
      const maxLength = SUPPLIER_LINK_MAX_LENGTH[supField];
      if (
        (current === undefined || current === null || current === '') &&
        fallback !== null &&
        fallback !== undefined &&
        !(maxLength !== undefined && typeof fallback === 'string' && fallback.length > maxLength)
      ) {
        dto[supField] = fallback;
      }
    }
    return dto as unknown as SaveSupplierDto;
  }
  private async ensureSupplierGroupExists(
    tx: SupplierWriteClient,
    supGroupId: string,
  ): Promise<void> {
    const record = await tx.supplierGroup.findFirst({
      where: { spgId: supGroupId, spgIsDeleted: false },
      select: { spgId: true },
    });
    if (!record) {
      throwPurchaseBadRequest('Supplier group does not exist', [
        { field: 'supGroupId', message: `No active supplier group found with id ${supGroupId}` },
      ]);
    }
  }
  private async ensureNameIsUnique(
    tx: SupplierWriteClient,
    supName: string,
    companyId: string | null,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.supplier.findFirst({
      where: {
        supIsDeleted: false,
        supCompanyId: companyId,
        supName: { equals: supName, mode: 'insensitive' },
        ...(excludeId ? { supId: { not: excludeId } } : {}),
      },
      select: { supId: true },
    });
    if (existing) {
      throwPurchaseConflict('Supplier name already exists for this company', [
        { field: 'supName', message: 'Duplicate supplier name is not allowed for this company' },
      ]);
    }
  }
  // Map the supplier payload onto a ledger DTO for the linked account ledger.
  // Required ledger fields come from the supplier's already-normalized values; the
  // remaining shared fields are copied only when present on the supplier payload.
  private buildLinkedLedgerDto(
    saveSupplierDto: SaveSupplierDto,
    normalized: { name: string; stateName: string; stateCode: string },
  ): SaveAccountLedgerMasterDto {
    const ledgerDto: SaveAccountLedgerMasterDto = {
      ledGroupId: SUPPLIER_LINKED_LEDGER_GROUP_ID,
      ledName: normalized.name,
      ledStateName: normalized.stateName,
      ledStateCode: normalized.stateCode,
      // Suppliers are always settled bill-wise, so the linked ledger is
      // provisioned (and kept) with bill-by-bill on; the column defaults to false.
      ledIsBillByBill: true,
    };
    const ledgerDtoRecord = ledgerDto as unknown as Record<string, unknown>;
    const supplierRecord = saveSupplierDto as unknown as Record<string, unknown>;
    for (const [supField, ledField] of SUPPLIER_TO_LEDGER_FIELD_MAP) {
      if (hasOwnProperty(saveSupplierDto, supField)) {
        ledgerDtoRecord[ledField] = supplierRecord[supField];
      }
    }
    // The nested bank accounts ride straight through to the linked ledger, which owns the
    // acc_ledger_bank_accounts rows and handles the insert/update/default-flag sync.
    if (hasOwnProperty(saveSupplierDto, 'ledgerBankAccount')) {
      ledgerDto.ledgerBankAccount = saveSupplierDto.ledgerBankAccount;
    }
    return ledgerDto;
  }
  private applyOptionalFields(
    data: Prisma.SupplierUncheckedCreateInput | Prisma.SupplierUncheckedUpdateInput,
    saveSupplierDto: SaveSupplierDto,
  ): void {
    const optionalFields = [
      'supCompanyId',
      'supBranchId',
      'supShort',
      'supAddr1',
      'supAddr2',
      'supAddr3',
      'supCity',
      'supDistrict',
      'supCountry',
      'supPincode',
      'supTel',
      'supPhone',
      'supMailId',
      'supWhatsappNo',
      'supWebsiteAddress',
      'supChequePreName',
      'supNotes',
      'supCreditDays',
      'supCashDiscPerc',
      'supGstNo',
      'supPanNo',
      'supSupCst',
      'supDrugLiscenceNo',
      'supRegionName',
      'supRegionAddr1',
      'supRegionAddr2',
      'supRegionAddr3',
      'supRegionCity',
      'supRegionDistrict',
      'supRegionStateName',
      'supRegionCountry',
      'supSortOrder',
      'supIsActive',
    ];
    for (const field of optionalFields) {
      if (hasOwnProperty(saveSupplierDto, field)) {
        (data as Record<string, unknown>)[field] = (
          saveSupplierDto as unknown as Record<string, unknown>
        )[field];
      }
    }
    if (hasOwnProperty(saveSupplierDto, 'supCollectionDays')) {
      data.supCollectionDays = saveSupplierDto.supCollectionDays ?? [];
    }
  }

  private normalizeStateCode(value: string | null | undefined): string {
    const normalized = (value ?? '').trim().toUpperCase();
    if (normalized.length !== 2) {
      throwPurchaseBadRequest('Validation failed', [
        { field: 'supStateCode', message: 'supStateCode must be exactly 2 characters' },
      ]);
    }
    return normalized;
  }
  private toPayload(
    record: Supplier,
    ledgerBankAccount: LedgerBankAccountPayload[] = [],
  ): SupplierPayload {
    return {
      supId: record.supId,
      supCompanyId: record.supCompanyId,
      supBranchId: record.supBranchId,
      supGroupId: record.supGroupId,
      supPurchaseType: record.supPurchaseType,
      supName: record.supName,
      supShort: record.supShort,
      supAddr1: record.supAddr1,
      supAddr2: record.supAddr2,
      supAddr3: record.supAddr3,
      supCity: record.supCity,
      supDistrict: record.supDistrict,
      supStateName: record.supStateName,
      supCountry: record.supCountry,
      supPincode: record.supPincode,
      supTel: record.supTel,
      supPhone: record.supPhone,
      supMailId: record.supMailId,
      supWhatsappNo: record.supWhatsappNo,
      supWebsiteAddress: record.supWebsiteAddress,
      supChequePreName: record.supChequePreName,
      supNotes: record.supNotes,
      supCreditDays: record.supCreditDays,
      supCashDiscPerc: toNumber(record.supCashDiscPerc),
      supCollectionDays: record.supCollectionDays,
      supGstNo: record.supGstNo,
      supStateCode: record.supStateCode,
      supPanNo: record.supPanNo,
      supGstType: record.supGstType,
      supSupCst: record.supSupCst,
      supDrugLiscenceNo: record.supDrugLiscenceNo,
      supRegionName: record.supRegionName,
      supRegionAddr1: record.supRegionAddr1,
      supRegionAddr2: record.supRegionAddr2,
      supRegionAddr3: record.supRegionAddr3,
      supRegionCity: record.supRegionCity,
      supRegionDistrict: record.supRegionDistrict,
      supRegionStateName: record.supRegionStateName,
      supRegionCountry: record.supRegionCountry,
      supBilledDate: record.supBilledDate ? record.supBilledDate.toISOString() : null,
      supSortOrder: record.supSortOrder,
      supIsActive: record.supIsActive,
      supIsDeleted: record.supIsDeleted,
      supSyncDate: record.supSyncDate ? record.supSyncDate.toISOString() : null,
      supCreatedOn: record.supCreatedOn.toISOString(),
      supCreatedBy: record.supCreatedBy,
      supModifiedOn: record.supModifiedOn.toISOString(),
      supModifiedBy: record.supModifiedBy,
      ledgerBankAccount,
    };
  }
}
