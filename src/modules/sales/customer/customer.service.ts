import { ConflictException, Injectable } from '@nestjs/common';
import { AccLedgerMaster, Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AccountLedgerMastersService } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { SaveAccountLedgerMasterDto } from '../../accountsModule/accountLedgerMasters/dto/save-account-ledger-master.dto';
import { LedGstPartyRegType } from '../../accountsModule/accountLedgerMasters/types/account-ledger-master-enum';
import { SaveCustomerDto } from './dto/save-customer.dto';
import {
  CustomerErrorDetail,
  CustomerErrorResponse,
  CustomerPayload,
} from './types/customer-api.types';
import {
  DEFAULT_ACTOR,
  SalesWriteClient,
  applyPresentFields,
  hasOwnProperty,
  normalizeRequiredText,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSalesBadRequest,
  throwSalesConflict,
  throwSalesNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const CUSTOMER_TABLE_NAME = 'customers';
const CUSTOMER_AUDIT_SCREEN_NAME = 'Customer Master';
const CUSTOMER_OPTIONAL_FIELDS = [
  'cusTitle',
  'cusShort',
  'cusCode',
  'cusName',
  'cusAddr1',
  'cusAddr2',
  'cusAddr3',
  'cusCity',
  'cusDistrict',
  'cusCountry',
  'cusLandmark',
  'cusPin',
  'cusTel',
  'cusPhone1',
  'cusPhone2',
  'cusWhatsappNo',
  'cusEmail',
  'cusAadharNo',
  'cusContactPerson',
  'cusDistanceKm',
  'cusCreditAllowed',
  'cusCreditBillLimit',
  'cusCreditAmtLimit',
  'cusCreditDays',
  'cusDebitBalance',
  'cusDiscPerc',
  'cusDebitGraceDays',
  'cusEnableSms',
  'cusOverdueSms',
  'cusOverdueBilling',
  'cusAllowPromotion',
  'cusAllowLoyalty',
  'cusAllowDiscount',
  'cusSortOrder',
  'cusRegionName',
  'cusRegionAddr1',
  'cusRegionAddr2',
  'cusRegionAddr3',
  'cusRegionCity',
  'cusRegionDistrict',
  'cusRegionStateName',
  'cusRegionCountry',
  'cusBirthDate',
  'cusMarriageDate',
  'cusTransportName',
  'cusFreightCharge',
  'cusLoadingCharge',
  'cusUnloadingCharge',
  'cusGstNo',
  'cusPanNo',
  'cusGstType',
  'cusEcommerceGstin',
  'cusTcsApplicable',
  'cusItcollExempted',
  'cusItcollType',
  'cusGeoLocation',
  'cusCollectionDays',
  'cusDefaultSalesman',
  'cusNotes',
  'cusBranchId',
  'cusCompanyId',
  'cusIsActive',
];
// Customer field -> linked-ledger field copy map. Each entry is copied onto the
// ledger DTO only when the customer payload actually carries that key.
const CUSTOMER_TO_LEDGER_FIELD_MAP: ReadonlyArray<
  [keyof SaveCustomerDto, keyof SaveAccountLedgerMasterDto]
> = [
  ['cusCompanyId', 'ledCompanyId'],
  ['cusBranchId', 'ledBranchId'],
  ['cusShort', 'ledShort'],
  ['cusEmail', 'ledEmail'],
  ['cusTel', 'ledTel'],
  ['cusPhone1', 'ledPhone1'],
  ['cusPhone2', 'ledPhone2'],
  ['cusWhatsappNo', 'ledWhatsappNo'],
  ['cusContactPerson', 'ledContactPerson'],
  ['cusAddr1', 'ledAddr1'],
  ['cusAddr2', 'ledAddr2'],
  ['cusAddr3', 'ledAddr3'],
  ['cusCity', 'ledCity'],
  ['cusDistrict', 'ledDistrict'],
  ['cusPin', 'ledPin'],
  ['cusCountry', 'ledCountry'],
  ['cusRegionName', 'ledRegionName'],
  ['cusRegionAddr1', 'ledRegionAddr1'],
  ['cusRegionAddr2', 'ledRegionAddr2'],
  ['cusRegionAddr3', 'ledRegionAddr3'],
  ['cusRegionCity', 'ledRegionCity'],
  ['cusRegionDistrict', 'ledRegionDistrict'],
  ['cusRegionStateName', 'ledRegionStateName'],
  ['cusRegionCountry', 'ledRegionCountry'],
  ['cusGstNo', 'ledGstinNo'],
  ['cusPanNo', 'ledPanNo'],
  ['cusAadharNo', 'ledAadharNo'],
  ['cusEcommerceGstin', 'ledEcommerceGstin'],
  ['cusNotes', 'ledRemarks'],
  ['cusEnableSms', 'ledAllowSms'],
  ['cusSortOrder', 'ledSortOrder'],
  ['cusIsActive', 'ledIsActive'],
];
// Notes 81 — on a create with cusLinkLedId the customer row starts from the ledger it joins:
// each of these fields the payload leaves blank takes the ledger's value. It is the sync map
// above read backwards, less the flags, the sort order and the notes (they belong to the role),
// plus the three columns a customer needs.
const CUSTOMER_FIELDS_NOT_FROM_LINKED_LEDGER = new Set<keyof SaveCustomerDto>([
  'cusIsActive',
  'cusEnableSms',
  'cusSortOrder',
  'cusNotes',
]);
const CUSTOMER_FIELDS_FROM_LINKED_LEDGER: ReadonlyArray<[keyof SaveCustomerDto, string]> = [
  ['cusName', 'ledName'],
  ['cusStateName', 'ledStateName'],
  ['cusStateCode', 'ledStateCode'],
  ...CUSTOMER_TO_LEDGER_FIELD_MAP.filter(
    ([cusField]) => !CUSTOMER_FIELDS_NOT_FROM_LINKED_LEDGER.has(cusField),
  ),
];
// Customer columns narrower than the ledger's. A ledger value that would not fit is left out
// rather than cut short, so the save cannot fail on a column width.
const CUSTOMER_LINK_MAX_LENGTH: Partial<Record<keyof SaveCustomerDto, number>> = {
  cusEmail: 120,
  cusAadharNo: 12,
  cusRegionName: 200,
};
// cus_gst_type is a free-text VarChar(30); the ledger's led_gst_party_reg_type is
// one of REGULAR / COMPOSITION / UNREGISTERED, behind the LedGstPartyRegType
// vocabulary the GST engine reads. Match case- and separator-insensitively;
// anything outside that vocabulary (or blank) syncs as NULL, so a free-text GST
// type on the customer can never fail the customer's own save.
function toLedgerGstPartyRegType(cusGstType: string | null | undefined): LedGstPartyRegType | null {
  if (typeof cusGstType !== 'string') {
    return null;
  }
  const normalized = cusGstType
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '');
  return (
    Object.values(LedGstPartyRegType).find(
      (value) => value.replace(/[\s_-]+/g, '') === normalized,
    ) ?? null
  );
}
// Income-tax collection. The ledger's TCS/TDS applicability (which
// receipt-lines.ts reads to require the TCS / TDS_RECEIVABLE legs) comes from
// cusTcsApplicable plus the legacy cus_itcoll_* pair — a 'TCS' / 'TDS' type and
// an exemption flag, the same pair customer-detail.lookup reads as tcs_customer.
// An explicit exemption vetoes both. Note that neither column describes GST
// input credit, so led_itc_eligibility is deliberately left alone.
// A flag is returned only when the payload carries a column that decides it, so
// a partial update can't clobber the ledger's current value.
function toLedgerItCollectionFlags(saveCustomerDto: SaveCustomerDto): {
  tcs?: boolean;
  tds?: boolean;
} {
  const hasTcsFlag = hasOwnProperty(saveCustomerDto, 'cusTcsApplicable');
  const hasItcollType = hasOwnProperty(saveCustomerDto, 'cusItcollType');
  const hasItcollExempted = hasOwnProperty(saveCustomerDto, 'cusItcollExempted');
  if (!hasTcsFlag && !hasItcollType && !hasItcollExempted) {
    return {};
  }
  if (saveCustomerDto.cusItcollExempted === true) {
    return { tcs: false, tds: false };
  }
  const itcollType =
    typeof saveCustomerDto.cusItcollType === 'string'
      ? saveCustomerDto.cusItcollType.trim().toUpperCase()
      : null;
  const flags: { tcs?: boolean; tds?: boolean } = {};
  if (hasTcsFlag || hasItcollType) {
    flags.tcs = saveCustomerDto.cusTcsApplicable === true || itcollType === 'TCS';
  }
  if (hasItcollType) {
    flags.tds = itcollType === 'TDS';
  }
  return flags;
}
type CustomerWriteClient = SalesWriteClient;
@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
    private readonly accountLedgerMastersService: AccountLedgerMastersService,
  ) {}
  async save(saveCustomerDto: SaveCustomerDto): Promise<CustomerPayload> {
    if (saveCustomerDto.cusId) {
      // A client may echo the link it created the customer with; only a different ledger is wrong.
      if (saveCustomerDto.cusLinkLedId && saveCustomerDto.cusLinkLedId !== saveCustomerDto.cusId) {
        throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Validation failed', [
          { field: 'cusLinkLedId', message: 'cusLinkLedId applies to a create only' },
        ]);
      }
      return this.updateCustomer(saveCustomerDto);
    }
    return this.createCustomer(saveCustomerDto);
  }
  async getById(cusId: string): Promise<CustomerPayload> {
    const record = await this.prisma.customer.findFirst({
      where: {
        cusId,
        cusIsDeleted: false,
      },
    });
    if (!record) {
      throwSalesNotFound<CustomerErrorDetail, CustomerErrorResponse>(
        'Customer not found',
        'cusId',
        `No active customer found with id ${cusId}`,
      );
    }
    const payload = this.toPayload(record);
    const relatedNames = await this.resolveRelatedNames(this.prisma, record);
    return { ...payload, ...relatedNames };
  }
  async softDelete(cusId: string): Promise<{ cusId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findFirst({
        where: {
          cusId,
          cusIsDeleted: false,
        },
      });
      if (!existing) {
        throwSalesNotFound<CustomerErrorDetail, CustomerErrorResponse>(
          'Customer not found',
          'cusId',
          `No active customer found with id ${cusId}`,
        );
      }
      const modifiedOn = new Date();
      const result = await tx.customer.updateMany({
        where: {
          cusId,
          cusIsDeleted: false,
        },
        data: {
          cusIsDeleted: true,
          cusIsActive: false,
          cusModifiedOn: modifiedOn,
          cusModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwSalesNotFound<CustomerErrorDetail, CustomerErrorResponse>(
          'Customer not found',
          'cusId',
          `No active customer found with id ${cusId}`,
        );
      }
      // Soft delete the linked account ledger (shares cus_id as its PK) so it can't stay active
      // while the customer is logically deleted. No-op for legacy rows with no linked ledger.
      // Notes 81: a ledger that is also a live supplier's stays, with the supplier's active flag.
      const supplierRole = await this.findSupplierRole(tx, cusId);
      await tx.accLedgerMaster.updateMany({
        where: { ledId: cusId, ledIsDeleted: false },
        data: supplierRole
          ? {
              ledIsActive: supplierRole.supIsActive,
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
        cusIsDeleted: true,
        cusIsActive: false,
        cusModifiedOn: modifiedOn,
        cusModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: CUSTOMER_TABLE_NAME,
          screenName: CUSTOMER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: cusId,
          displayName: existing.cusName || cusId,
          originalRecord,
          modifiedRecord,
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
          notes: supplierRole
            ? 'Customer soft deleted; its ledger stays with the supplier'
            : 'Customer soft deleted',
        },
        tx,
      );
      return {
        cusId,
        deleted: true,
      };
    });
  }
  private async createCustomer(saveCustomerDto: SaveCustomerDto): Promise<CustomerPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Notes 81: with cusLinkLedId the customer joins an existing party ledger instead of
        // provisioning one, so a party we buy from and sell to keeps one ledger and one balance.
        const linkLedger = saveCustomerDto.cusLinkLedId
          ? await this.loadLedgerToLink(tx, saveCustomerDto.cusLinkLedId)
          : null;
        const dto = linkLedger
          ? this.withLinkedLedgerDefaults(saveCustomerDto, linkLedger)
          : saveCustomerDto;
        // A name is required: it becomes both the customer name and the linked ledger's
        // ledName (which the account ledger master requires).
        const normalizedName = normalizeRequiredText<CustomerErrorDetail, CustomerErrorResponse>(
          dto.cusName ?? '',
          'cusName',
        );
        const normalizedStateName = normalizeRequiredText<
          CustomerErrorDetail,
          CustomerErrorResponse
        >(dto.cusStateName, 'cusStateName');
        const normalizedStateCode = this.normalizeStateCode(dto.cusStateCode);
        const now = new Date();
        const createdBy = resolveActor(dto.cusCreatedBy, this.requestContextService.getUserId());
        const data: Prisma.CustomerUncheckedCreateInput = {
          cusStateName: normalizedStateName,
          cusStateCode: normalizedStateCode,
          cusCompanyId: hasOwnProperty(dto, 'cusCompanyId') ? (dto.cusCompanyId ?? null) : null,
          cusAreaId: dto.cusAreaId,
          cusGroupId: dto.cusGroupId,
          cusPriceLevelId: dto.cusPriceLevelId,
          cusCollectionDays: hasOwnProperty(dto, 'cusCollectionDays')
            ? (dto.cusCollectionDays ?? [])
            : [],
          cusBilledDate: now,
          cusBilledCount: 1,
          cusCreatedOn: now,
          cusCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, dto);
        // Ensure the normalized, required name wins over the raw value applied above.
        data.cusName = normalizedName;
        await this.ensureCompanyExists(tx, data.cusCompanyId ?? null);
        await this.ensureAreaExists(tx, data.cusAreaId);
        await this.ensureCustomerGroupExists(tx, data.cusGroupId);
        await this.ensureStateCodeExists(tx, normalizedStateCode);
        if (linkLedger) {
          return this.createCustomerOnLedger(tx, data, linkLedger);
        }
        // Provision the linked account ledger first, then reuse its led_id as the
        // customer's cus_id so the two masters share one identity (1:1 link). The
        // area shares its id with a linked account group, so cusAreaId doubles as
        // the ledger's parent account group id (ledGroupId).
        const ledgerDto = this.buildLinkedLedgerDto(dto, {
          name: normalizedName,
          stateName: normalizedStateName,
          stateCode: normalizedStateCode,
        });
        const ledger = await this.accountLedgerMastersService.createLedgerWithinTx(ledgerDto, tx);
        data.cusId = ledger.ledId;
        // Nothing else to link. Because cus_id IS led_id, a customer id and a
        // party-ledger id are the same value, and every module that needs the
        // ledger for a customer already has it — the receipt takes ONE partyId
        // and resolves nothing. A cus_ledger_id column was added for that
        // purpose on 2026-09-15 and withdrawn the same day for this reason.
        const created = await tx.customer.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: CUSTOMER_TABLE_NAME,
            screenName: CUSTOMER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.cusId,
            displayName: payload.cusName || payload.cusId,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Customer created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<CustomerErrorDetail, CustomerErrorResponse>(
        error,
        'Customer already exists',
        [
          {
            field: 'cusName',
            message: 'Duplicate customer details are not allowed',
          },
        ],
      );
      throw error;
    }
  }
  // Notes 81 — insert only the customer row, keyed by the ledger's id. The ledger is not
  // written at all: no rename, no field sync and, above all, no move to the customer's area
  // group, because a supplier's ledger stays under Suppliers. cusAreaId is still stored, for
  // beats and area filters. Nor is the ledger's name checked for uniqueness, since the name it
  // would clash with is this very party's own.
  //
  // A customer row deleted earlier while the ledger lived on (it was a supplier's too) is
  // brought back rather than refused: cus_id is the PK, so a second row cannot exist, and
  // refusing would leave the party unable ever to be a customer again.
  private async createCustomerOnLedger(
    tx: CustomerWriteClient,
    data: Prisma.CustomerUncheckedCreateInput,
    ledger: AccLedgerMaster,
  ): Promise<CustomerPayload> {
    const cusId = ledger.ledId;
    const previous = await tx.customer.findUnique({ where: { cusId } });
    if (previous && !previous.cusIsDeleted) {
      throwSalesConflict<CustomerErrorDetail, CustomerErrorResponse>('Customer already exists', [
        { field: 'cusLinkLedId', message: `Ledger "${ledger.ledName}" is already a customer` },
      ]);
    }
    let saved: Customer;
    if (previous) {
      // The row keeps its original creation stamp and save count; this save is one more.
      const { cusCreatedOn, cusCreatedBy, cusBilledCount, ...revived } = data;
      saved = await tx.customer.update({
        where: { cusId },
        data: {
          ...revived,
          cusBilledCount: { increment: cusBilledCount ?? 1 },
          cusIsDeleted: false,
          cusIsActive: data.cusIsActive ?? true,
          cusModifiedOn: cusCreatedOn,
          cusModifiedBy: cusCreatedBy,
        },
      });
    } else {
      saved = await tx.customer.create({ data: { ...data, cusId } });
    }
    const payload = this.toPayload(saved);
    await this.auditLogService.logEntityChange(
      {
        action: previous ? 'update' : 'New',
        tableName: CUSTOMER_TABLE_NAME,
        screenName: CUSTOMER_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: cusId,
        displayName: payload.cusName || payload.cusId,
        originalRecord: previous ? this.toPayload(previous) : null,
        modifiedRecord: payload,
        userId: saved.cusModifiedBy,
        notes: previous
          ? 'Customer restored on its existing ledger'
          : 'Customer created on an existing ledger',
      },
      tx,
    );
    return payload;
  }
  // The ledger a link create joins: live, and a party's. A NULL type is accepted on a ledger
  // that already backs a live supplier — those were provisioned in June 2026 before
  // createLedgerWithinTx stamped PARTY, and the supplier row says what they are.
  private async loadLedgerToLink(tx: CustomerWriteClient, ledId: string): Promise<AccLedgerMaster> {
    const ledger = await tx.accLedgerMaster.findFirst({ where: { ledId, ledIsDeleted: false } });
    if (!ledger) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Ledger does not exist', [
        { field: 'cusLinkLedId', message: `No active account ledger found with id ${ledId}` },
      ]);
    }
    if (ledger.ledLedgerType !== 'PARTY' && !(await this.findSupplierRole(tx, ledId))) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>(
        'Ledger is not a party ledger',
        [
          {
            field: 'cusLinkLedId',
            message: `Ledger "${ledger.ledName}" is a ${ledger.ledLedgerType ?? 'untyped'} ledger; only a PARTY ledger can be a customer`,
          },
        ],
      );
    }
    return ledger;
  }
  // The supplier row sharing this ledger, if it is live. Deleted rows don't count: a ledger
  // whose supplier is gone is the customer's alone again.
  private findSupplierRole(
    tx: CustomerWriteClient,
    ledId: string,
  ): Promise<{ supIsActive: boolean } | null> {
    return tx.supplier.findFirst({
      where: { supId: ledId, supIsDeleted: false },
      select: { supIsActive: true },
    });
  }
  // A copy of the payload with every blank CUSTOMER_FIELDS_FROM_LINKED_LEDGER field filled from
  // the ledger. Blank is undefined, null or ''; the client opens the form prefilled, so a field it
  // sends empty means "not filled in", not "clear".
  private withLinkedLedgerDefaults(
    saveCustomerDto: SaveCustomerDto,
    ledger: AccLedgerMaster,
  ): SaveCustomerDto {
    const dto: Record<string, unknown> = { ...saveCustomerDto };
    const ledgerRecord = ledger as unknown as Record<string, unknown>;
    for (const [cusField, ledField] of CUSTOMER_FIELDS_FROM_LINKED_LEDGER) {
      const current = dto[cusField];
      const fallback = ledgerRecord[ledField];
      const maxLength = CUSTOMER_LINK_MAX_LENGTH[cusField];
      if (
        (current === undefined || current === null || current === '') &&
        fallback !== null &&
        fallback !== undefined &&
        !(maxLength !== undefined && typeof fallback === 'string' && fallback.length > maxLength)
      ) {
        dto[cusField] = fallback;
      }
    }
    return dto as unknown as SaveCustomerDto;
  }
  private async updateCustomer(saveCustomerDto: SaveCustomerDto): Promise<CustomerPayload> {
    const cusId = saveCustomerDto.cusId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.customer.findFirst({
          where: {
            cusId,
            cusIsDeleted: false,
          },
        });
        if (!existing) {
          throwSalesNotFound<CustomerErrorDetail, CustomerErrorResponse>(
            'Customer not found',
            'cusId',
            `No active customer found with id ${cusId}`,
          );
        }
        const normalizedStateName = normalizeRequiredText<
          CustomerErrorDetail,
          CustomerErrorResponse
        >(saveCustomerDto.cusStateName, 'cusStateName');
        const normalizedStateCode = this.normalizeStateCode(saveCustomerDto.cusStateCode);
        const nextAreaId = hasOwnProperty(saveCustomerDto, 'cusAreaId')
          ? saveCustomerDto.cusAreaId
          : existing.cusAreaId;
        const nextGroupId = hasOwnProperty(saveCustomerDto, 'cusGroupId')
          ? saveCustomerDto.cusGroupId
          : existing.cusGroupId;
        const nextCompanyId = hasOwnProperty(saveCustomerDto, 'cusCompanyId')
          ? (saveCustomerDto.cusCompanyId ?? null)
          : existing.cusCompanyId;
        const nextPriceLevelId = hasOwnProperty(saveCustomerDto, 'cusPriceLevelId')
          ? saveCustomerDto.cusPriceLevelId
          : existing.cusPriceLevelId;
        await this.ensureCompanyExists(tx, nextCompanyId);
        await this.ensureAreaExists(tx, nextAreaId);
        await this.ensureCustomerGroupExists(tx, nextGroupId);
        await this.ensureStateCodeExists(tx, normalizedStateCode);
        const now = new Date();
        const data: Prisma.CustomerUncheckedUpdateInput = {
          cusStateName: normalizedStateName,
          cusStateCode: normalizedStateCode,
          cusCompanyId: nextCompanyId,
          cusAreaId: nextAreaId,
          cusGroupId: nextGroupId,
          cusPriceLevelId: nextPriceLevelId,
          cusBilledDate: now,
          cusBilledCount: {
            increment: 1,
          },
          cusModifiedOn: now,
          cusModifiedBy: resolveActor(
            saveCustomerDto.cusModifiedBy,
            this.requestContextService.getUserId(),
          ),
        };
        this.applyOptionalFields(data, saveCustomerDto);
        const updated = await tx.customer.update({
          where: {
            cusId,
          },
          data,
        });
        // Keep the linked account ledger (shares cus_id as its PK) in sync with the edited
        // customer fields, mirroring how createCustomer provisions it. Same transaction =>
        // atomic. Guarded so legacy customers with no linked ledger stay a no-op.
        const linkedLedger = await tx.accLedgerMaster.findFirst({
          where: { ledId: cusId, ledIsDeleted: false },
          select: { ledId: true, ledName: true, ledGroupId: true },
        });
        if (linkedLedger) {
          const ledgerDto = this.buildLinkedLedgerDto(saveCustomerDto, {
            // ledName is required but cusName is nullable; fall back to the ledger's own current
            // name when the customer name is empty so the sync can't 400 or blank the ledger.
            name: updated.cusName || linkedLedger.ledName,
            stateName: normalizedStateName,
            stateCode: normalizedStateCode,
          });
          ledgerDto.ledId = cusId;
          // Notes 81: a ledger that is also a live supplier's is one party with one group, which
          // only the ledger master moves; an area change re-files the customer's beat, not the
          // ledger. Nor may deactivating the customer switch off the supplier's ledger.
          const supplierRole = await this.findSupplierRole(tx, cusId);
          ledgerDto.ledGroupId = supplierRole ? linkedLedger.ledGroupId : nextAreaId;
          if (supplierRole) {
            ledgerDto.ledIsActive = updated.cusIsActive || supplierRole.supIsActive;
          }
          try {
            await this.accountLedgerMastersService.updateLedgerWithinTx(ledgerDto, tx);
          } catch (error: unknown) {
            // The linked-ledger write enforces company-scoped name uniqueness. Surface a
            // collision in the customer's own vocabulary instead of leaking the ledName field.
            if (error instanceof ConflictException) {
              throwSalesConflict<CustomerErrorDetail, CustomerErrorResponse>(
                'Customer name already exists for this company',
                [
                  {
                    field: 'cusName',
                    message: 'Duplicate customer name is not allowed for this company',
                  },
                ],
              );
            }
            throw error;
          }
        }
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: CUSTOMER_TABLE_NAME,
            screenName: CUSTOMER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: cusId,
            displayName: payload.cusName || payload.cusId,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.cusModifiedBy,
            notes: 'Customer updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<CustomerErrorDetail, CustomerErrorResponse>(
        error,
        'Customer already exists',
        [
          {
            field: 'cusName',
            message: 'Duplicate customer details are not allowed',
          },
        ],
      );
      throw error;
    }
  }
  private async resolveRelatedNames(
    client: CustomerWriteClient,
    record: Pick<
      Customer,
      'cusCompanyId' | 'cusBranchId' | 'cusAreaId' | 'cusGroupId' | 'cusPriceLevelId'
    >,
  ): Promise<{
    cusCompanyName: string | null;
    cusBranchName: string | null;
    cusAreaName: string | null;
    cusGroupName: string | null;
    cusPriceLevelName: string | null;
  }> {
    const [company, branch, area, group, priceLevel] = await Promise.all([
      record.cusCompanyId
        ? client.company.findFirst({
            where: { compId: record.cusCompanyId },
            select: { compName: true },
          })
        : null,
      record.cusBranchId
        ? client.branchMaster.findFirst({
            where: { brId: record.cusBranchId },
            select: { brName: true },
          })
        : null,
      record.cusAreaId
        ? client.areaMaster.findFirst({
            where: { armId: record.cusAreaId },
            select: { armName: true },
          })
        : null,
      record.cusGroupId
        ? client.custGroup.findFirst({
            where: { cgrId: record.cusGroupId },
            select: { cgrName: true },
          })
        : null,
      record.cusPriceLevelId
        ? client.itemPriceLevel.findFirst({
            where: { iplId: record.cusPriceLevelId },
            select: { iplName: true },
          })
        : null,
    ]);
    return {
      cusCompanyName: company?.compName ?? null,
      cusBranchName: branch?.brName ?? null,
      cusAreaName: area?.armName ?? null,
      cusGroupName: group?.cgrName ?? null,
      cusPriceLevelName: priceLevel?.iplName ?? null,
    };
  }
  private async ensureAreaExists(tx: CustomerWriteClient, areaId: string): Promise<void> {
    const area = await tx.areaMaster.findFirst({
      where: {
        armId: areaId,
        armIsDeleted: false,
      },
      select: {
        armId: true,
      },
    });
    if (!area) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Area does not exist', [
        {
          field: 'cusAreaId',
          message: `No active area found with id ${areaId}`,
        },
      ]);
    }
  }
  private async ensureCompanyExists(
    tx: CustomerWriteClient,
    companyId: string | null,
  ): Promise<void> {
    if (companyId === null) {
      return;
    }
    const company = await tx.company.findFirst({
      where: {
        compId: companyId,
        compIsDeleted: false,
      },
      select: {
        compId: true,
      },
    });
    if (!company) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Company does not exist', [
        {
          field: 'cusCompanyId',
          message: `No active company found with id ${companyId}`,
        },
      ]);
    }
  }
  private async ensureCustomerGroupExists(tx: CustomerWriteClient, groupId: string): Promise<void> {
    const group = await tx.custGroup.findFirst({
      where: {
        cgrId: groupId,
        cgrIsDeleted: false,
      },
      select: {
        cgrId: true,
      },
    });
    if (!group) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>(
        'Customer group does not exist',
        [
          {
            field: 'cusGroupId',
            message: `No active customer group found with id ${groupId}`,
          },
        ],
      );
    }
  }
  // sales.customers.cus_state_code carries no foreign key to fixed.state_codes,
  // so nothing but this stops a customer being saved with a code that is not a
  // GST state code ('TN' for Tamil Nadu instead of '33'). The transactions that
  // snapshot the customer's state onto their place of supply — sale_bill's
  // sb_pos_stcd and its siblings — DO have that key, so a customer saved with a
  // bad code cannot be billed at all. It is refused at the master instead, where
  // there is a field to name and a state list to pick from.
  private async ensureStateCodeExists(tx: CustomerWriteClient, stateCode: string): Promise<void> {
    const state = await tx.stateCode.findFirst({
      where: {
        stateCode,
        isDeleted: false,
      },
      select: {
        stateCode: true,
      },
    });
    if (!state) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('State does not exist', [
        {
          field: 'cusStateCode',
          message: `No active state found with code ${stateCode}`,
        },
      ]);
    }
  }
  // Map the customer payload onto a ledger DTO for the linked account ledger.
  // ledGroupId comes from cusAreaId (the area shares its id with a linked account
  // group); the remaining required fields come from the customer's already-normalized
  // values, and the shared fields are copied only when present on the customer payload.
  private buildLinkedLedgerDto(
    saveCustomerDto: SaveCustomerDto,
    normalized: { name: string; stateName: string; stateCode: string },
  ): SaveAccountLedgerMasterDto {
    const ledgerDto: SaveAccountLedgerMasterDto = {
      ledGroupId: saveCustomerDto.cusAreaId,
      ledName: normalized.name,
      ledStateName: normalized.stateName,
      ledStateCode: normalized.stateCode,
      // Customers are always settled bill-wise, so the linked ledger is
      // provisioned (and kept) with bill-by-bill on; the column defaults to false.
      ledIsBillByBill: true,
    };
    const ledgerDtoRecord = ledgerDto as unknown as Record<string, unknown>;
    const customerRecord = saveCustomerDto as unknown as Record<string, unknown>;
    for (const [cusField, ledField] of CUSTOMER_TO_LEDGER_FIELD_MAP) {
      if (hasOwnProperty(saveCustomerDto, cusField)) {
        ledgerDtoRecord[ledField] = customerRecord[cusField];
      }
    }
    // The statutory fields the map can't carry one-to-one: the customer stores
    // free text, the ledger stores a CHECK-backed vocabulary or a pair of flags.
    if (hasOwnProperty(saveCustomerDto, 'cusGstType')) {
      ledgerDto.ledGstPartyRegType = toLedgerGstPartyRegType(saveCustomerDto.cusGstType);
    }
    const itCollectionFlags = toLedgerItCollectionFlags(saveCustomerDto);
    if (itCollectionFlags.tcs !== undefined) {
      ledgerDto.ledIsTcsApplicable = itCollectionFlags.tcs;
    }
    if (itCollectionFlags.tds !== undefined) {
      ledgerDto.ledIsTdsApplicable = itCollectionFlags.tds;
    }
    return ledgerDto;
  }
  private applyOptionalFields(
    data: Prisma.CustomerUncheckedCreateInput | Prisma.CustomerUncheckedUpdateInput,
    saveCustomerDto: SaveCustomerDto,
  ): void {
    applyPresentFields(data, saveCustomerDto, CUSTOMER_OPTIONAL_FIELDS, {
      cusBirthDate: (value) =>
        this.toDateOrNull(value as string | null | undefined, 'cusBirthDate'),
      cusMarriageDate: (value) =>
        this.toDateOrNull(value as string | null | undefined, 'cusMarriageDate'),
      cusCollectionDays: (value) => value ?? [],
    });
  }
  private normalizeStateCode(value: string | null | undefined): string {
    const normalized = (value ?? '').trim().toUpperCase();
    if (normalized.length !== 2) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Validation failed', [
        {
          field: 'cusStateCode',
          message: 'cusStateCode must be exactly 2 characters',
        },
      ]);
    }
    return normalized;
  }
  private toDateOrNull(value: string | null | undefined, field: string): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Validation failed', [
        {
          field,
          message: `${field} must be a valid ISO date`,
        },
      ]);
    }
    return dateValue;
  }
  private toPayload(record: Customer): CustomerPayload {
    return {
      cusId: record.cusId,
      cusTitle: record.cusTitle,
      cusShort: record.cusShort,
      cusCode: record.cusCode,
      cusName: record.cusName,
      cusAddr1: record.cusAddr1,
      cusAddr2: record.cusAddr2,
      cusAddr3: record.cusAddr3,
      cusCity: record.cusCity,
      cusDistrict: record.cusDistrict,
      cusStateName: record.cusStateName,
      cusCountry: record.cusCountry,
      cusStateCode: record.cusStateCode,
      cusLandmark: record.cusLandmark,
      cusPin: record.cusPin,
      cusTel: record.cusTel,
      cusPhone1: record.cusPhone1,
      cusPhone2: record.cusPhone2,
      cusWhatsappNo: record.cusWhatsappNo,
      cusEmail: record.cusEmail,
      cusAadharNo: record.cusAadharNo,
      cusContactPerson: record.cusContactPerson,
      cusDistanceKm: record.cusDistanceKm,
      cusCreditAllowed: record.cusCreditAllowed,
      cusCreditBillLimit: record.cusCreditBillLimit,
      cusCreditAmtLimit: toNumber(record.cusCreditAmtLimit),
      cusCreditDays: record.cusCreditDays,
      cusDebitBalance: toNumber(record.cusDebitBalance),
      cusDiscPerc: toNumber(record.cusDiscPerc),
      cusDebitGraceDays: record.cusDebitGraceDays,
      cusEnableSms: record.cusEnableSms,
      cusOverdueSms: record.cusOverdueSms,
      cusOverdueBilling: record.cusOverdueBilling,
      cusAllowPromotion: record.cusAllowPromotion,
      cusAllowLoyalty: record.cusAllowLoyalty,
      cusAllowDiscount: record.cusAllowDiscount,
      cusSortOrder: record.cusSortOrder,
      cusRegionName: record.cusRegionName,
      cusRegionAddr1: record.cusRegionAddr1,
      cusRegionAddr2: record.cusRegionAddr2,
      cusRegionAddr3: record.cusRegionAddr3,
      cusRegionCity: record.cusRegionCity,
      cusRegionDistrict: record.cusRegionDistrict,
      cusRegionStateName: record.cusRegionStateName,
      cusRegionCountry: record.cusRegionCountry,
      cusBirthDate: record.cusBirthDate ? record.cusBirthDate.toISOString() : null,
      cusMarriageDate: record.cusMarriageDate ? record.cusMarriageDate.toISOString() : null,
      cusTransportName: record.cusTransportName,
      cusFreightCharge: record.cusFreightCharge,
      cusLoadingCharge: record.cusLoadingCharge,
      cusUnloadingCharge: record.cusUnloadingCharge,
      cusGstNo: record.cusGstNo,
      cusPanNo: record.cusPanNo,
      cusGstType: record.cusGstType,
      cusEcommerceGstin: record.cusEcommerceGstin,
      cusTcsApplicable: record.cusTcsApplicable,
      cusItcollExempted: record.cusItcollExempted,
      cusItcollType: record.cusItcollType,
      cusGeoLocation: record.cusGeoLocation,
      cusCollectionDays: record.cusCollectionDays,
      cusDefaultSalesman: record.cusDefaultSalesman,
      cusPriceLevelId: record.cusPriceLevelId,
      cusBilledDate: record.cusBilledDate ? record.cusBilledDate.toISOString() : null,
      cusBilledCount: record.cusBilledCount,
      cusNotes: record.cusNotes,
      cusCompanyId: record.cusCompanyId,
      cusBranchId: record.cusBranchId,
      cusAreaId: record.cusAreaId,
      cusGroupId: record.cusGroupId,
      cusIsActive: record.cusIsActive,
      cusIsDeleted: record.cusIsDeleted,
      cusSyncDate: record.cusSyncDate ? record.cusSyncDate.toISOString() : null,
      cusCreatedOn: record.cusCreatedOn.toISOString(),
      cusCreatedBy: record.cusCreatedBy,
      cusModifiedOn: record.cusModifiedOn.toISOString(),
      cusModifiedBy: record.cusModifiedBy,
    };
  }
}
