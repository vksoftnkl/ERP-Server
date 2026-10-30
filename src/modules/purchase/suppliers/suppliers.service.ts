import { Injectable } from '@nestjs/common';
import { AccLedgerMaster, Prisma, Supplier } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AccountLedgerMastersService } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { SaveAccountLedgerMasterDto } from '../../accountsModule/accountLedgerMasters/dto/save-account-ledger-master.dto';
import { SaveSupplierDto } from './dto/save-supplier.dto';
import { LedgerBankAccountPayload, SupplierPayload } from './types/supplier-api.types';
import { SupplierErrorCode } from './types/supplier-error-codes';
import type { SupplierErrorDetail, SupplierSavePayload } from './types/supplier-api.types';
import { assertMenuRight } from '../../../common/posting/rights';
import {
  PartyBalanceService,
  withFigures,
  type PartyDeleteCheck,
} from '../../../common/party/party-balance.service';
import {
  NO_PARTY_SYNC,
  PartySyncService,
  type PartySyncResult,
} from '../../../common/party/party-sync.service';
import { PARTY_DETAIL_FIELDS } from '../../../common/party/party-detail.map';
import {
  ledgerGstFieldsOf,
  partyGstTypeWord,
  resolvePartyGstType,
  type PartyGstRefusal,
  type PartyGstType,
} from '../../../common/party/party-gst-type';
import {
  DEFAULT_ACTOR,
  PurchaseWriteClient,
  isPresentField,
  normalizeRequiredText,
  resolveActor,
  throwConflict,
  throwOnUniqueConstraintError,
  throwPurchaseBadRequest,
  throwPurchaseConflict,
  throwPurchaseNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const SUPPLIER_TABLE_NAME = 'suppliers';
const SUPPLIER_AUDIT_SCREEN_NAME = 'Supplier Master';
// fixed.menu_master 22 = Suppliers: delete and delete-check need its `delete` right (D1-6).
const SUPPLIER_MENU_ID = 22;
// Every supplier is provisioned with a linked account ledger under this fixed
// account group, and the supplier reuses that ledger's id as its own primary key.
const SUPPLIER_LINKED_LEDGER_GROUP_ID = '019f081c-98cc-757a-9346-4cfba810c47f';
// Party master rules D4: the party details (address, phones, GSTIN, company …) go to the
// ledger and the customer through the ONE map in common/party/party-detail.map.ts. What is
// left here is the supplier's own ledger keys. supNotes → ledRemarks only while the ledger
// is the supplier's alone: on a shared ledger notes are per role (plan §3.4).
const SUPPLIER_TO_LEDGER_FIELD_MAP: ReadonlyArray<
  [keyof SaveSupplierDto, keyof SaveAccountLedgerMasterDto]
> = [
  ['supNotes', 'ledRemarks'],
  ['supIsActive', 'ledIsActive'],
];
// Notes 81 — on a create with supLinkLedId the supplier row starts from the ledger it joins:
// each of these fields the payload leaves blank takes the ledger's value: the party details
// of the shared map, plus the three columns the ledger requires.
const SUPPLIER_FIELDS_FROM_LINKED_LEDGER: ReadonlyArray<[keyof SaveSupplierDto, string]> = [
  ['supName', 'ledName'],
  ['supStateName', 'ledStateName'],
  ['supStateCode', 'ledStateCode'],
  ...PARTY_DETAIL_FIELDS.filter((field) => field.sup !== null).map(
    (field) => [field.sup as keyof SaveSupplierDto, field.led] as [keyof SaveSupplierDto, string],
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
    private readonly partyBalanceService: PartyBalanceService,
    private readonly partySyncService: PartySyncService,
  ) {}
  async save(rawDto: SaveSupplierDto): Promise<SupplierSavePayload> {
    // The GSTIN is upper-cased and trimmed here: a supplier edit now writes the customer's.
    const saveSupplierDto = normalizeSupplierGstin(rawDto);
    if (saveSupplierDto.supId) {
      // A client may echo the link it created the supplier with; only a different ledger is wrong.
      if (saveSupplierDto.supLinkLedId && saveSupplierDto.supLinkLedId !== saveSupplierDto.supId) {
        throwPurchaseBadRequest('Validation failed', [
          {
            field: 'supLinkLedId',
            message: 'supLinkLedId applies to a create only',
            code: SupplierErrorCode.LINK_LEDGER_ON_UPDATE,
          },
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
        SupplierErrorCode.NOT_FOUND,
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
  // D1-4: what DELETE would answer, as a 200 (a question, not an action).
  async deleteCheck(supId: string): Promise<PartyDeleteCheck> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertDeleteRight(tx);
      await this.loadLiveSupplier(tx, supId);
      return this.partyBalanceService.deleteCheck(tx, {
        partyId: supId,
        role: 'SUPPLIER',
        otherRoleLive: (await this.findCustomerRole(tx, supId)) !== null,
        codes: {
          hasBalance: SupplierErrorCode.HAS_BALANCE,
          hasChequeInHand: SupplierErrorCode.HAS_CHEQUE_IN_HAND,
        },
      });
    });
  }
  private assertDeleteRight(tx: Prisma.TransactionClient): Promise<unknown> {
    return assertMenuRight(tx, {
      userId: this.requestContextService.getUserId() ?? null,
      menuId: SUPPLIER_MENU_ID,
      right: 'delete',
      codePrefix: 'PURCHASE_SUPPLIER',
      action: 'delete suppliers',
    });
  }
  private async loadLiveSupplier(tx: SupplierWriteClient, supId: string): Promise<Supplier> {
    const existing = await tx.supplier.findFirst({ where: { supId, supIsDeleted: false } });
    if (!existing) {
      throwPurchaseNotFound(
        'Supplier not found',
        'supId',
        `No active supplier found with id ${supId}`,
        SupplierErrorCode.NOT_FOUND,
      );
    }
    return existing;
  }
  async softDelete(supId: string): Promise<{ supId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      // D1 (plan §3.1 delete flow): the menu-22 delete right; the ledger row locked; then —
      // only when the ledger goes with this role — the balance and the cheques in hand.
      await this.assertDeleteRight(tx);
      const existing = await this.loadLiveSupplier(tx, supId);
      const ledger = await this.partyBalanceService.lockLedger(tx, supId);
      const otherRoleLive = (await this.findCustomerRole(tx, supId)) !== null;
      if (ledger && !ledger.ledIsDeleted && !otherRoleLive) {
        const check = await this.partyBalanceService.deleteCheck(tx, {
          partyId: supId,
          role: 'SUPPLIER',
          otherRoleLive,
          codes: {
            hasBalance: SupplierErrorCode.HAS_BALANCE,
            hasChequeInHand: SupplierErrorCode.HAS_CHEQUE_IN_HAND,
          },
        });
        if (!check.canDelete) {
          throwConflict('Supplier cannot be deleted', check.refusals);
        }
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
          SupplierErrorCode.NOT_FOUND,
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
  private async createSupplier(saveSupplierDto: SaveSupplierDto): Promise<SupplierSavePayload> {
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
              code: SupplierErrorCode.BANK_WITH_LINK_LEDGER,
            },
          ]);
        }
        const dto = linkLedger
          ? this.withLinkedLedgerDefaults(saveSupplierDto, linkLedger)
          : saveSupplierDto;
        const normalizedName = normalizeRequiredText(
          dto.supName,
          'supName',
          undefined,
          SupplierErrorCode.NAME_REQUIRED,
        );
        const normalizedPurchaseType = normalizeRequiredText(
          dto.supPurchaseType,
          'supPurchaseType',
          undefined,
          SupplierErrorCode.PURCHASE_TYPE_REQUIRED,
        );
        const normalizedStateName = normalizeRequiredText(
          dto.supStateName,
          'supStateName',
          undefined,
          SupplierErrorCode.STATE_NAME_REQUIRED,
        );
        const normalizedStateCode = this.normalizeStateCode(dto.supStateCode);
        normalizeRequiredText(dto.supGstType, 'supGstType', undefined, SupplierErrorCode.GST_TYPE_REQUIRED);
        // D2: one of the five codes, with the GSTIN / state rules (D4-5 GSTIN-state too).
        const normalizedGstType = this.resolveGstType(dto.supGstType, dto.supGstNo, normalizedStateCode);
        const now = new Date();
        const createdBy = resolveActor(dto.supCreatedBy, this.requestContextService.getUserId());
        const data: Prisma.SupplierUncheckedCreateInput = {
          supGroupId: dto.supGroupId,
          supPurchaseType: normalizedPurchaseType,
          supName: normalizedName,
          supStateName: normalizedStateName,
          supStateCode: normalizedStateCode,
          supGstType: normalizedGstType,
          supCreatedOn: now,
          supCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, dto);
        await this.ensureSupplierGroupExists(tx, data.supGroupId);
        const companyId = isPresentField(dto, 'supCompanyId') ? (dto.supCompanyId ?? null) : null;
        await this.ensureNameIsUnique(tx, normalizedName, companyId, linkLedger?.ledId);
        if (linkLedger) {
          const linked = await this.createSupplierOnLedger(tx, data, linkLedger);
          const customerLive = (await this.findCustomerRole(tx, linkLedger.ledId)) !== null;
          return {
            ...linked,
            partySync: { otherRole: customerLive ? 'CUSTOMER' : null, otherRoleUpdated: false, fields: [] },
          };
        }
        // Provision the linked account ledger first, then reuse its led_id as the
        // supplier's sup_id so the two masters share one identity (1:1 link).
        const ledgerDto = this.buildLinkedLedgerDto(
          dto,
          { name: normalizedName, stateName: normalizedStateName, stateCode: normalizedStateCode },
          { gstType: normalizedGstType, shared: false },
        );
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
        return { ...payload, partySync: { ...NO_PARTY_SYNC, fields: [] } };
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError(error, 'Supplier already exists', [
        {
          field: 'supName',
          message: 'Duplicate supplier name is not allowed',
          code: SupplierErrorCode.NAME_EXISTS,
        },
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
        {
          field: 'supLinkLedId',
          message: `Ledger "${ledger.ledName}" is already a supplier`,
          code: SupplierErrorCode.LINK_LEDGER_ALREADY_SUPPLIER,
        },
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
        {
          field: 'supLinkLedId',
          message: `No active account ledger found with id ${ledId}`,
          code: SupplierErrorCode.LINK_LEDGER_NOT_FOUND,
        },
      ]);
    }
    if (ledger.ledLedgerType !== 'PARTY' && !(await this.findCustomerRole(tx, ledId))) {
      throwPurchaseBadRequest('Ledger is not a party ledger', [
        {
          field: 'supLinkLedId',
          message: `Ledger "${ledger.ledName}" is a ${ledger.ledLedgerType ?? 'untyped'} ledger; only a PARTY ledger can be a supplier`,
          code: SupplierErrorCode.LINK_LEDGER_NOT_PARTY,
        },
      ]);
    }
    return ledger;
  }
  private async updateSupplier(saveSupplierDto: SaveSupplierDto): Promise<SupplierSavePayload> {
    const supId = saveSupplierDto.supId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        // D4: the ledger row first, so a supplier save and a customer save of one party
        // (or a delete) run one after the other.
        const lockedLedger = await this.partyBalanceService.lockLedger(tx, supId);
        const existing = await this.loadLiveSupplier(tx, supId);
        const normalizedName = normalizeRequiredText(
          saveSupplierDto.supName,
          'supName',
          undefined,
          SupplierErrorCode.NAME_REQUIRED,
        );
        const normalizedPurchaseType = normalizeRequiredText(
          saveSupplierDto.supPurchaseType,
          'supPurchaseType',
          undefined,
          SupplierErrorCode.PURCHASE_TYPE_REQUIRED,
        );
        const normalizedStateName = normalizeRequiredText(
          saveSupplierDto.supStateName,
          'supStateName',
          undefined,
          SupplierErrorCode.STATE_NAME_REQUIRED,
        );
        const normalizedStateCode = this.normalizeStateCode(saveSupplierDto.supStateCode);
        normalizeRequiredText(
          saveSupplierDto.supGstType,
          'supGstType',
          undefined,
          SupplierErrorCode.GST_TYPE_REQUIRED,
        );
        // D2 on the values the row will hold: a left-out GSTIN keeps the stored one (Q5).
        const normalizedGstType = this.resolveGstType(
          saveSupplierDto.supGstType,
          isPresentField(saveSupplierDto, 'supGstNo') ? saveSupplierDto.supGstNo : existing.supGstNo,
          normalizedStateCode,
        );
        await this.ensureSupplierGroupExists(tx, saveSupplierDto.supGroupId);
        const companySent = isPresentField(saveSupplierDto, 'supCompanyId');
        const nextCompanyId = companySent
          ? (saveSupplierDto.supCompanyId ?? null)
          : existing.supCompanyId;
        await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, supId);
        const linkedLedger =
          lockedLedger && !lockedLedger.ledIsDeleted
            ? await tx.accLedgerMaster.findFirst({
                where: { ledId: supId, ledIsDeleted: false },
                select: { ledId: true, ledGroupId: true, ledCompanyId: true },
              })
            : null;
        // Q7 = a: once the party has books in its company, the company stays.
        if (linkedLedger && companySent && nextCompanyId !== linkedLedger.ledCompanyId) {
          await this.ensureCompanyChangeAllowed(tx, supId, linkedLedger.ledCompanyId, nextCompanyId);
        }
        const customerRole = await this.findCustomerRole(tx, supId);
        const now = new Date();
        const modifiedBy = resolveActor(
          saveSupplierDto.supModifiedBy,
          this.requestContextService.getUserId(),
        );
        // D3-5: no master save writes sup_billed_date.
        const data: Prisma.SupplierUncheckedUpdateInput = {
          supGroupId: saveSupplierDto.supGroupId,
          supPurchaseType: normalizedPurchaseType,
          supName: normalizedName,
          supStateName: normalizedStateName,
          supStateCode: normalizedStateCode,
          supModifiedOn: now,
          supModifiedBy: modifiedBy,
        };
        this.applyOptionalFields(data, saveSupplierDto);
        data.supGstType = normalizedGstType;
        const updated = await tx.supplier.update({ where: { supId }, data });
        // Keep the linked account ledger (shares sup_id as its PK) in sync with the edited
        // supplier fields, mirroring how createSupplier provisions it. Same transaction =>
        // atomic. Guarded so legacy suppliers with no linked ledger stay a no-op.
        let ledgerBankAccount: LedgerBankAccountPayload[] = [];
        if (linkedLedger) {
          const ledgerDto = this.buildLinkedLedgerDto(
            saveSupplierDto,
            { name: normalizedName, stateName: normalizedStateName, stateCode: normalizedStateCode },
            { gstType: normalizedGstType, shared: customerRole !== null },
          );
          ledgerDto.ledId = supId;
          // Notes 81: a ledger that is also a live customer's is one party with one group, which
          // a supplier edit must not flip to Suppliers (that moves the balance from Assets to
          // Liabilities). Nor may deactivating the supplier switch off the customer's ledger.
          if (customerRole) {
            ledgerDto.ledGroupId = linkedLedger.ledGroupId;
            ledgerDto.ledIsActive = updated.supIsActive || customerRole.cusIsActive;
          }
          const ledger = await this.accountLedgerMastersService.updateLedgerWithinTx(ledgerDto, tx);
          ledgerBankAccount = ledger.ledgerBankAccount;
        }
        // D4: the same party details onto the customer of this ledger (audited there). The
        // customer has no name check of its own: the ledger's per-company index is the guard.
        const partySync: PartySyncResult = customerRole
          ? await this.partySyncService.syncOtherRole(tx, {
              role: 'SUPPLIER',
              partyId: supId,
              details: this.partySyncService.detailsOf('SUPPLIER', saveSupplierDto, {
                ledName: normalizedName,
                ledStateName: normalizedStateName,
                ledStateCode: normalizedStateCode,
                ...(companySent ? { ledCompanyId: nextCompanyId } : {}),
              }),
              gstType: normalizedGstType,
              actor: modifiedBy,
            })
          : { ...NO_PARTY_SYNC, fields: [] };
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
        return { ...payload, partySync };
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError(error, 'Supplier already exists', [
        {
          field: 'supName',
          message: 'Duplicate supplier name is not allowed',
          code: SupplierErrorCode.NAME_EXISTS,
        },
      ]);
      throw error;
    }
  }
  private async resolveRelatedNames(
    client: SupplierWriteClient,
    record: Pick<Supplier, 'supCompanyId' | 'supBranchId' | 'supGroupId'> & Partial<Pick<Supplier, 'supDefaultGodownId'>>,
  ): Promise<{
    supCompanyName: string | null;
    supBranchName: string | null;
    supGroupName: string | null;
    supDefaultGodownName: string | null;
  }> {
    const [company, branch, group, godown] = await Promise.all([
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
      record.supDefaultGodownId
        ? client.godownLocation.findFirst({
            where: { gdlId: record.supDefaultGodownId },
            select: { gdlName: true },
          })
        : null,
    ]);
    return {
      supCompanyName: company?.compName ?? null,
      supBranchName: branch?.brName ?? null,
      supGroupName: group?.spgName ?? null,
      supDefaultGodownName: godown?.gdlName ?? null,
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
        {
          field: 'supGroupId',
          message: `No active supplier group found with id ${supGroupId}`,
          code: SupplierErrorCode.UNKNOWN_GROUP,
        },
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
        {
          field: 'supName',
          message: 'Duplicate supplier name is not allowed for this company',
          code: SupplierErrorCode.NAME_EXISTS,
        },
      ]);
    }
  }
  // Map the supplier payload onto a ledger DTO for the linked account ledger.
  // Required ledger fields come from the supplier's already-normalized values; the
  // remaining shared fields are copied only when present on the supplier payload.
  private buildLinkedLedgerDto(
    saveSupplierDto: SaveSupplierDto,
    normalized: { name: string; stateName: string; stateCode: string },
    party: { gstType: PartyGstType; shared: boolean },
  ): SaveAccountLedgerMasterDto {
    const ledgerDto: SaveAccountLedgerMasterDto = {
      ledGroupId: SUPPLIER_LINKED_LEDGER_GROUP_ID,
      ledName: normalized.name,
      ledStateName: normalized.stateName,
      ledStateCode: normalized.stateCode,
      // Suppliers are always settled bill-wise, so the linked ledger is
      // provisioned (and kept) with bill-by-bill on; the column defaults to false.
      ledIsBillByBill: true,
      // D2-3: the type reaches the ledger (SEZ = REGULAR + led_is_sez); before P1 it never did.
      ...ledgerGstFieldsOf(party.gstType),
    };
    const ledgerDtoRecord = ledgerDto as unknown as Record<string, unknown>;
    // D4: the party details through the one shared map.
    Object.assign(ledgerDtoRecord, this.partySyncService.detailsOf('SUPPLIER', saveSupplierDto));
    const supplierRecord = saveSupplierDto as unknown as Record<string, unknown>;
    for (const [supField, ledField] of SUPPLIER_TO_LEDGER_FIELD_MAP) {
      // Plan §3.4: on a shared ledger the notes stay with each role.
      if (supField === 'supNotes' && party.shared) {
        continue;
      }
      if (isPresentField(saveSupplierDto, supField)) {
        ledgerDtoRecord[ledField] = supplierRecord[supField];
      }
    }
    // The nested bank accounts ride straight through to the linked ledger, which owns the
    // acc_ledger_bank_accounts rows and handles the insert/update/default-flag sync.
    if (isPresentField(saveSupplierDto, 'ledgerBankAccount')) {
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
      'supMsmeCategory',
      'supMsmeActivity',
      'supMsmeAgreement',
      'supFssaiNo',
      'supDefaultGodownId',
      'supShowNotesOnEntry',
      'supIsImport',
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
      if (isPresentField(saveSupplierDto, field)) {
        (data as Record<string, unknown>)[field] = (
          saveSupplierDto as unknown as Record<string, unknown>
        )[field];
      }
    }
    // 0 means "not set": the column allows only 1..45 or NULL (ck_sup_msme_days).
    if (isPresentField(saveSupplierDto, 'supMsmeAgreedDays')) {
      data.supMsmeAgreedDays = saveSupplierDto.supMsmeAgreedDays || null;
    }
    if (isPresentField(saveSupplierDto, 'supCollectionDays')) {
      data.supCollectionDays = saveSupplierDto.supCollectionDays ?? [];
    }
    // MST-01 licence dates: YYYY-MM-DD in, a date column out. Left out keeps the
    // stored date; only an explicit null (or blank) clears it.
    for (const field of ['supDrugLicenceExpiry', 'supFssaiValidTo'] as const) {
      if (isPresentField(saveSupplierDto, field)) {
        const v = saveSupplierDto[field];
        (data as Record<string, unknown>)[field] = v ? new Date(`${String(v).slice(0, 10)}T00:00:00Z`) : null;
      }
    }
  }

  // D2 (plan §3.2) + D4-5: the code the row stores, or the refusal in the supplier's words.
  private resolveGstType(
    rawType: string | null | undefined,
    gstin: string | null | undefined,
    stateCode: string,
  ): PartyGstType {
    const result = resolvePartyGstType({ rawType, gstin, stateCode });
    if ('type' in result) {
      return result.type;
    }
    throwPurchaseBadRequest('Validation failed', [supplierGstRefusal(result.refusal)]);
  }
  // Q7 = a: a company change is refused while the party has books in its current company.
  private async ensureCompanyChangeAllowed(
    tx: Prisma.TransactionClient,
    ledId: string,
    currentCompanyId: string | null,
    nextCompanyId: string | null,
  ): Promise<void> {
    const books = await this.partyBalanceService.companyWithBooks(
      tx,
      ledId,
      currentCompanyId,
      nextCompanyId,
    );
    if (books) {
      throwConflict('Supplier company cannot change', [
        withFigures(
          {
            field: 'supCompanyId',
            code: SupplierErrorCode.COMPANY_HAS_BOOKS,
            message: `The party has entries in company ${books.companyId}; its company cannot change`,
          },
          `This party has entries in ${books.companyName ?? 'its company'}.`,
        ),
      ]);
    }
  }
  private normalizeStateCode(value: string | null | undefined): string {
    const normalized = (value ?? '').trim().toUpperCase();
    if (normalized.length !== 2) {
      throwPurchaseBadRequest('Validation failed', [
        {
          field: 'supStateCode',
          message: 'supStateCode must be exactly 2 characters',
          code: SupplierErrorCode.STATE_CODE_INVALID,
        },
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
      supDrugLicenceExpiry: record.supDrugLicenceExpiry ? record.supDrugLicenceExpiry.toISOString().slice(0, 10) : null,
      supMsmeCategory: record.supMsmeCategory,
      supMsmeActivity: record.supMsmeActivity,
      supMsmeAgreement: record.supMsmeAgreement,
      supMsmeAgreedDays: record.supMsmeAgreedDays,
      supFssaiNo: record.supFssaiNo,
      supFssaiValidTo: record.supFssaiValidTo ? record.supFssaiValidTo.toISOString().slice(0, 10) : null,
      supDefaultGodownId: record.supDefaultGodownId,
      supShowNotesOnEntry: record.supShowNotesOnEntry,
      supIsImport: record.supIsImport,
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
// A copy of the payload with supGstNo trimmed and upper-cased ('' = null). Left out stays
// left out (isPresentField).
function normalizeSupplierGstin(dto: SaveSupplierDto): SaveSupplierDto {
  if (!isPresentField(dto, 'supGstNo')) {
    return dto;
  }
  const raw = dto.supGstNo;
  const gstin = typeof raw === 'string' ? raw.trim().toUpperCase() : raw;
  return Object.assign(Object.create(Object.getPrototypeOf(dto) as object) as SaveSupplierDto, dto, {
    supGstNo: gstin === '' ? null : gstin,
  });
}
// The party GST refusals (common/party/party-gst-type.ts) in the supplier's codes.
function supplierGstRefusal(refusal: PartyGstRefusal): SupplierErrorDetail {
  switch (refusal.kind) {
    case 'TYPE_INVALID':
      return {
        field: 'supGstType',
        message: `supGstType "${refusal.sent}" is not one of REGULAR, COMPOSITION, SEZ, OVERSEAS, UNREGISTERED`,
        code: SupplierErrorCode.GST_TYPE_INVALID,
      };
    case 'TYPE_REQUIRED':
      return {
        field: 'supGstType',
        message: 'supGstType is required',
        code: SupplierErrorCode.GST_TYPE_REQUIRED,
      };
    case 'GSTIN_REQUIRED':
      return {
        field: 'supGstNo',
        message: `A ${partyGstTypeWord(refusal.type)} supplier must have a GSTIN`,
        code: SupplierErrorCode.GSTIN_REQUIRED,
      };
    case 'GSTIN_NOT_ALLOWED':
      return {
        field: 'supGstNo',
        message: `An ${partyGstTypeWord(refusal.type)} supplier has no GSTIN; clear supGstNo`,
        code: SupplierErrorCode.GSTIN_NOT_ALLOWED,
      };
    case 'OVERSEAS_STATE':
      return {
        field: 'supStateCode',
        message: `An Overseas supplier's state must be 96 (Other Country), not ${refusal.stateCode}`,
        code: SupplierErrorCode.OVERSEAS_STATE,
      };
    case 'GSTIN_STATE_MISMATCH':
      return {
        field: 'supGstNo',
        message: `GSTIN ${refusal.gstin} is registered in state ${refusal.gstinState}, but supStateCode is ${refusal.stateCode}`,
        code: SupplierErrorCode.GSTIN_STATE_MISMATCH,
      };
  }
}
