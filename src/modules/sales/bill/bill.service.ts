import { Injectable } from '@nestjs/common';
import { Prisma, SaleBill, SaleBillItem } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveBillDto } from './dto/save-bill.dto';
import { SaveBillItemDto } from './dto/save-bill-item.dto';
import {
  BILL_CHARGE_AUDIT,
  BILL_CHARGE_DOC_TYPE,
  BILL_TENDER_AUDIT,
  BILL_TENDER_DR_CR,
  BILL_TENDER_SRC_DOC_TYPE,
  BILL_TENDER_SRC_MODULE,
  BillChargePayload,
  BillErrorDetail,
  BillErrorResponse,
  BillItemPayload,
  BillPayload,
  BillTenderPayload,
} from './types/bill-api.types';
import { ChargeDetailService } from '../../master/charge-detail/charge-detail.service';
import { ChargeDocumentScope } from '../../master/charge-detail/types/charge-detail-api.types';
import { TenderDetailService } from '../../accountsModule/tenderDetail/tender-detail.service';
import { TenderDocumentScope } from '../../accountsModule/tenderDetail/types/tender-detail-api.types';
import {
  DEFAULT_ACTOR,
  PresentFieldTransform,
  SalesWriteClient,
  applyPresentFields,
  normalizeRequiredText,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSalesBadRequest,
  throwSalesConflict,
  throwSalesNotFound,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { allocateVoucherNumber } from 'src/common/Sequence/voucher-sequence.helper';
// accounts.acc_voucher_types row "Bil" / Sales Bill. Its numbering format
// (prefix / suffix / width / reset frequency) seeds the acc_voucher_seq row the
// bill numbers are drawn from.
const BILL_VCHR_TYPE_ID = 22;
const BILL_TABLE_NAME = 'sale_bill';
const BILL_ITEM_TABLE_NAME = 'sale_bill_item';
const BILL_AUDIT_SCREEN_NAME = 'Sale Bill';
// Allowed-value sets for the header/line-item columns that used to be DB CHECK
// constraints (ck_sb_doc_type / ck_sb_bill_type / ck_sb_status /
// ck_sb_pay_status / ck_sb_return_status / ck_sbi_free_type — migration
// 20260731070026). The DB no longer enforces them; ensureBillValuesAreAllowed
// / ensureBillItemValuesAreAllowed below are now the only definition of what
// is allowed, so a bad value comes back as a 400 naming the field instead of a
// raw Postgres 23514.
const BILL_DOC_TYPES = ['TAX_INVOICE', 'BILL_OF_SUPPLY'] as const;
const BILL_TYPES = ['CASH', 'CREDIT'] as const;
const BILL_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
const BILL_PAY_STATUSES = ['UNPAID', 'PARTIAL', 'PAID'] as const;
const BILL_RETURN_STATUSES = ['PARTIAL', 'FULL'] as const;
const BILL_ITEM_FREE_TYPES = ['SCHEME', 'SAMPLE', 'REPLACEMENT'] as const;
const BILL_VALUE_GUARDS = [
  { field: 'sbDocType', allowed: BILL_DOC_TYPES, nullable: false },
  { field: 'sbBillType', allowed: BILL_TYPES, nullable: false },
  { field: 'sbStatus', allowed: BILL_STATUSES, nullable: false },
  { field: 'sbPayStatus', allowed: BILL_PAY_STATUSES, nullable: false },
  { field: 'sbReturnStatus', allowed: BILL_RETURN_STATUSES, nullable: true },
] as const satisfies ReadonlyArray<{
  field: string;
  allowed: readonly string[];
  nullable: boolean;
}>;
type BillGuardedField = (typeof BILL_VALUE_GUARDS)[number]['field'];
type BillGuardedValues = Partial<Record<BillGuardedField, string | null | undefined>>;
// Header fields copied straight through when present on the payload. The
// partition/scope keys (sbCompanyId, sbBranchId, sbAccYear, sbPriceLevel,
// sbUserId) and the server-assigned number (sbBillSlno / sbBillRefno) are
// intentionally excluded — see the README's "Bill numbering" section.
const BILL_OPTIONAL_FIELDS = [
  'sbSessionId',
  'sbCounterId',
  'sbDeviceType',
  'sbDeviceId',
  'sbDocType',
  'sbBillType',
  'sbCategoryId',
  'sbUsrRefno',
  'sbBillDate',
  'sbBillDatetime',
  'sbDueDays',
  'sbDueDate',
  'sbSrcDocType',
  'sbSrcDocId',
  'sbSrcDocRefno',
  'sbSrcDocDate',
  'sbCustId',
  'sbCustName',
  'sbCustAddr',
  'sbCustPlace',
  'sbCustPin',
  'sbCustPhone',
  'sbCustGstin',
  'sbCustGstType',
  'sbCustStcd',
  'sbPosStcd',
  'sbStateName',
  'sbHasLoad',
  'sbHasUnload',
  'sbHasFreight',
  'sbHasPromo',
  'sbHasComm',
  'sbHasLoyalty',
  'sbSalesmanId',
  'sbAgentId',
  'sbAgentCommPerc',
  'sbAgentCommAmt',
  'sbDriverId',
  'sbLoadmanId',
  'sbPackedId',
  'sbSupervisorId',
  'sbVehicleId',
  'sbVehicleNo',
  'sbTotItems',
  'sbTotWeight',
  'sbTotBags',
  'sbGrossAmt',
  'sbItemDisc',
  'sbSplDisc',
  'sbSchDisc',
  'sbBillSchDisc',
  'sbAddlDisc1',
  'sbAddlDisc2',
  'sbCashDisc',
  'sbTaxableAmt',
  'sbCgstAmt',
  'sbSgstAmt',
  'sbIgstAmt',
  'sbCessAmt',
  'sbTaxAmt',
  'sbFreightAmt',
  'sbLoadAmt',
  'sbUnloadAmt',
  'sbOtherAmt1',
  'sbOtherAmt2',
  'sbRoundOff',
  'sbBillAmt',
  'sbTotalCost',
  'sbMarginAmt',
  'sbMarginAmtWot',
  'sbMarginPerc',
  'sbMrpSavings',
  'sbMrpSavingsPerc',
  'sbPayMode',
  'sbCreditAmt',
  'sbSurchargeAmt',
  'sbTenderAmt',
  'sbRefundAmt',
  'sbAdvanceAmt',
  'sbPaidAmt',
  'sbBalanceAmt',
  'sbPayStatus',
  'sbReturnedAmt',
  'sbReturnStatus',
  'sbPaymentTerms',
  'sbDeliveryTerms',
  'sbTermsConditions',
  'sbRemarks',
  'sbFreightCalcType',
  'sbLoadingCalcType',
  'sbDiscAlterBase',
  'sbRoundOffStep',
  'sbStatus',
  'sbPostedOn',
  'sbPostedVoucherId',
  'sbApprovedOn',
  'sbApprovedBy',
  'sbCancelledOn',
  'sbCancelledBy',
  'sbCancelReason',
  'sbVersionNo',
  'sbPrintCount',
];
// Line-item fields copied straight through when present on the payload. The
// scope keys (bill/company/branch/tenant/accYear/lineNo/priceLevel), the three
// fields required for a new line (sbiItemId, sbiItemUnitId, sbiGodownId) and
// the nullable sbiStockId are set explicitly, so they are excluded here.
const BILL_ITEM_OPTIONAL_FIELDS = [
  'sbiSrcDocType',
  'sbiSrcDocId',
  'sbiSrcDocRefno',
  'sbiSrcItemQty',
  'sbiSrcFreeQty',
  'sbiToBaseFactor',
  'sbiHsnCode',
  'sbiEanCode',
  'sbiBatchNo',
  'sbiBatchDate',
  'sbiExpiryDate',
  'sbiSerialNo',
  'sbiIsTaxIncl',
  'sbiIsPromo',
  'sbiIsFree',
  'sbiFreeType',
  'sbiIsService',
  'sbiHasFreight',
  'sbiCaseQty',
  'sbiBillQty',
  'sbiLengthQty',
  'sbiNetQty',
  'sbiWeightQty',
  'sbiAvailableStock',
  'sbiReturnQty',
  'sbiRate',
  'sbiRatePreTax',
  'sbiRateDiff',
  'sbiActPrice',
  'sbiMaxPrice',
  'sbiMinPrice',
  'sbiCostPrice',
  'sbiCostPreTax',
  'sbiItemDiscPerc',
  'sbiItemDiscQty',
  'sbiItemDiscAmt',
  'sbiSplDiscPerc',
  'sbiSplDiscQty',
  'sbiSplDiscAmt',
  'sbiSchDiscPerc',
  'sbiSchDiscQty',
  'sbiSchDiscAmt',
  'sbiBillSchPerc',
  'sbiBillSchQty',
  'sbiBillSchAmt',
  'sbiAddlDisc1Perc',
  'sbiAddlDisc1Amt',
  'sbiAddlDisc2Perc',
  'sbiAddlDisc2Amt',
  'sbiCashDiscPerc',
  'sbiCashDiscAmt',
  'sbiGrossAmt',
  'sbiNetGross',
  'sbiChrgBeforeTax',
  'sbiChrgAfterTax',
  'sbiTaxableAmt',
  'sbiTaxPerc',
  'sbiTaxAmt',
  'sbiCgstPerc',
  'sbiCgstAmt',
  'sbiSgstPerc',
  'sbiSgstAmt',
  'sbiIgstPerc',
  'sbiIgstAmt',
  'sbiCessPerc',
  'sbiCessPerUnit',
  'sbiCessAmt',
  'sbiAcessPerc',
  'sbiAcessPerUnit',
  'sbiAcessAmt',
  'sbiBatchConfig',
  'sbiFreightQty',
  'sbiFreightAmt',
  'sbiLoadQty',
  'sbiLoadAmt',
  'sbiUnloadQty',
  'sbiUnloadAmt',
  'sbiRoundOff',
  'sbiNetAmt',
  'sbiSoldPrice',
  'sbiSoldPreTax',
  'sbiItemProfit',
  'sbiProfitPreTax',
  'sbiMrpSavings',
  'sbiMrpSavingsPerc',
  'sbiSalesmanId',
  'sbiSchemeId',
  'sbiSchemeName',
  'sbiRemarks',
];
// Every date / timestamptz column reachable from the payload. JSON carries them
// as ISO strings, Prisma wants Date objects, so each one is converted on the way
// in (and a malformed value comes back as a 400 naming the field).
const BILL_DATE_FIELDS = [
  'sbBillDate',
  'sbBillDatetime',
  'sbDueDate',
  'sbSrcDocDate',
  'sbPostedOn',
  'sbApprovedOn',
  'sbCancelledOn',
];
const BILL_ITEM_DATE_FIELDS = ['sbiBatchDate', 'sbiExpiryDate'];
function toDateOrNull(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  const dateValue = new Date(value as string);
  if (Number.isNaN(dateValue.getTime())) {
    throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Validation failed', [
      {
        field,
        message: `${field} must be a valid ISO date`,
      },
    ]);
  }
  return dateValue;
}
function buildDateTransforms(
  fields: readonly string[],
): Partial<Record<string, PresentFieldTransform>> {
  return Object.fromEntries(
    fields.map((field) => [field, (value: unknown) => toDateOrNull(value, field)]),
  );
}
const BILL_DATE_TRANSFORMS = buildDateTransforms(BILL_DATE_FIELDS);
const BILL_ITEM_DATE_TRANSFORMS = buildDateTransforms(BILL_ITEM_DATE_FIELDS);
// The immutable scope inherited by every line from its parent bill. The last
// five are only read by the tender lines, which snapshot the document's date,
// party and capture context (acc_tender_detail has no FK back to sale_bill to
// join them from).
interface BillScope {
  sbId: string;
  sbCompanyId: string;
  sbBranchId: string;
  sbTenantId: string | null;
  sbAccYear: string;
  sbPriceLevel: number;
  // Nullable since sb_bill_slno became nullable: a counter operating without a
  // number series yet saves the draft unnumbered.
  sbBillSlno: bigint | null;
  sbBillDate: Date;
  sbCustId: string;
  sbUserId: string;
  sbSessionId: string | null;
  sbDeviceId: string;
}
type BillWriteClient = SalesWriteClient;
// Only populated when the item was fetched with the item/unit joins (getById);
// create/update paths pass plain SaleBillItem rows where these are absent.
type SaleBillItemWithNames = SaleBillItem & {
  item?: {
    itemNameEn: string;
    itemGroupId: string;
    itemBrandId: string | null;
    itemSectionId: string | null;
    itemCategoryId: string | null;
  } | null;
  itemUnitConversion?: { unit: { unit_name: string; unit_decimal_count: number } } | null;
};
@Injectable()
export class BillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
    // sale_charge_detail is owned by the charge-detail module: the bill hands it
    // the charges[] array and its own scope rather than writing that table
    // itself, so both entry points share one set of guards and one audit trail.
    private readonly chargeDetailService: ChargeDetailService,
    // Same arrangement for acc_tender_detail and the tenders[] array — the money
    // the customer actually handed over, captured while the bill is still a
    // draft and carried through to posting.
    private readonly tenderDetailService: TenderDetailService,
  ) {}
  async save(saveBillDto: SaveBillDto): Promise<BillPayload> {
    this.ensureBillValuesAreAllowed(saveBillDto);
    if (saveBillDto.sbId) {
      return this.updateBill(saveBillDto);
    }
    return this.createBill(saveBillDto);
  }
  async getById(
    sbId: string,
    sbCompanyId: string,
    sbBranchId: string,
    sbAccYear: string,
  ): Promise<BillPayload> {
    const record = await this.prisma.saleBill.findFirst({
      where: {
        sbId,
        sbCompanyId,
        sbBranchId,
        sbAccYear,
        sbIsDeleted: false,
      },
      include: {
        items: {
          where: { sbiIsDeleted: false },
          orderBy: { sbiLineNo: 'asc' },
          include: {
            item: {
              select: {
                itemNameEn: true,
                itemGroupId: true,
                itemBrandId: true,
                itemSectionId: true,
                itemCategoryId: true,
              },
            },
            itemUnitConversion: {
              select: { unit: { select: { unit_name: true, unit_decimal_count: true } } },
            },
          },
        },
      },
    });
    if (!record) {
      throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
        'Bill not found',
        'sbId',
        `No active bill found with id ${sbId}`,
      );
    }
    // sale_charge_detail is polymorphic (no FK to sale_bill), so the applied
    // charges are fetched by discriminator rather than by `include` — through
    // the charge-detail module, which also resolves each line's ledger name.
    const charges = await this.chargeDetailService.getByDocument(BILL_CHARGE_DOC_TYPE, sbId);
    // acc_tender_detail is polymorphic for the same reason, and read the same
    // way — through its own module, which resolves each line's tender and
    // ledger names.
    const tenders = await this.tenderDetailService.getByDocument(
      BILL_TENDER_SRC_MODULE,
      BILL_TENDER_SRC_DOC_TYPE,
      sbId,
    );
    // sbi_godown_id has no FK to inventory.godown_locations either, so the
    // godown name cannot ride along on the `include` the way sbiItemName does —
    // it is resolved in one batched lookup over the bill's distinct godowns.
    const godownNameById = await this.resolveGodownNames(record.items);
    return this.toPayload({ ...record, charges, tenders }, godownNameById);
  }
  async softDelete(sbId: string): Promise<{ sbId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.saleBill.findFirst({
        where: {
          sbId,
          sbIsDeleted: false,
        },
      });
      if (!existing) {
        throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
          'Bill not found',
          'sbId',
          `No active bill found with id ${sbId}`,
        );
      }
      const modifiedOn = new Date();
      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const result = await tx.saleBill.updateMany({
        where: {
          sbId,
          sbIsDeleted: false,
        },
        data: {
          sbIsDeleted: true,
          sbModifiedOn: modifiedOn,
          sbModifiedBy: actor,
        },
      });
      if (result.count === 0) {
        throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
          'Bill not found',
          'sbId',
          `No active bill found with id ${sbId}`,
        );
      }
      // Cascade the soft delete to the bill's line items so no line stays active
      // while the header is logically deleted.
      await tx.saleBillItem.updateMany({
        where: {
          sbiBillId: sbId,
          sbiIsDeleted: false,
        },
        data: {
          sbiIsDeleted: true,
          sbiModifiedOn: modifiedOn,
          sbiModifiedBy: actor,
        },
      });
      // Same cascade for the applied charges — an active charge line must never
      // outlive the document it was charged on.
      await this.chargeDetailService.softDeleteDocumentCharges(
        tx,
        BILL_CHARGE_DOC_TYPE,
        sbId,
        actor,
        modifiedOn,
      );
      // ... and for the tendered money, so no payment line stays active against
      // a bill that no longer exists.
      await this.tenderDetailService.softDeleteDocumentTenders(
        tx,
        BILL_TENDER_SRC_MODULE,
        BILL_TENDER_SRC_DOC_TYPE,
        sbId,
        actor,
        modifiedOn,
      );
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        sbIsDeleted: true,
        sbModifiedOn: modifiedOn,
        sbModifiedBy: actor,
      });
      await this.auditLogService.logEntityChange(
        {
          // A soft delete is logged as 'cancel', the way every other module logs
          // one: audit.audit_log_action has no 'delete' member, so
          // AuditLogService.normalizeAction answers 400 for it.
          action: 'cancel',
          tableName: BILL_TABLE_NAME,
          screenName: BILL_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: sbId,
          displayName: existing.sbBillRefno || sbId,
          originalRecord,
          modifiedRecord,
          userId: actor,
          notes: 'Bill soft deleted',
        },
        tx,
      );
      return {
        sbId,
        deleted: true,
      };
    });
  }
  private async createBill(saveBillDto: SaveBillDto): Promise<BillPayload> {
    const normalizedCustName = normalizeRequiredText<BillErrorDetail, BillErrorResponse>(
      saveBillDto.sbCustName ?? '',
      'sbCustName',
    );
    const now = new Date();
    const createdBy = resolveActor(saveBillDto.sbCreatedBy, this.requestContextService.getUserId());
    const billDate = saveBillDto.sbBillDate ? new Date(saveBillDto.sbBillDate) : now;
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Voucher type 22 numbers the document: the running number consumed from
        // accounts.acc_voucher_seq becomes sbBillSlno and its printable form
        // becomes sbBillRefno. Both are server-assigned — the voucher type is
        // AUTO-numbered with manual numbers disallowed, so whatever the client
        // sent for either field is ignored.
        const billNumber = await allocateVoucherNumber(tx, {
          vchrTypeId: BILL_VCHR_TYPE_ID,
          companyId: saveBillDto.sbCompanyId,
          branchId: saveBillDto.sbBranchId,
          accYear: saveBillDto.sbAccYear,
          documentDate: billDate,
        });
        const data: Prisma.SaleBillUncheckedCreateInput = {
          sbCompanyId: saveBillDto.sbCompanyId,
          sbBranchId: saveBillDto.sbBranchId,
          sbTenantId: saveBillDto.sbTenantId,
          sbAccYear: saveBillDto.sbAccYear,
          sbCounterId: saveBillDto.sbCounterId,
          sbDeviceType: saveBillDto.sbDeviceType,
          sbDeviceId: saveBillDto.sbDeviceId,
          sbPriceLevel: saveBillDto.sbPriceLevel,
          sbBillSlno: billNumber.lastNo,
          sbBillRefno: billNumber.refno,
          sbBillDate: billDate,
          sbCustId: saveBillDto.sbCustId,
          sbCustName: normalizedCustName,
          sbUserId: saveBillDto.sbUserId,
          sbCreatedOn: now,
          sbCreatedBy: createdBy,
          sbStatus: saveBillDto.sbStatus || 'DRAFT',
        };
        this.applyOptionalFields(data, saveBillDto);
        data.sbCustName = normalizedCustName;
        data.sbBillDate = billDate;
        const created = await tx.saleBill.create({ data });
        const scope: BillScope = {
          sbId: created.sbId,
          sbCompanyId: created.sbCompanyId,
          sbBranchId: created.sbBranchId,
          sbTenantId: created.sbTenantId,
          sbAccYear: created.sbAccYear,
          sbPriceLevel: created.sbPriceLevel,
          sbBillSlno: created.sbBillSlno,
          sbBillDate: created.sbBillDate,
          sbCustId: created.sbCustId,
          sbUserId: created.sbUserId,
          sbSessionId: created.sbSessionId,
          sbDeviceId: created.sbDeviceId,
        };
        const items = await this.syncItems(tx, scope, saveBillDto.items, createdBy);
        const charges = await this.chargeDetailService.syncDocumentCharges(
          tx,
          this.toChargeScope(scope),
          saveBillDto.charges,
          createdBy,
          BILL_CHARGE_AUDIT,
        );
        const tenders = await this.tenderDetailService.syncDocumentTenders(
          tx,
          this.toTenderScope(scope),
          saveBillDto.tenders,
          createdBy,
          BILL_TENDER_AUDIT,
        );
        const payload = this.toPayload({ ...created, items, charges, tenders });
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: BILL_TABLE_NAME,
            screenName: BILL_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: payload.sbId,
            displayName: payload.sbBillRefno || payload.sbId,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Bill created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      const duplicate = this.describeDuplicate(error);
      throwOnUniqueConstraintError<BillErrorDetail, BillErrorResponse>(
        error,
        duplicate.message,
        duplicate.errors,
      );
      throw error;
    }
  }
  private async updateBill(saveBillDto: SaveBillDto): Promise<BillPayload> {
    const sbId = saveBillDto.sbId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.saleBill.findFirst({
          where: {
            sbId,
            sbIsDeleted: false,
          },
        });
        if (!existing) {
          throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
            'Bill not found',
            'sbId',
            `No active bill found with id ${sbId}`,
          );
        }
        const now = new Date();
        const modifiedBy = resolveActor(
          saveBillDto.sbModifiedBy,
          this.requestContextService.getUserId(),
        );
        const data: Prisma.SaleBillUncheckedUpdateInput = {
          sbModifiedOn: now,
          sbModifiedBy: modifiedBy,
        };
        this.applyOptionalFields(data, saveBillDto);
        const updated = await tx.saleBill.update({
          where: { sbId_sbAccYear: { sbId: existing.sbId, sbAccYear: existing.sbAccYear } },
          data,
        });
        const scope: BillScope = {
          sbId: updated.sbId,
          sbCompanyId: updated.sbCompanyId,
          sbBranchId: updated.sbBranchId,
          sbTenantId: updated.sbTenantId,
          sbAccYear: updated.sbAccYear,
          sbPriceLevel: updated.sbPriceLevel,
          sbBillSlno: updated.sbBillSlno,
          sbBillDate: updated.sbBillDate,
          sbCustId: updated.sbCustId,
          sbUserId: updated.sbUserId,
          sbSessionId: updated.sbSessionId,
          sbDeviceId: updated.sbDeviceId,
        };
        const items = await this.syncItems(tx, scope, saveBillDto.items, modifiedBy);
        const charges = await this.chargeDetailService.syncDocumentCharges(
          tx,
          this.toChargeScope(scope),
          saveBillDto.charges,
          modifiedBy,
          BILL_CHARGE_AUDIT,
        );
        const tenders = await this.tenderDetailService.syncDocumentTenders(
          tx,
          this.toTenderScope(scope),
          saveBillDto.tenders,
          modifiedBy,
          BILL_TENDER_AUDIT,
        );
        const payload = this.toPayload({ ...updated, items, charges, tenders });
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: BILL_TABLE_NAME,
            screenName: BILL_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: sbId,
            displayName: payload.sbBillRefno || payload.sbId,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.sbModifiedBy || payload.sbCreatedBy,
            notes: 'Bill updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      const duplicate = this.describeDuplicate(error);
      throwOnUniqueConstraintError<BillErrorDetail, BillErrorResponse>(
        error,
        duplicate.message,
        duplicate.errors,
      );
      throw error;
    }
  }
  // Reconciles the bill's line items with the payload array:
  //   - a line carrying sbiId updates that existing line
  //   - a line without sbiId is created
  //   - an existing line absent from the array is soft deleted
  // Passing `undefined` (property omitted) leaves the current lines untouched.
  //
  // Order matters, for the same reason as the quotation module: the replaced
  // lines are soft deleted first (freeing their line numbers), and surviving
  // lines the payload reorders are parked above every requested number before
  // being renumbered down, so a 1<->2 swap never passes through a state where
  // both rows want the same number.
  private async syncItems(
    tx: BillWriteClient,
    scope: BillScope,
    inputItems: SaveBillItemDto[] | undefined,
    actorId: string,
  ): Promise<SaleBillItem[]> {
    const existing = await tx.saleBillItem.findMany({
      where: { sbiBillId: scope.sbId, sbiIsDeleted: false },
      orderBy: { sbiLineNo: 'asc' },
    });
    if (inputItems === undefined) {
      return existing;
    }
    const existingMap = new Map(existing.map((item) => [item.sbiId, item]));
    const now = new Date();
    // Line numbers first: an entry keeps the number it sent, otherwise it takes
    // its position in the array.
    const resolvedItems = inputItems.map((inputItem, index) => ({
      inputItem,
      lineNo: inputItem.sbiLineNo ?? index + 1,
    }));
    const seenLineNos = new Set<number>();
    const keptIds = new Set<string>();
    for (const { inputItem, lineNo } of resolvedItems) {
      if (seenLineNos.has(lineNo)) {
        throwSalesConflict<BillErrorDetail, BillErrorResponse>(
          'Duplicate bill line number is not allowed',
          [
            {
              field: 'sbiLineNo',
              message: `A bill line already exists with line number ${lineNo}`,
            },
          ],
        );
      }
      seenLineNos.add(lineNo);
      if (inputItem.sbiId) {
        if (!existingMap.has(inputItem.sbiId)) {
          throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
            'Bill item not found',
            'sbiId',
            `No active bill line found with id ${inputItem.sbiId} on this bill`,
          );
        }
        keptIds.add(inputItem.sbiId);
      }
    }
    // Retire the lines the payload dropped before inserting anything: leaving
    // them active would hold their line numbers against the replacements.
    await this.softDeleteItems(
      tx,
      existing.filter((item) => !keptIds.has(item.sbiId)),
      actorId,
      now,
    );
    // The surviving lines can still be in each other's way when the payload
    // reorders them (1<->2 renumbers through a state where both rows want 2),
    // so they are parked above every number the payload asks for and
    // renumbered down from there. Skipped when no survivor changes number,
    // which is the usual edit.
    const reordersItems = resolvedItems.some(
      ({ inputItem, lineNo }) =>
        inputItem.sbiId !== undefined && existingMap.get(inputItem.sbiId)?.sbiLineNo !== lineNo,
    );
    if (reordersItems && keptIds.size > 0) {
      await tx.saleBillItem.updateMany({
        where: { sbiId: { in: [...keptIds] } },
        data: { sbiLineNo: { increment: Math.max(...seenLineNos) + 1 } },
      });
    }
    const persisted: SaleBillItem[] = [];
    for (const { inputItem, lineNo } of resolvedItems) {
      if (inputItem.sbiId) {
        // Present — the validation pass above already rejected an id that is not
        // an active line on this bill.
        const existingItem = existingMap.get(inputItem.sbiId)!;
        this.ensureBillItemValuesAreAllowed(inputItem, existingItem);
        const updateData: Prisma.SaleBillItemUncheckedUpdateInput = {
          sbiLineNo: lineNo,
          sbiSplitNo: inputItem.sbiSplitNo ?? existingItem.sbiSplitNo,
          sbiItemId: inputItem.sbiItemId ?? existingItem.sbiItemId,
          sbiItemUnitId: inputItem.sbiItemUnitId ?? existingItem.sbiItemUnitId,
          sbiGodownId: inputItem.sbiGodownId ?? existingItem.sbiGodownId,
          sbiStockId: inputItem.sbiStockId ?? existingItem.sbiStockId,
          sbiPriceLevel: inputItem.sbiPriceLevel ?? scope.sbPriceLevel,
          sbiModifiedOn: now,
          sbiModifiedBy: resolveActor(inputItem.sbiModifiedBy, actorId),
        };
        applyPresentFields(
          updateData,
          inputItem,
          BILL_ITEM_OPTIONAL_FIELDS,
          BILL_ITEM_DATE_TRANSFORMS,
        );
        const updated = await tx.saleBillItem.update({
          where: {
            sbiId_sbiAccYear: { sbiId: inputItem.sbiId, sbiAccYear: existingItem.sbiAccYear },
          },
          data: updateData,
        });
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: BILL_ITEM_TABLE_NAME,
            screenName: BILL_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: updated.sbiId,
            displayName: `Line ${updated.sbiLineNo}`,
            originalRecord: this.toItemPayload(existingItem),
            modifiedRecord: this.toItemPayload(updated),
            userId: resolveActor(inputItem.sbiModifiedBy, actorId),
            notes: 'Bill item updated',
          },
          tx,
        );
        persisted.push(updated);
        continue;
      }
      this.ensureBillItemValuesAreAllowed(inputItem, undefined);
      const createData: Prisma.SaleBillItemUncheckedCreateInput = {
        sbiBillId: scope.sbId,
        sbiCompanyId: inputItem.sbiCompanyId ?? scope.sbCompanyId,
        sbiBranchId: inputItem.sbiBranchId ?? scope.sbBranchId,
        sbiTenantId: inputItem.sbiTenantId ?? scope.sbTenantId,
        sbiAccYear: inputItem.sbiAccYear ?? scope.sbAccYear,
        sbiLineNo: lineNo,
        sbiSplitNo: inputItem.sbiSplitNo ?? 1,
        sbiItemId: this.requireItemField(inputItem.sbiItemId, 'sbiItemId'),
        sbiItemUnitId: this.requireItemField(inputItem.sbiItemUnitId, 'sbiItemUnitId'),
        sbiGodownId: this.requireItemField(inputItem.sbiGodownId, 'sbiGodownId'),
        // Nullable column: a line with no batch allocation is allowed.
        sbiStockId: inputItem.sbiStockId ?? null,
        sbiPriceLevel: inputItem.sbiPriceLevel ?? scope.sbPriceLevel,
        sbiCreatedOn: now,
        sbiCreatedBy: resolveActor(inputItem.sbiCreatedBy, actorId),
      };
      applyPresentFields(
        createData,
        inputItem,
        BILL_ITEM_OPTIONAL_FIELDS,
        BILL_ITEM_DATE_TRANSFORMS,
      );
      const created = await tx.saleBillItem.create({ data: createData });
      await this.auditLogService.logEntityChange(
        {
          action: 'New',
          tableName: BILL_ITEM_TABLE_NAME,
          screenName: BILL_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: created.sbiId,
          displayName: `Line ${created.sbiLineNo}`,
          originalRecord: null,
          modifiedRecord: this.toItemPayload(created),
          userId: created.sbiCreatedBy,
          notes: 'Bill item created',
        },
        tx,
      );
      persisted.push(created);
    }
    return persisted.sort((left, right) => left.sbiLineNo - right.sbiLineNo);
  }
  // Retires the lines the payload no longer carries. Called before the payload
  // is written so the freed line numbers are available to the replacements.
  private async softDeleteItems(
    tx: BillWriteClient,
    removed: SaleBillItem[],
    actorId: string,
    now: Date,
  ): Promise<void> {
    for (const removedItem of removed) {
      const deleted = await tx.saleBillItem.update({
        where: {
          sbiId_sbiAccYear: { sbiId: removedItem.sbiId, sbiAccYear: removedItem.sbiAccYear },
        },
        data: {
          sbiIsDeleted: true,
          sbiModifiedOn: now,
          sbiModifiedBy: actorId,
        },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: BILL_ITEM_TABLE_NAME,
          screenName: BILL_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: deleted.sbiId,
          displayName: `Line ${removedItem.sbiLineNo}`,
          originalRecord: this.toItemPayload(removedItem),
          modifiedRecord: this.toItemPayload(deleted),
          userId: actorId,
          notes: 'Bill item soft deleted',
        },
        tx,
      );
    }
  }
  // Names the duplicate a P2002 actually is. Unlike sale_quotation, sale_bill
  // defines no unique index on (company, branch, accYear, billRefno/billSlno) —
  // the numbers now come from the voucher sequence, whose own scope constraint
  // and advisory lock keep them unique (see the README) — so the only realistic
  // P2002 source is the partition-aware primary key itself, which should not
  // happen given sbId / sbiId are uuidv7-generated.
  private describeDuplicate(error: unknown): { message: string; errors: BillErrorDetail[] } {
    void error;
    return {
      message: 'Bill already exists',
      errors: [{ field: 'sbId', message: 'A bill with this id already exists' }],
    };
  }
  // Mirrors the DB CHECK constraints dropped from sale_bill (ck_sb_doc_type /
  // ck_sb_bill_type / ck_sb_status / ck_sb_pay_status / ck_sb_return_status,
  // migration 20260731070026) so a bad value comes back as a 400 with the
  // offending field instead of a raw Postgres 23514. Only the fields present on
  // the payload are checked — an update that omits a field leaves whatever is
  // already stored untouched, so there is nothing new to validate.
  private ensureBillValuesAreAllowed(dto: SaveBillDto): void {
    const values: BillGuardedValues = {
      sbDocType: dto.sbDocType,
      sbBillType: dto.sbBillType,
      sbStatus: dto.sbStatus,
      sbPayStatus: dto.sbPayStatus,
      sbReturnStatus: dto.sbReturnStatus,
    };
    const details: BillErrorDetail[] = [];
    for (const guard of BILL_VALUE_GUARDS) {
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
      throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Invalid bill value', details);
    }
  }
  // Mirrors the DB CHECK constraints dropped from sale_bill_item
  // (ck_sbi_free_type / ck_sbi_split_no / ck_sbi_batch_split, migration
  // 20260731070026). ck_sbi_split_no (sbi_split_no >= 1) is covered by the
  // @OptionalInteger(1) Min validator on SaveBillItemDto and is not repeated
  // here. ck_sbi_batch_split is a cross-field rule, so it is judged on the
  // FINAL resolved values — the payload's, falling back to the existing row's
  // on update — the same way the charge module judges cdTaxApl/cdBeforeTax.
  private ensureBillItemValuesAreAllowed(
    inputItem: SaveBillItemDto,
    existingItem: SaleBillItem | undefined,
  ): void {
    const details: BillErrorDetail[] = [];
    if (inputItem.sbiFreeType !== undefined && inputItem.sbiFreeType !== null) {
      if (!(BILL_ITEM_FREE_TYPES as readonly string[]).includes(inputItem.sbiFreeType)) {
        details.push({
          field: 'sbiFreeType',
          message: `sbiFreeType must be one of: ${BILL_ITEM_FREE_TYPES.join(', ')}`,
        });
      }
    }
    const splitNo =
      inputItem.sbiSplitNo !== undefined ? inputItem.sbiSplitNo : (existingItem?.sbiSplitNo ?? 1);
    const batchNo =
      inputItem.sbiBatchNo !== undefined
        ? inputItem.sbiBatchNo
        : (existingItem?.sbiBatchNo ?? null);
    if (splitNo !== 1 && !batchNo) {
      details.push({
        field: 'sbiBatchNo',
        message: 'sbiBatchNo is required when sbiSplitNo is not 1',
      });
    }
    if (details.length > 0) {
      throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Invalid bill item value', details);
    }
  }
  private requireItemField(value: string | undefined, field: string): string {
    if (!value) {
      throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
        `${field} is required for a new bill line`,
        field,
        `${field} must be provided when creating a bill line`,
      );
    }
    return value;
  }
  // The bill's applied charges as the charge-detail module wants them: a bill
  // IS the tax invoice, so its lines carry the INVOICE discriminator, and every
  // charge inherits the header's company / branch / accounting year and
  // defaults its cdVoucherNo to the bill's own number.
  private toChargeScope(scope: BillScope): ChargeDocumentScope {
    return {
      cdDocType: BILL_CHARGE_DOC_TYPE,
      cdDocId: scope.sbId,
      cdCompId: scope.sbCompanyId,
      cdBranchId: scope.sbBranchId,
      cdAccYear: scope.sbAccYear,
      cdVoucherNo: scope.sbBillSlno,
    };
  }
  // The same for the tendered money: a bill's tenders are SALES / SALE_BILL rows
  // pointing at sbId, dated with the bill, raised against the customer's ledger
  // and captured by the bill's own user / session / device.
  //
  // td_party_ledger_id takes sbCustId: a customer row and its account ledger
  // share one primary key (CustomerService mirrors every customer into
  // acc_ledger_master under the same id), so the bill's customer IS the ledger
  // the money is owed by. A line may still name a different party ledger, and
  // the tender module verifies whichever id it gets.
  private toTenderScope(scope: BillScope): TenderDocumentScope {
    return {
      tdSrcModule: BILL_TENDER_SRC_MODULE,
      tdSrcDocType: BILL_TENDER_SRC_DOC_TYPE,
      tdSrcDocId: scope.sbId,
      tdCompanyId: scope.sbCompanyId,
      tdBranchId: scope.sbBranchId,
      tdTenantId: scope.sbTenantId,
      tdAccYear: scope.sbAccYear,
      tdDocDate: scope.sbBillDate,
      tdPartyLedgerId: scope.sbCustId,
      tdUserId: scope.sbUserId,
      tdSessionId: scope.sbSessionId,
      tdDeviceId: scope.sbDeviceId,
      tdDrCr: BILL_TENDER_DR_CR,
    };
  }
  private applyOptionalFields(
    data: Prisma.SaleBillUncheckedCreateInput | Prisma.SaleBillUncheckedUpdateInput,
    dto: SaveBillDto,
  ): void {
    applyPresentFields(data, dto, BILL_OPTIONAL_FIELDS, BILL_DATE_TRANSFORMS);
  }
  // One batched read of the godown names the bill's lines point at, keyed by
  // gdl_id. Empty on the create/update paths, which do not resolve display
  // names — see toItemPayload.
  private async resolveGodownNames(
    items: readonly Pick<SaleBillItem, 'sbiGodownId'>[] = [],
  ): Promise<Map<string, string>> {
    const godownIds = [...new Set(items.map((item) => item.sbiGodownId))];
    if (godownIds.length === 0) {
      return new Map();
    }
    const godowns = await this.prisma.godownLocation.findMany({
      where: { gdlId: { in: godownIds } },
      select: { gdlId: true, gdlName: true },
    });
    return new Map(godowns.map((godown) => [godown.gdlId, godown.gdlName]));
  }
  private toPayload(
    record: SaleBill & {
      items?: SaleBillItemWithNames[];
      // Already shaped by ChargeDetailService / TenderDetailService — the bill
      // passes them through.
      charges?: BillChargePayload[];
      tenders?: BillTenderPayload[];
    },
    godownNameById: Map<string, string> = new Map(),
  ): BillPayload {
    const {
      sbCreatedOn,
      sbModifiedOn,
      sbBillDatetime,
      sbSyncDate,
      sbBillSlno,
      items,
      charges,
      tenders,
      ...rest
    } = record;
    return {
      ...rest,
      sbCreatedOn: sbCreatedOn?.toISOString(),
      sbModifiedOn: sbModifiedOn?.toISOString() ?? null,
      sbBillDatetime: sbBillDatetime?.toISOString(),
      sbSyncDate: sbSyncDate?.toISOString() ?? null,
      // bigint column — stringified here for the same reason cdVoucherNo is:
      // JSON has no bigint and res.json() throws on one.
      sbBillSlno: sbBillSlno?.toString() ?? null,
      items: items ? items.map((item) => this.toItemPayload(item, godownNameById)) : [],
      charges: charges ?? [],
      tenders: tenders ?? [],
    };
  }
  private toItemPayload(
    record: SaleBillItemWithNames,
    godownNameById: Map<string, string> = new Map(),
  ): BillItemPayload {
    const { sbiCreatedOn, sbiModifiedOn, sbiSyncDate, item, itemUnitConversion, ...rest } = record;
    return {
      ...rest,
      sbiCreatedOn: sbiCreatedOn?.toISOString(),
      sbiModifiedOn: sbiModifiedOn?.toISOString() ?? null,
      sbiSyncDate: sbiSyncDate?.toISOString() ?? null,
      sbiItemName: item?.itemNameEn ?? null,
      sbiUnitName: itemUnitConversion?.unit.unit_name ?? null,
      sbiDecimalCount: itemUnitConversion?.unit.unit_decimal_count ?? null,
      sbiGroupId: item?.itemGroupId ?? null,
      sbiBrandId: item?.itemBrandId ?? null,
      sbiSectionId: item?.itemSectionId ?? null,
      sbiCategoryId: item?.itemCategoryId ?? null,
      sbiGodownName: godownNameById.get(record.sbiGodownId) ?? null,
    };
  }
}
