import { Injectable } from '@nestjs/common';
import { Prisma, SaleBill, SaleBillItem, SaleChargeDetail } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveBillChargeDto } from './dto/save-bill-charge.dto';
import { SaveBillDto } from './dto/save-bill.dto';
import { SaveBillItemDto } from './dto/save-bill-item.dto';
import {
  BILL_CHARGE_DOC_TYPE,
  BillChargePayload,
  BillErrorDetail,
  BillErrorResponse,
  BillItemPayload,
  BillPayload,
} from './types/bill-api.types';
import {
  CHARGE_DETAIL_VALUE_GUARDS,
  ChargeDetailGuardedValues,
} from '../../master/charge-master/types/charge-master-api.types';
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
const BILL_TABLE_NAME = 'sale_bill';
const BILL_ITEM_TABLE_NAME = 'sale_bill_item';
const BILL_CHARGE_TABLE_NAME = 'sale_charge_detail';
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
// sbUserId) and the counter-issued number (sbBillSlno / sbBillRefno) are
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
// scope keys (bill/company/branch/tenant/accYear/lineNo/priceLevel) and the
// four fields required for a new line (sbiItemId, sbiItemUnitId, sbiGodownId,
// sbiStockId) are set explicitly, so they are intentionally excluded here.
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
// Charge-line fields copied straight through when present on the payload. The
// scope keys (docType/docId/comp/branch/accYear/slno) and the two required
// references (cdChgId / cdLedgerCode) are set explicitly, so they are
// intentionally excluded here.
const BILL_CHARGE_OPTIONAL_FIELDS = [
  'cdChgName',
  'cdRole',
  'cdMethod',
  'cdType',
  'cdApplyOn',
  'cdLandingCost',
  'cdCostAlloc',
  'cdBeforeTax',
  'cdTaxApl',
  'cdSepPost',
  'cdUnit',
  'cdQtyVal',
  'cdWeight',
  'cdRate',
  'cdAmount',
  'cdTaxCode',
  'cdHsn',
  'cdTaxPerc',
  'cdTaxAmt',
  'cdSgstPerc',
  'cdSgstAmt',
  'cdCgstPerc',
  'cdCgstAmt',
  'cdIgstPerc',
  'cdIgstAmt',
  'cdCessPerc',
  'cdCessAmt',
  'cdNetAmt',
  'cdRemarks',
  'cdIsActive',
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
// The immutable scope inherited by every line from its parent bill.
interface BillScope {
  sbId: string;
  sbCompanyId: string;
  sbBranchId: string;
  sbTenantId: string | null;
  sbAccYear: string;
  sbPriceLevel: number;
  sbBillSlno: bigint;
}
type BillWriteClient = SalesWriteClient;
// Only populated when the item was fetched with the item/unit joins (getById);
// create/update paths pass plain SaleBillItem rows where these are absent.
type SaleBillItemWithNames = SaleBillItem & {
  item?: {
    itemNameEn: string;
    itemBatchConfig: number;
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
                itemBatchConfig: true,
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
    // charges are fetched by discriminator rather than by `include`.
    const charges = await this.findCharges(this.prisma, sbId);
    return this.toPayload({ ...record, charges });
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
      await tx.saleChargeDetail.updateMany({
        where: {
          cdDocType: BILL_CHARGE_DOC_TYPE,
          cdDocId: sbId,
          cdIsDeleted: false,
        },
        data: {
          cdIsDeleted: true,
          cdModifiedOn: modifiedOn,
          cdModifiedBy: actor,
        },
      });
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
        const data: Prisma.SaleBillUncheckedCreateInput = {
          sbCompanyId: saveBillDto.sbCompanyId,
          sbBranchId: saveBillDto.sbBranchId,
          sbTenantId: saveBillDto.sbTenantId,
          sbAccYear: saveBillDto.sbAccYear,
          sbCounterId: saveBillDto.sbCounterId,
          sbDeviceType: saveBillDto.sbDeviceType,
          sbDeviceId: saveBillDto.sbDeviceId,
          sbPriceLevel: saveBillDto.sbPriceLevel,
          // Counter-owned document number: taken from the payload, not allocated
          // from a server sequence — see the README's "Bill numbering" section.
          sbBillSlno: this.toBillSlno(saveBillDto.sbBillSlno),
          sbBillRefno: normalizeRequiredText<BillErrorDetail, BillErrorResponse>(
            saveBillDto.sbBillRefno ?? '',
            'sbBillRefno',
          ),
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
        };
        const items = await this.syncItems(tx, scope, saveBillDto.items, createdBy);
        const charges = await this.syncCharges(tx, scope, saveBillDto.charges, createdBy);
        const payload = this.toPayload({ ...created, items, charges });
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
        };
        const items = await this.syncItems(tx, scope, saveBillDto.items, modifiedBy);
        const charges = await this.syncCharges(tx, scope, saveBillDto.charges, modifiedBy);
        const payload = this.toPayload({ ...updated, items, charges });
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
        sbiStockId: this.requireItemField(inputItem.sbiStockId, 'sbiStockId'),
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
  // the counter that raises the document is trusted to keep its own series
  // unique (see the README) — so the only realistic P2002 source is the
  // partition-aware primary key itself, which should not happen given sbId /
  // sbiId are uuidv7-generated.
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
  // The bill's applied charges, in reconciliation order (cdSlno). No relation
  // exists to follow: sale_charge_detail is keyed by the (cdDocType, cdDocId)
  // discriminator pair, which is also its only index.
  private findCharges(client: BillWriteClient, sbId: string): Promise<SaleChargeDetail[]> {
    return client.saleChargeDetail.findMany({
      where: {
        cdDocType: BILL_CHARGE_DOC_TYPE,
        cdDocId: sbId,
        cdIsDeleted: false,
      },
      orderBy: { cdSlno: 'asc' },
    });
  }
  // Reconciles the bill's applied charges with the payload array, exactly as
  // syncItems does for the line items:
  //   - a charge carrying cdId updates that existing charge line
  //   - a charge without cdId is created
  //   - an existing charge absent from the array is soft deleted
  // Passing `undefined` (property omitted) leaves the current charges untouched.
  private async syncCharges(
    tx: BillWriteClient,
    scope: BillScope,
    inputCharges: SaveBillChargeDto[] | undefined,
    actorId: string,
  ): Promise<SaleChargeDetail[]> {
    const existing = await this.findCharges(tx, scope.sbId);
    if (inputCharges === undefined) {
      return existing;
    }
    const existingMap = new Map(existing.map((charge) => [charge.cdId, charge]));
    const keptIds = new Set<string>();
    const seenSlnos = new Set<number>();
    const now = new Date();
    const persisted: SaleChargeDetail[] = [];
    for (const [index, inputCharge] of inputCharges.entries()) {
      const slno = inputCharge.cdSlno ?? index + 1;
      if (seenSlnos.has(slno)) {
        throwSalesConflict<BillErrorDetail, BillErrorResponse>(
          'Duplicate bill charge line number is not allowed',
          [
            {
              field: 'cdSlno',
              message: `A bill charge already exists with line number ${slno}`,
            },
          ],
        );
      }
      seenSlnos.add(slno);
      const existingCharge = inputCharge.cdId ? existingMap.get(inputCharge.cdId) : undefined;
      if (inputCharge.cdId && !existingCharge) {
        throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
          'Bill charge not found',
          'cdId',
          `No active bill charge found with id ${inputCharge.cdId} on this bill`,
        );
      }
      this.ensureChargeValuesAreAllowed(inputCharge, existingCharge);
      if (existingCharge) {
        const updateData: Prisma.SaleChargeDetailUncheckedUpdateInput = {
          cdSlno: slno,
          cdChgId: inputCharge.cdChgId ?? existingCharge.cdChgId,
          cdLedgerCode: inputCharge.cdLedgerCode ?? existingCharge.cdLedgerCode,
          cdModifiedOn: now,
          cdModifiedBy: resolveActor(inputCharge.cdModifiedBy, actorId),
        };
        applyPresentFields(updateData, inputCharge, BILL_CHARGE_OPTIONAL_FIELDS);
        if (inputCharge.cdVoucherNo !== undefined) {
          updateData.cdVoucherNo = this.toVoucherNo(inputCharge.cdVoucherNo);
        }
        const updated = await tx.saleChargeDetail.update({
          where: { cdId: existingCharge.cdId },
          data: updateData,
        });
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: BILL_CHARGE_TABLE_NAME,
            screenName: BILL_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: updated.cdId,
            displayName: updated.cdChgName || `Charge ${updated.cdSlno ?? slno}`,
            originalRecord: this.toChargePayload(existingCharge),
            modifiedRecord: this.toChargePayload(updated),
            userId: resolveActor(inputCharge.cdModifiedBy, actorId),
            notes: 'Bill charge updated',
          },
          tx,
        );
        keptIds.add(updated.cdId);
        persisted.push(updated);
        continue;
      }
      const createData: Prisma.SaleChargeDetailUncheckedCreateInput = {
        cdDocType: BILL_CHARGE_DOC_TYPE,
        cdDocId: scope.sbId,
        cdSlno: slno,
        cdCompId: inputCharge.cdCompId ?? scope.sbCompanyId,
        cdBranchId: inputCharge.cdBranchId ?? scope.sbBranchId,
        cdAccYear: inputCharge.cdAccYear ?? scope.sbAccYear,
        cdVoucherNo:
          inputCharge.cdVoucherNo === undefined
            ? scope.sbBillSlno
            : this.toVoucherNo(inputCharge.cdVoucherNo),
        cdChgId: this.requireChargeField(inputCharge.cdChgId, 'cdChgId'),
        cdLedgerCode: this.requireChargeField(inputCharge.cdLedgerCode, 'cdLedgerCode'),
        cdCreatedOn: now,
        cdCreatedBy: resolveActor(inputCharge.cdCreatedBy, actorId),
      };
      applyPresentFields(createData, inputCharge, BILL_CHARGE_OPTIONAL_FIELDS);
      const created = await tx.saleChargeDetail.create({ data: createData });
      await this.auditLogService.logEntityChange(
        {
          action: 'New',
          tableName: BILL_CHARGE_TABLE_NAME,
          screenName: BILL_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: created.cdId,
          displayName: created.cdChgName || `Charge ${created.cdSlno ?? slno}`,
          originalRecord: null,
          modifiedRecord: this.toChargePayload(created),
          userId: created.cdCreatedBy ?? actorId,
          notes: 'Bill charge created',
        },
        tx,
      );
      keptIds.add(created.cdId);
      persisted.push(created);
    }
    // Any previously active charge not present in the payload is soft deleted.
    const removed = existing.filter((charge) => !keptIds.has(charge.cdId));
    for (const removedCharge of removed) {
      const deleted = await tx.saleChargeDetail.update({
        where: { cdId: removedCharge.cdId },
        data: {
          cdIsDeleted: true,
          cdModifiedOn: now,
          cdModifiedBy: actorId,
        },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: BILL_CHARGE_TABLE_NAME,
          screenName: BILL_AUDIT_SCREEN_NAME,
          screenType: 'transaction',
          pk: deleted.cdId,
          displayName: removedCharge.cdChgName || `Charge ${removedCharge.cdSlno ?? ''}`.trim(),
          originalRecord: this.toChargePayload(removedCharge),
          modifiedRecord: this.toChargePayload(deleted),
          userId: actorId,
          notes: 'Bill charge soft deleted',
        },
        tx,
      );
    }
    return persisted.sort((left, right) => (left.cdSlno ?? 0) - (right.cdSlno ?? 0));
  }
  private requireChargeField(value: string | undefined, field: string): string {
    if (!value) {
      throwSalesNotFound<BillErrorDetail, BillErrorResponse>(
        `${field} is required for a new bill charge`,
        field,
        `${field} must be provided when creating a bill charge`,
      );
    }
    return value;
  }
  // cd_voucher_no is a bigint column but JSON carries it as a number/string.
  private toVoucherNo(value: string | number | null): bigint | null {
    if (value === null || value === '') {
      return null;
    }
    return BigInt(value);
  }
  // sb_bill_slno is a bigint column, required and client-supplied — see the
  // README's "Bill numbering" section.
  private toBillSlno(value: string | number): bigint {
    try {
      return BigInt(value);
    } catch {
      return throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Validation failed', [
        { field: 'sbBillSlno', message: 'sbBillSlno must be a valid integer' },
      ]);
    }
  }
  // Mirrors the DB CHECK constraints on sale_charge_detail (ck_cd_doc_type /
  // ck_cd_type / ck_cd_method / ck_cd_apply_on / ck_cd_cost_alloc, migration
  // 20260728140000, plus ck_cd_tax_apl from 20260728130000) so a bad value comes
  // back as a 400 with the offending field instead of a raw Postgres 23514.
  // cdDocType is set by the service, not the payload, so only the snapshot
  // columns are read off the request; on update the stored row supplies the
  // values the payload did not send, since the constraint judges the merged row.
  private ensureChargeValuesAreAllowed(
    inputCharge: SaveBillChargeDto,
    existingCharge: SaleChargeDetail | undefined,
  ): void {
    const values: ChargeDetailGuardedValues = {
      cdDocType: BILL_CHARGE_DOC_TYPE,
      cdRole: inputCharge.cdRole,
      cdMethod: inputCharge.cdMethod,
      cdType: inputCharge.cdType,
      cdApplyOn: inputCharge.cdApplyOn,
      cdCostAlloc: inputCharge.cdCostAlloc,
    };
    const details: BillErrorDetail[] = [];
    for (const guard of CHARGE_DETAIL_VALUE_GUARDS) {
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
    const taxApl = inputCharge.cdTaxApl ?? existingCharge?.cdTaxApl ?? false;
    const beforeTax = inputCharge.cdBeforeTax ?? existingCharge?.cdBeforeTax ?? false;
    if (taxApl && beforeTax) {
      details.push({
        field: 'cdTaxApl',
        message:
          'cdTaxApl and cdBeforeTax are mutually exclusive: a charge is either taxed at the item rate or carries its own GST',
      });
    }
    if (details.length > 0) {
      throwSalesBadRequest<BillErrorDetail, BillErrorResponse>(
        'Invalid bill charge value',
        details,
      );
    }
  }
  private applyOptionalFields(
    data: Prisma.SaleBillUncheckedCreateInput | Prisma.SaleBillUncheckedUpdateInput,
    dto: SaveBillDto,
  ): void {
    applyPresentFields(data, dto, BILL_OPTIONAL_FIELDS, BILL_DATE_TRANSFORMS);
  }
  private toPayload(
    record: SaleBill & {
      items?: SaleBillItemWithNames[];
      charges?: SaleChargeDetail[];
    },
  ): BillPayload {
    const {
      sbCreatedOn,
      sbModifiedOn,
      sbBillDatetime,
      sbSyncDate,
      sbBillSlno,
      items,
      charges,
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
      sbBillSlno: sbBillSlno.toString(),
      items: items ? items.map((item) => this.toItemPayload(item)) : [],
      charges: charges ? charges.map((charge) => this.toChargePayload(charge)) : [],
    };
  }
  private toChargePayload(record: SaleChargeDetail): BillChargePayload {
    const { cdCreatedOn, cdModifiedOn, cdSyncDate, cdVoucherNo, ...rest } = record;
    return {
      ...rest,
      cdCreatedOn: cdCreatedOn?.toISOString(),
      cdModifiedOn: cdModifiedOn?.toISOString() ?? null,
      cdSyncDate: cdSyncDate?.toISOString() ?? null,
      cdVoucherNo: cdVoucherNo?.toString() ?? null,
    };
  }
  private toItemPayload(record: SaleBillItemWithNames): BillItemPayload {
    const { sbiCreatedOn, sbiModifiedOn, sbiSyncDate, item, itemUnitConversion, ...rest } = record;
    return {
      ...rest,
      sbiCreatedOn: sbiCreatedOn?.toISOString(),
      sbiModifiedOn: sbiModifiedOn?.toISOString() ?? null,
      sbiSyncDate: sbiSyncDate?.toISOString() ?? null,
      sbiItemName: item?.itemNameEn ?? null,
      sbiUnitName: itemUnitConversion?.unit.unit_name ?? null,
      sbiDecimalCount: itemUnitConversion?.unit.unit_decimal_count ?? null,
      sbiBatchConfig: item?.itemBatchConfig ?? null,
      sbiGroupId: item?.itemGroupId ?? null,
      sbiBrandId: item?.itemBrandId ?? null,
      sbiSectionId: item?.itemSectionId ?? null,
      sbiCategoryId: item?.itemCategoryId ?? null,
    };
  }
}
