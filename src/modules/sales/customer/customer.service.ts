import { ConflictException, Injectable } from '@nestjs/common';
import { AccLedgerMaster, Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AccountLedgerMastersService } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { SaveAccountLedgerMasterDto } from '../../accountsModule/accountLedgerMasters/dto/save-account-ledger-master.dto';
import { AccountLedgerErrorCode } from '../../accountsModule/accountLedgerMasters/types/account-ledger-master-error-codes';
import { SaveCustomerDto } from './dto/save-customer.dto';
import { assertMenuRight } from '../../../common/posting/rights';
import { PartyBalanceService, withFigures } from '../../../common/party/party-balance.service';
import type { PartyDeleteCheck } from '../../../common/party/party-balance.service';
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
import { lastBilledOf } from '../../../common/party/party-billed';
import {
  CustomerErrorDetail,
  CustomerErrorResponse,
  CustomerPayload,
  CustomerSavePayload,
} from './types/customer-api.types';
import { CustomerErrorCode } from './types/customer-error-codes';
import {
  DEFAULT_ACTOR,
  SalesWriteClient,
  applyPresentFields,
  isPresentField,
  isUniqueConstraintError,
  violatedConstraintOf,
  normalizeRequiredText,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSalesBadRequest,
  throwSalesConflict,
  throwConflict,
  throwSalesNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const CUSTOMER_TABLE_NAME = 'customers';
const CUSTOMER_AUDIT_SCREEN_NAME = 'Customer Master';
// fixed.menu_master 10 = Customers: delete and delete-check need its `delete` right (D1-6).
const CUSTOMER_MENU_ID = 10;
// NOT NULL DEFAULT 0 columns (checked in the catalog): an explicit null is "cleared" and
// stores the default instead of failing the write with a 500 (F3).
const CUSTOMER_ZERO_WHEN_CLEARED_FIELDS = [
  'cusCreditBillLimit',
  'cusCreditAmtLimit',
  'cusCreditDays',
  'cusDebitBalance',
  'cusDiscPerc',
  'cusDebitGraceDays',
  'cusSortOrder',
] as const;
const zeroWhenCleared = (value: unknown): unknown => (value === null ? 0 : value);
// The linked ledger's company-wide name check (LEDGER_NAME_TAKEN on ledName), said in the
// customer's own words: CUSTOMER_NAME_EXISTS on cusName. Anything else is passed on.
function rethrowLedgerNameClash(error: unknown): void {
  if (!(error instanceof ConflictException)) {
    return;
  }
  const body = error.getResponse() as { errors?: Array<{ code?: string }> } | string;
  const errors = typeof body === 'object' && Array.isArray(body.errors) ? body.errors : [];
  if (!errors.some((detail) => detail.code === AccountLedgerErrorCode.NAME_TAKEN)) {
    return;
  }
  throwSalesConflict<CustomerErrorDetail, CustomerErrorResponse>(
    'Customer name already exists for this company',
    [CUSTOMER_NAME_EXISTS_DETAIL],
  );
}
// R4 — the ledger-name unique indexes (uq_led_name_company / uq_led_name_shared, on
// lower(led_name)). Two saves of one new name can both pass the ledger's pre-check; the
// loser's P2002 / P2010-23505 names the ledger name, and is the same clash the pre-check
// reports as CUSTOMER_NAME_EXISTS.
function isLedgerNameUniqueViolation(error: unknown): boolean {
  if (!isUniqueConstraintError(error)) {
    return false;
  }
  // A raw 23505's "Key (led_company_id, lower((led_name)::text))=…" has nested brackets
  // that violatedConstraintOf cannot parse, so its message is read as well.
  const rawMessage = (error as { meta?: { message?: unknown } }).meta?.message;
  const target = [violatedConstraintOf(error), typeof rawMessage === 'string' ? rawMessage : '']
    .filter(Boolean)
    .join(' ');
  return /uq_led_name|led_name/i.test(target);
}
const CUSTOMER_NAME_EXISTS_DETAIL: CustomerErrorDetail = {
  field: 'cusName',
  message: 'Duplicate customer name is not allowed for this company',
  code: CustomerErrorCode.NAME_EXISTS,
};
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
// Party master rules D4: the party details (address, phones, GSTIN, company …) go to the
// ledger and the supplier through the ONE map in common/party/party-detail.map.ts. What is
// left here is the customer's own ledger keys. cusNotes → ledRemarks only while the ledger
// is the customer's alone: on a shared ledger notes are per role (plan §3.4).
const CUSTOMER_TO_LEDGER_FIELD_MAP: ReadonlyArray<
  [keyof SaveCustomerDto, keyof SaveAccountLedgerMasterDto]
> = [
  ['cusNotes', 'ledRemarks'],
  ['cusEnableSms', 'ledAllowSms'],
  ['cusSortOrder', 'ledSortOrder'],
  ['cusIsActive', 'ledIsActive'],
];
// Notes 81 — on a create with cusLinkLedId the customer row starts from the ledger it joins:
// each of these fields the payload leaves blank takes the ledger's value: the party details
// of the shared map, plus the three columns a customer needs.
const CUSTOMER_FIELDS_FROM_LINKED_LEDGER: ReadonlyArray<[keyof SaveCustomerDto, string]> = [
  ['cusName', 'ledName'],
  ['cusStateName', 'ledStateName'],
  ['cusStateCode', 'ledStateCode'],
  ...PARTY_DETAIL_FIELDS.filter((field) => field.cus !== null).map(
    (field) => [field.cus as keyof SaveCustomerDto, field.led] as [keyof SaveCustomerDto, string],
  ),
];
// Customer columns narrower than the ledger's. A ledger value that would not fit is left out
// rather than cut short, so the save cannot fail on a column width.
const CUSTOMER_LINK_MAX_LENGTH: Partial<Record<keyof SaveCustomerDto, number>> = {
  cusEmail: 120,
  cusAadharNo: 12,
  cusRegionName: 200,
};
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
  const hasTcsFlag = isPresentField(saveCustomerDto, 'cusTcsApplicable');
  const hasItcollType = isPresentField(saveCustomerDto, 'cusItcollType');
  const hasItcollExempted = isPresentField(saveCustomerDto, 'cusItcollExempted');
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
    private readonly partyBalanceService: PartyBalanceService,
    private readonly partySyncService: PartySyncService,
  ) {}
  async save(saveCustomerDto: SaveCustomerDto): Promise<CustomerSavePayload> {
    if (saveCustomerDto.cusId) {
      // A client may echo the link it created the customer with; only a different ledger is wrong.
      if (saveCustomerDto.cusLinkLedId && saveCustomerDto.cusLinkLedId !== saveCustomerDto.cusId) {
        throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Validation failed', [
          {
            field: 'cusLinkLedId',
            message: 'cusLinkLedId applies to a create only',
            code: CustomerErrorCode.LINK_LEDGER_ON_UPDATE,
          },
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
        CustomerErrorCode.NOT_FOUND,
      );
    }
    const payload = await this.withLastBilled(this.prisma, this.toPayload(record));
    const relatedNames = await this.resolveRelatedNames(this.prisma, record);
    return { ...payload, ...relatedNames };
  }
  // D3 (Q9 = B): cusBilledDate / cusBilledCount are the customer's POSTED sale bills, read
  // now; the stored columns are no longer written or read.
  private async withLastBilled(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
    payload: CustomerPayload,
  ): Promise<CustomerPayload> {
    const billed = await lastBilledOf(client, payload.cusId);
    return {
      ...payload,
      cusBilledDate: billed.date ? billed.date.toISOString() : null,
      cusBilledCount: billed.count,
    };
  }
  // D1-4: what DELETE would answer, as a 200 (a question, not an action).
  async deleteCheck(cusId: string): Promise<PartyDeleteCheck> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertDeleteRight(tx);
      await this.loadLiveCustomer(tx, cusId);
      return this.partyBalanceService.deleteCheck(tx, {
        partyId: cusId,
        role: 'CUSTOMER',
        otherRoleLive: (await this.findSupplierRole(tx, cusId)) !== null,
        codes: {
          hasBalance: CustomerErrorCode.HAS_BALANCE,
          hasChequeInHand: CustomerErrorCode.HAS_CHEQUE_IN_HAND,
        },
      });
    });
  }
  private assertDeleteRight(tx: Prisma.TransactionClient): Promise<unknown> {
    return assertMenuRight(tx, {
      userId: this.requestContextService.getUserId() ?? null,
      menuId: CUSTOMER_MENU_ID,
      right: 'delete',
      codePrefix: 'CUSTOMER',
      action: 'delete customers',
    });
  }
  private async loadLiveCustomer(tx: CustomerWriteClient, cusId: string): Promise<Customer> {
    const existing = await tx.customer.findFirst({ where: { cusId, cusIsDeleted: false } });
    if (!existing) {
      throwSalesNotFound<CustomerErrorDetail, CustomerErrorResponse>(
        'Customer not found',
        'cusId',
        `No active customer found with id ${cusId}`,
        CustomerErrorCode.NOT_FOUND,
      );
    }
    return existing;
  }
  async softDelete(cusId: string): Promise<{ cusId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      // D1 (plan §3.1 delete flow): the menu-10 delete right; the ledger row locked so no
      // bill posts in between; then — only when the ledger goes with this role — the
      // lifetime balance in every company and the cheques in hand.
      await this.assertDeleteRight(tx);
      const existing = await this.loadLiveCustomer(tx, cusId);
      const ledger = await this.partyBalanceService.lockLedger(tx, cusId);
      const otherRoleLive = (await this.findSupplierRole(tx, cusId)) !== null;
      if (ledger && !ledger.ledIsDeleted && !otherRoleLive) {
        const check = await this.partyBalanceService.deleteCheck(tx, {
          partyId: cusId,
          role: 'CUSTOMER',
          otherRoleLive,
          codes: {
            hasBalance: CustomerErrorCode.HAS_BALANCE,
            hasChequeInHand: CustomerErrorCode.HAS_CHEQUE_IN_HAND,
          },
        });
        if (!check.canDelete) {
          throwConflict('Customer cannot be deleted', check.refusals);
        }
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
          CustomerErrorCode.NOT_FOUND,
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
  private async createCustomer(saveCustomerDto: SaveCustomerDto): Promise<CustomerSavePayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Notes 81: with cusLinkLedId the customer joins an existing party ledger instead of
        // provisioning one, so a party we buy from and sell to keeps one ledger and one balance.
        const linkLedger = saveCustomerDto.cusLinkLedId
          ? await this.loadLedgerToLink(tx, saveCustomerDto.cusLinkLedId)
          : null;
        const dto = linkLedger
          ? await this.withLinkedLedgerDefaults(tx, saveCustomerDto, linkLedger)
          : saveCustomerDto;
        // A name is required: it becomes both the customer name and the linked ledger's
        // ledName (which the account ledger master requires).
        const normalizedName = normalizeRequiredText<CustomerErrorDetail, CustomerErrorResponse>(
          dto.cusName ?? '',
          'cusName',
          undefined,
          CustomerErrorCode.NAME_REQUIRED,
        );
        const normalizedStateName = normalizeRequiredText<
          CustomerErrorDetail,
          CustomerErrorResponse
        >(dto.cusStateName, 'cusStateName', undefined, CustomerErrorCode.STATE_NAME_REQUIRED);
        const normalizedStateCode = this.normalizeStateCode(dto.cusStateCode);
        const now = new Date();
        // F6: the stamp is the logged-in user's; a body cusCreatedBy is ignored.
        const createdBy = resolveActor(null, this.requestContextService.getUserId());
        const data: Prisma.CustomerUncheckedCreateInput = {
          cusStateName: normalizedStateName,
          cusStateCode: normalizedStateCode,
          cusCompanyId: isPresentField(dto, 'cusCompanyId') ? (dto.cusCompanyId ?? null) : null,
          cusAreaId: dto.cusAreaId,
          cusGroupId: dto.cusGroupId,
          cusPriceLevelId: dto.cusPriceLevelId,
          cusCollectionDays: isPresentField(dto, 'cusCollectionDays')
            ? (dto.cusCollectionDays ?? [])
            : [],
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
        await this.ensurePriceLevelExists(tx, data.cusPriceLevelId);
        await this.ensureBranchExists(tx, saveCustomerDto.cusBranchId);
        // D2: one of the five codes, with the GSTIN and state rules (F10's state check too).
        const gstType = this.resolveGstType(dto.cusGstType, dto.cusGstNo, normalizedStateCode);
        data.cusGstType = gstType;
        if (linkLedger) {
          const linked = await this.createCustomerOnLedger(tx, data, linkLedger);
          const supplierLive = (await this.findSupplierRole(tx, linkLedger.ledId)) !== null;
          return {
            ...(await this.withLastBilled(tx, linked)),
            partySync: { otherRole: supplierLive ? 'SUPPLIER' : null, otherRoleUpdated: false, fields: [] },
          };
        }
        // Provision the linked account ledger first, then reuse its led_id as the
        // customer's cus_id so the two masters share one identity (1:1 link). The
        // area shares its id with a linked account group, so cusAreaId doubles as
        // the ledger's parent account group id (ledGroupId).
        const ledgerDto = this.buildLinkedLedgerDto(
          dto,
          { name: normalizedName, stateName: normalizedStateName, stateCode: normalizedStateCode },
          { gstType, shared: false },
        );
        let ledger: Awaited<ReturnType<AccountLedgerMastersService['createLedgerWithinTx']>>;
        try {
          ledger = await this.accountLedgerMastersService.createLedgerWithinTx(ledgerDto, tx);
        } catch (error: unknown) {
          // F8: the same customer-worded clash an update gives.
          rethrowLedgerNameClash(error);
          throw error;
        }
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
        return { ...payload, partySync: { ...NO_PARTY_SYNC, fields: [] } };
      });
    } catch (error: unknown) {
      if (isLedgerNameUniqueViolation(error)) {
        throwSalesConflict<CustomerErrorDetail, CustomerErrorResponse>(
          'Customer name already exists for this company',
          [CUSTOMER_NAME_EXISTS_DETAIL],
        );
      }
      throwOnUniqueConstraintError<CustomerErrorDetail, CustomerErrorResponse>(
        error,
        'Customer already exists',
        [
          {
            field: 'cusName',
            message: 'Duplicate customer details are not allowed',
            code: CustomerErrorCode.DUPLICATE,
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
        {
          field: 'cusLinkLedId',
          message: `Ledger "${ledger.ledName}" is already a customer`,
          code: CustomerErrorCode.LINK_LEDGER_ALREADY_CUSTOMER,
        },
      ]);
    }
    let saved: Customer;
    if (previous) {
      // The row keeps its original creation stamp. D3: no billed column is touched.
      const { cusCreatedOn, cusCreatedBy, ...revived } = data;
      saved = await tx.customer.update({
        where: { cusId },
        data: {
          ...revived,
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
        {
          field: 'cusLinkLedId',
          message: `No active account ledger found with id ${ledId}`,
          code: CustomerErrorCode.LINK_LEDGER_NOT_FOUND,
        },
      ]);
    }
    if (ledger.ledLedgerType !== 'PARTY' && !(await this.findSupplierRole(tx, ledId))) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>(
        'Ledger is not a party ledger',
        [
          {
            field: 'cusLinkLedId',
            message: `Ledger "${ledger.ledName}" is a ${ledger.ledLedgerType ?? 'untyped'} ledger; only a PARTY ledger can be a customer`,
            code: CustomerErrorCode.LINK_LEDGER_NOT_PARTY,
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
  private async withLinkedLedgerDefaults(
    tx: CustomerWriteClient,
    saveCustomerDto: SaveCustomerDto,
    ledger: AccLedgerMaster,
  ): Promise<SaveCustomerDto> {
    const dto: Record<string, unknown> = { ...saveCustomerDto };
    // D2: a blank GST type takes the supplier's (the ledger keeps only three words).
    if (dto.cusGstType === undefined || dto.cusGstType === null || dto.cusGstType === '') {
      const supplier = await tx.supplier.findFirst({
        where: { supId: ledger.ledId, supIsDeleted: false },
        select: { supGstType: true },
      });
      if (supplier?.supGstType) {
        dto.cusGstType = supplier.supGstType;
      }
    }
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
  private async updateCustomer(saveCustomerDto: SaveCustomerDto): Promise<CustomerSavePayload> {
    const cusId = saveCustomerDto.cusId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        // D4: the ledger row first, so a customer save and a supplier save of one party
        // (or a delete) run one after the other.
        const lockedLedger = await this.partyBalanceService.lockLedger(tx, cusId);
        const existing = await this.loadLiveCustomer(tx, cusId);
        const normalizedStateName = normalizeRequiredText<
          CustomerErrorDetail,
          CustomerErrorResponse
        >(
          saveCustomerDto.cusStateName,
          'cusStateName',
          undefined,
          CustomerErrorCode.STATE_NAME_REQUIRED,
        );
        const normalizedStateCode = this.normalizeStateCode(saveCustomerDto.cusStateCode);
        // F5: a name that is sent must not be blank, as on a create ('' arrives as null).
        // Left out, the stored name stays.
        const normalizedName =
          saveCustomerDto.cusName !== undefined
            ? normalizeRequiredText<CustomerErrorDetail, CustomerErrorResponse>(
                saveCustomerDto.cusName ?? '',
                'cusName',
                undefined,
                CustomerErrorCode.NAME_REQUIRED,
              )
            : undefined;
        const nextAreaId = isPresentField(saveCustomerDto, 'cusAreaId')
          ? saveCustomerDto.cusAreaId
          : existing.cusAreaId;
        const nextGroupId = isPresentField(saveCustomerDto, 'cusGroupId')
          ? saveCustomerDto.cusGroupId
          : existing.cusGroupId;
        const companySent = isPresentField(saveCustomerDto, 'cusCompanyId');
        const nextCompanyId = companySent
          ? (saveCustomerDto.cusCompanyId ?? null)
          : existing.cusCompanyId;
        const nextPriceLevelId = isPresentField(saveCustomerDto, 'cusPriceLevelId')
          ? saveCustomerDto.cusPriceLevelId
          : existing.cusPriceLevelId;
        await this.ensureCompanyExists(tx, nextCompanyId);
        await this.ensureAreaExists(tx, nextAreaId);
        await this.ensureCustomerGroupExists(tx, nextGroupId);
        await this.ensureStateCodeExists(tx, normalizedStateCode);
        await this.ensurePriceLevelExists(tx, nextPriceLevelId);
        await this.ensureBranchExists(tx, saveCustomerDto.cusBranchId);
        // D2 on the values the row will hold: a left-out type or GSTIN keeps the stored one,
        // so an old contradictory row is caught at its next save (Q5).
        const gstType = this.resolveGstType(
          isPresentField(saveCustomerDto, 'cusGstType')
            ? saveCustomerDto.cusGstType
            : existing.cusGstType,
          isPresentField(saveCustomerDto, 'cusGstNo') ? saveCustomerDto.cusGstNo : existing.cusGstNo,
          normalizedStateCode,
        );
        const linkedLedger =
          lockedLedger && !lockedLedger.ledIsDeleted
            ? await tx.accLedgerMaster.findFirst({
                where: { ledId: cusId, ledIsDeleted: false },
                select: { ledId: true, ledName: true, ledGroupId: true, ledCompanyId: true },
              })
            : null;
        // Q7 = a: once the party has books in its company, the company stays.
        if (linkedLedger && companySent && nextCompanyId !== linkedLedger.ledCompanyId) {
          await this.ensureCompanyChangeAllowed(tx, cusId, linkedLedger.ledCompanyId, nextCompanyId);
        }
        const supplierRole = await this.findSupplierRole(tx, cusId);
        const now = new Date();
        // F6: the stamp and the audit row name the logged-in user; a body cusModifiedBy is ignored.
        const modifiedBy = resolveActor(null, this.requestContextService.getUserId());
        // D3: no billed column is written by a master save.
        const data: Prisma.CustomerUncheckedUpdateInput = {
          cusStateName: normalizedStateName,
          cusStateCode: normalizedStateCode,
          cusCompanyId: nextCompanyId,
          cusAreaId: nextAreaId,
          cusGroupId: nextGroupId,
          cusPriceLevelId: nextPriceLevelId,
          cusModifiedOn: now,
          cusModifiedBy: modifiedBy,
        };
        this.applyOptionalFields(data, saveCustomerDto);
        data.cusGstType = gstType;
        if (normalizedName !== undefined) {
          data.cusName = normalizedName;
        }
        const updated = await tx.customer.update({
          where: {
            cusId,
          },
          data,
        });
        // Keep the linked account ledger (shares cus_id as its PK) in sync with the edited
        // customer fields, mirroring how createCustomer provisions it. Same transaction =>
        // atomic. Guarded so legacy customers with no linked ledger stay a no-op.
        if (linkedLedger) {
          const ledgerDto = this.buildLinkedLedgerDto(
            saveCustomerDto,
            {
              // ledName is required but cusName is nullable; fall back to the ledger's own current
              // name when the customer name is empty so the sync can't 400 or blank the ledger.
              name: updated.cusName || linkedLedger.ledName,
              stateName: normalizedStateName,
              stateCode: normalizedStateCode,
            },
            { gstType, shared: supplierRole !== null },
          );
          ledgerDto.ledId = cusId;
          // Notes 81: a ledger that is also a live supplier's is one party with one group, which
          // only the ledger master moves; an area change re-files the customer's beat, not the
          // ledger. Nor may deactivating the customer switch off the supplier's ledger.
          ledgerDto.ledGroupId = supplierRole ? linkedLedger.ledGroupId : nextAreaId;
          if (supplierRole) {
            ledgerDto.ledIsActive = updated.cusIsActive || supplierRole.supIsActive;
          }
          try {
            await this.accountLedgerMastersService.updateLedgerWithinTx(ledgerDto, tx);
          } catch (error: unknown) {
            // The linked-ledger write enforces company-scoped name uniqueness. Surface a
            // collision in the customer's own vocabulary instead of leaking the ledName field.
            rethrowLedgerNameClash(error);
            throw error;
          }
        }
        // D4: the same party details onto the supplier of this ledger (audited there).
        const partySync: PartySyncResult = supplierRole
          ? await this.partySyncService.syncOtherRole(tx, {
              role: 'CUSTOMER',
              partyId: cusId,
              details: this.partySyncService.detailsOf('CUSTOMER', saveCustomerDto, {
                ...(normalizedName !== undefined ? { ledName: normalizedName } : {}),
                ledStateName: normalizedStateName,
                ledStateCode: normalizedStateCode,
                ...(companySent ? { ledCompanyId: nextCompanyId } : {}),
              }),
              gstType,
              actor: modifiedBy,
              assertOtherNameFree: (name, companyId) =>
                this.ensureSupplierNameFree(tx, name, companyId, cusId),
            })
          : { ...NO_PARTY_SYNC, fields: [] };
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
            userId: modifiedBy,
            notes: 'Customer updated',
          },
          tx,
        );
        return { ...(await this.withLastBilled(tx, payload)), partySync };
      });
    } catch (error: unknown) {
      if (isLedgerNameUniqueViolation(error)) {
        throwSalesConflict<CustomerErrorDetail, CustomerErrorResponse>(
          'Customer name already exists for this company',
          [CUSTOMER_NAME_EXISTS_DETAIL],
        );
      }
      throwOnUniqueConstraintError<CustomerErrorDetail, CustomerErrorResponse>(
        error,
        'Customer already exists',
        [
          {
            field: 'cusName',
            message: 'Duplicate customer details are not allowed',
            code: CustomerErrorCode.DUPLICATE,
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
          code: CustomerErrorCode.AREA_NOT_FOUND,
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
          code: CustomerErrorCode.COMPANY_NOT_FOUND,
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
            code: CustomerErrorCode.GROUP_NOT_FOUND,
          },
        ],
      );
    }
  }
  // cus_price_level_id is NOT NULL with a foreign key to inventory.item_price_levels: an
  // unknown id (React sends a blank as 0) would 500 on the key, and a deleted level would
  // be stored. Both are refused here, where there is a field to name (F4).
  private async ensurePriceLevelExists(
    tx: CustomerWriteClient,
    priceLevelId: number,
  ): Promise<void> {
    const level = await tx.itemPriceLevel.findFirst({
      where: { iplId: priceLevelId, iplIsDeleted: false },
      select: { iplId: true },
    });
    if (!level) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>(
        'Price level does not exist',
        [
          {
            field: 'cusPriceLevelId',
            message: `No active price level found with id ${priceLevelId}`,
            code: CustomerErrorCode.PRICE_LEVEL_NOT_FOUND,
          },
        ],
      );
    }
  }
  // cusBranchId is copied to the ledger's led_branch_id, a foreign key to branch_master.
  // Checked only when a branch is sent; null (no branch) and left out pass (F4).
  private async ensureBranchExists(
    tx: CustomerWriteClient,
    branchId: string | null | undefined,
  ): Promise<void> {
    if (branchId === undefined || branchId === null) {
      return;
    }
    const branch = await tx.branchMaster.findFirst({
      where: { brId: branchId, brIsDeleted: false },
      select: { brId: true },
    });
    if (!branch) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Branch does not exist', [
        {
          field: 'cusBranchId',
          message: `No active branch found with id ${branchId}`,
          code: CustomerErrorCode.BRANCH_NOT_FOUND,
        },
      ]);
    }
  }
  // D2 (plan §3.2): the code the row stores, or the refusal in the customer's words. A
  // GSTIN's first two digits are the state it is registered in (F10, NORMAL GSTINs only:
  // a TDS deductor's, a UIN, an OIDAR or a non-resident's number is not checked).
  private resolveGstType(
    rawType: string | null | undefined,
    gstin: string | null | undefined,
    stateCode: string,
  ): PartyGstType {
    const result = resolvePartyGstType({ rawType, gstin, stateCode });
    if ('type' in result) {
      return result.type;
    }
    const detail = customerGstRefusal(result.refusal);
    throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Validation failed', [detail]);
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
      throwConflict('Customer company cannot change', [
        withFigures(
          {
            field: 'cusCompanyId',
            code: CustomerErrorCode.COMPANY_HAS_BOOKS,
            message: `The party has entries in company ${books.companyId}; its company cannot change`,
          },
          `This party has entries in ${books.companyName ?? 'its company'}.`,
        ),
      ]);
    }
  }
  // Plan §3.4: a customer rename renames its supplier too, so the supplier's own
  // per-company name check runs, said in the customer's words.
  private async ensureSupplierNameFree(
    tx: CustomerWriteClient,
    name: string,
    companyId: string | null,
    ownId: string,
  ): Promise<void> {
    const clash = await tx.supplier.findFirst({
      where: {
        supIsDeleted: false,
        supCompanyId: companyId,
        supName: { equals: name, mode: 'insensitive' },
        supId: { not: ownId },
      },
      select: { supId: true },
    });
    if (clash) {
      throwSalesConflict<CustomerErrorDetail, CustomerErrorResponse>(
        'Customer name already exists for this company',
        [
          {
            ...CUSTOMER_NAME_EXISTS_DETAIL,
            message: 'Another supplier of this company has this name; the shared supplier would clash',
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
          code: CustomerErrorCode.STATE_NOT_FOUND,
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
    party: { gstType: PartyGstType; shared: boolean },
  ): SaveAccountLedgerMasterDto {
    const ledgerDto: SaveAccountLedgerMasterDto = {
      ledGroupId: saveCustomerDto.cusAreaId,
      ledName: normalized.name,
      ledStateName: normalized.stateName,
      ledStateCode: normalized.stateCode,
      // Customers are always settled bill-wise, so the linked ledger is
      // provisioned (and kept) with bill-by-bill on; the column defaults to false.
      ledIsBillByBill: true,
      // D2: the type's two ledger columns (SEZ = REGULAR + led_is_sez).
      ...ledgerGstFieldsOf(party.gstType),
    };
    const ledgerDtoRecord = ledgerDto as unknown as Record<string, unknown>;
    // D4: the party details through the one shared map.
    Object.assign(ledgerDtoRecord, this.partySyncService.detailsOf('CUSTOMER', saveCustomerDto));
    const customerRecord = saveCustomerDto as unknown as Record<string, unknown>;
    for (const [cusField, ledField] of CUSTOMER_TO_LEDGER_FIELD_MAP) {
      // Plan §3.4: on a shared ledger the notes stay with each role.
      if (cusField === 'cusNotes' && party.shared) {
        continue;
      }
      if (isPresentField(saveCustomerDto, cusField)) {
        // R3: the ledger's sort order is NOT NULL DEFAULT 0 as well; a cleared one is 0 on
        // both rows, never null on the ledger alone.
        ledgerDtoRecord[ledField] =
          cusField === 'cusSortOrder'
            ? zeroWhenCleared(customerRecord[cusField])
            : customerRecord[cusField];
      }
    }
    // The income-tax pair the map can't carry one-to-one.
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
      ...Object.fromEntries(
        CUSTOMER_ZERO_WHEN_CLEARED_FIELDS.map((field) => [field, zeroWhenCleared]),
      ),
    });
  }
  private normalizeStateCode(value: string | null | undefined): string {
    const normalized = (value ?? '').trim().toUpperCase();
    if (normalized.length !== 2) {
      throwSalesBadRequest<CustomerErrorDetail, CustomerErrorResponse>('Validation failed', [
        {
          field: 'cusStateCode',
          message: 'cusStateCode must be exactly 2 characters',
          code: CustomerErrorCode.STATE_CODE_INVALID,
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
          code: CustomerErrorCode.INVALID_DATE,
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
// The party GST refusals (common/party/party-gst-type.ts) in the customer's codes.
function customerGstRefusal(refusal: PartyGstRefusal): CustomerErrorDetail {
  switch (refusal.kind) {
    case 'TYPE_INVALID':
      return {
        field: 'cusGstType',
        message: `cusGstType "${refusal.sent}" is not one of REGULAR, COMPOSITION, SEZ, OVERSEAS, UNREGISTERED`,
        code: CustomerErrorCode.GST_TYPE_INVALID,
      };
    case 'TYPE_REQUIRED':
      return {
        field: 'cusGstType',
        message: 'cusGstType is required when cusGstNo is given',
        code: CustomerErrorCode.GST_TYPE_REQUIRED,
      };
    case 'GSTIN_REQUIRED':
      return {
        field: 'cusGstNo',
        message: `A ${partyGstTypeWord(refusal.type)} customer must have a GSTIN`,
        code: CustomerErrorCode.GSTIN_REQUIRED,
      };
    case 'GSTIN_NOT_ALLOWED':
      return {
        field: 'cusGstNo',
        message: `An ${partyGstTypeWord(refusal.type)} customer has no GSTIN; clear cusGstNo`,
        code: CustomerErrorCode.GSTIN_NOT_ALLOWED,
      };
    case 'OVERSEAS_STATE':
      return {
        field: 'cusStateCode',
        message: `An Overseas customer's state must be 96 (Other Country), not ${refusal.stateCode}`,
        code: CustomerErrorCode.OVERSEAS_STATE,
      };
    case 'GSTIN_STATE_MISMATCH':
      return {
        field: 'cusGstNo',
        message: `GSTIN ${refusal.gstin} is registered in state ${refusal.gstinState}, but cusStateCode is ${refusal.stateCode}`,
        code: CustomerErrorCode.GSTIN_STATE_MISMATCH,
      };
  }
}
