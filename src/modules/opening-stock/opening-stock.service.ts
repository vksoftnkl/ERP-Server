import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeviceType,
  OpeningStockDetail,
  OpeningStockDetailCessType,
  OpeningStockDetailTrackingType,
  OpeningStockDeviceType,
  OpeningStockHeader,
  OpeningStockStatus,
  Prisma,
  VoucherStatus,
} from '@prisma/client';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  createAccountVoucherHeader,
  CreateAccountVoucherHeaderPayload,
  softDeleteAccountVoucherHeader,
  updateAccountVoucherHeader,
  UpdateAccountVoucherHeaderPayload,
} from '../accountsModule/accountVoucherHeader/account-voucher-header.helper';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListOpeningStockQueryDto } from './dto/list-opening-stock-query.dto';
import {
  OpeningStockDetailLineDto,
  OpeningStockHeaderInputDto,
  SaveOpeningStockDto,
} from './dto/save-opening-stock.dto';
import {
  OpeningStockDocumentPayload,
  OpeningStockErrorDetail,
  OpeningStockHeaderPayload,
  OpeningStockListItem,
  OpeningStockListMeta,
  OpeningStockSuccessResponse,
  OpeningStockDetailPayload,
} from './types/opening-stock-api.types';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const VALIDATION_FAILED_MESSAGE = 'Validation failed';
const OPENING_STOCK_HEADER_TABLE_NAME = 'opening_stock_header';
const OPENING_STOCK_AUDIT_SCREEN_NAME = 'Opening Stock';
type OpeningStockWriteClient = Prisma.TransactionClient | PrismaService;
type OpeningStockHeaderWithVoucher = Prisma.OpeningStockHeaderGetPayload<{
  include: {
    voucherHeader: true;
  };
}>;
type DetailLookupMaps = {
  itemsById: Map<string, { itemCode: string | null; itemNameEn: string | null }>;
  unitsById: Map<string, { unit_name: string }>;
  baseUomPricesById: Map<string, { baseUomName: string | null }>;
  godownsById: Map<string, { gdlName: string }>;
  taxesById: Map<string, { taxName: string }>;
};
type ResolvedHeaderContext = {
  accYear: string;
  companyId: string;
  branchId: string;
  actorUserId: string;
  voucherUserId: string;
  openingUserId: string;
  sessionId: string | null;
  deviceId: string | null;
  counterId: string;
  voucherDeviceType: DeviceType;
  openingDeviceType: OpeningStockDeviceType;
  status: OpeningStockStatus;
};
type NormalizedDetailLine = {
  oslBarcode: string | null;
  oslItemId: string;
  oslUnitId: string;
  oslBaseUomId: string | null;
  oslGodownId: string;
  oslTrackingType: OpeningStockDetailTrackingType;
  oslTaxId: string | null;
  oslTaxPerc: number;
  oslCessType: OpeningStockDetailCessType;
  oslCessPerc: number;
  oslCessPerUnit: number;
  oslQty: number;
  oslFreeQty: number;
  oslBaseQty: number;
  oslConvFactor: number;
  oslBatchNo: string | null;
  oslSerialNo: string | null;
  oslBatchDate: Date | null;
  oslMfgDate: Date | null;
  oslExpiryDate: Date | null;
  oslCostRate: number;
  oslCostRateWot: number;
  oslStockValue: number;
  oslStockValueWot: number;
  oslSaleRateAWot: number;
  oslMarkupPercA: number;
  oslSaleRateA: number;
  oslSaleRateBWot: number;
  oslMarkupPercB: number;
  oslSaleRateB: number;
  oslSaleRateCWot: number;
  oslMarkupPercC: number;
  oslSaleRateC: number;
  oslSaleRateDWot: number;
  oslMarkupPercD: number;
  oslSaleRateD: number;
  oslMrpRate: number;
  oslMinRate: number;
  oslRemarks: string | null;
};
@Injectable()
export class OpeningStockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveOpeningStockDto: SaveOpeningStockDto): Promise<OpeningStockDocumentPayload> {
    if (saveOpeningStockDto.header.avh_voucher_id) {
      return this.updateOpeningStock(saveOpeningStockDto);
    }
    return this.createOpeningStock(saveOpeningStockDto);
  }
  async getList(
    queryDto: ListOpeningStockQueryDto,
  ): Promise<{ items: OpeningStockListItem[]; meta: OpeningStockListMeta }> {
    return this.list(queryDto);
  }
  async list(
    queryDto: ListOpeningStockQueryDto,
  ): Promise<{ items: OpeningStockListItem[]; meta: OpeningStockListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const where = this.buildListWhere(queryDto);
    const [total, records] = await Promise.all([
      this.prisma.openingStockHeader.count({ where }),
      this.prisma.openingStockHeader.findMany({
        where,
        include: {
          voucherHeader: true,
        },
        orderBy: [{ oshVoucherDate: 'desc' }, { oshVoucherNo: 'desc' }, { oshId: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return {
      items: records.map((record) => this.toHeaderPayload(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }
  async getByVoucherId(avhVoucherId: string): Promise<OpeningStockDocumentPayload> {
    return this.buildDocumentPayloadByVoucherId(this.prisma, avhVoucherId);
  }
  async softDelete(avhVoucherId: string): Promise<{ avh_voucher_id: string; deleted: true }> {
    const actorUserId = this.resolveActorUserId();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingDocument = await this.buildDocumentPayloadByVoucherId(tx, avhVoucherId);
        const existingHeader = await this.getActiveHeaderByVoucherIdOrThrow(tx, avhVoucherId);
        const now = new Date();
        await softDeleteAccountVoucherHeader(tx, avhVoucherId, {
          avhUpdatedBy: actorUserId,
          avhStatusBy: actorUserId,
          avhCancelReason: 'Opening stock cancelled',
        });
        await tx.openingStockHeader.update({
          where: {
            oshId: existingHeader.oshId,
          },
          data: {
            oshStatus: OpeningStockStatus.CANCELLED,
            oshIsActive: false,
            oshIsDeleted: true,
            oshUpdatedOn: now,
            oshUpdatedBy: actorUserId,
          },
        });
        await tx.openingStockDetail.updateMany({
          where: {
            oslVoucherId: avhVoucherId,
            oslIsDeleted: false,
          },
          data: {
            oslIsActive: false,
            oslIsDeleted: true,
            oslUpdatedOn: now,
            oslUpdatedBy: actorUserId,
          },
        });
        await this.auditLogService.logEntityChange(
          {
            action: 'cancel',
            tableName: OPENING_STOCK_HEADER_TABLE_NAME,
            screenName: OPENING_STOCK_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: avhVoucherId,
            displayName: this.buildDisplayName(existingDocument.header),
            originalRecord: existingDocument,
            modifiedRecord: {
              ...existingDocument,
              header: {
                ...existingDocument.header,
                osh_status: OpeningStockStatus.CANCELLED,
                osh_is_active: false,
                osh_is_deleted: true,
              },
            },
            userId: actorUserId,
            branchId: existingHeader.oshBranchId,
            notes: 'Opening stock deleted',
          },
          tx,
        );
        return {
          avh_voucher_id: avhVoucherId,
          deleted: true,
        };
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }
  private async createOpeningStock(
    saveOpeningStockDto: SaveOpeningStockDto,
  ): Promise<OpeningStockDocumentPayload> {
    this.ensureDetailsPresent(saveOpeningStockDto.details);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const context = this.resolveHeaderContext(saveOpeningStockDto.header);
        const normalizedDetails = this.normalizeDetailLines(saveOpeningStockDto.details);
        await this.validateHeaderReferences(tx, saveOpeningStockDto.header, context);
        await this.validateDetailReferences(tx, normalizedDetails);
        const voucherHeader = await createAccountVoucherHeader(
          tx,
          this.buildCreateVoucherPayload(saveOpeningStockDto.header, context),
        );
        const now = new Date();
        const totals = this.resolveHeaderTotals(saveOpeningStockDto.header);
        const voucherDate = this.parseRequiredDate(
          saveOpeningStockDto.header.osh_voucher_date,
          'osh_voucher_date',
        );
        const openingHeader = await tx.openingStockHeader.create({
          data: {
            oshVoucherId: voucherHeader.avhVoucherId,
            oshAccYear: context.accYear,
            oshCompanyId: context.companyId,
            oshBranchId: context.branchId,
            oshVoucherNo: voucherHeader.avhVoucherNo,
            oshVoucherDate: voucherDate,
            oshRefNo: saveOpeningStockDto.header.osh_ref_no ?? null,
            oshNarration: saveOpeningStockDto.header.osh_narration ?? null,
            oshTotalLines: totals.totalLines,
            oshTotalQty: totals.totalQty,
            oshTotalValue: totals.totalValue,
            oshStatus: context.status,
            oshUserId: context.openingUserId,
            oshSessionId: context.sessionId,
            oshDeviceType: context.openingDeviceType,
            oshDeviceId: context.deviceId,
            oshCounterId: context.counterId,
            oshCreatedOn: now,
            oshCreatedBy: context.actorUserId,
          },
        });
        await tx.openingStockDetail.createMany({
          data: normalizedDetails.map((detail, index) =>
            this.buildDetailCreateInput(
              detail,
              index + 1,
              openingHeader.oshId,
              voucherHeader.avhVoucherId,
              context,
              now,
            ),
          ),
        });
        const payload = await this.buildDocumentPayloadByVoucherId(tx, voucherHeader.avhVoucherId);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: OPENING_STOCK_HEADER_TABLE_NAME,
            screenName: OPENING_STOCK_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: voucherHeader.avhVoucherId,
            displayName: this.buildDisplayName(payload.header),
            originalRecord: null,
            modifiedRecord: payload,
            userId: context.actorUserId,
            branchId: context.branchId,
            notes: 'Opening stock created',
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
  private async updateOpeningStock(
    saveOpeningStockDto: SaveOpeningStockDto,
  ): Promise<OpeningStockDocumentPayload> {
    this.ensureDetailsPresent(saveOpeningStockDto.details);
    const avhVoucherId = saveOpeningStockDto.header.avh_voucher_id;
    if (!avhVoucherId) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'avh_voucher_id',
          message: 'avh_voucher_id is required for update',
        },
      ]);
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingHeader = await this.getActiveHeaderByVoucherIdOrThrow(tx, avhVoucherId);
        const existingDocument = await this.buildDocumentPayloadByVoucherId(tx, avhVoucherId);
        const context = this.resolveHeaderContext(saveOpeningStockDto.header);
        const normalizedDetails = this.normalizeDetailLines(saveOpeningStockDto.details);
        await this.validateHeaderReferences(tx, saveOpeningStockDto.header, context);
        await this.validateDetailReferences(tx, normalizedDetails);
        const voucherHeader = await updateAccountVoucherHeader(
          tx,
          avhVoucherId,
          this.buildUpdateVoucherPayload(saveOpeningStockDto.header, context),
        );
        const now = new Date();
        const totals = this.resolveHeaderTotals(saveOpeningStockDto.header);
        const voucherDate = this.parseRequiredDate(
          saveOpeningStockDto.header.osh_voucher_date,
          'osh_voucher_date',
        );
        await tx.openingStockHeader.update({
          where: {
            oshId: existingHeader.oshId,
          },
          data: {
            oshAccYear: context.accYear,
            oshCompanyId: context.companyId,
            oshBranchId: context.branchId,
            oshVoucherNo: voucherHeader.avhVoucherNo,
            oshVoucherDate: voucherDate,
            oshRefNo: saveOpeningStockDto.header.osh_ref_no ?? null,
            oshNarration: saveOpeningStockDto.header.osh_narration ?? null,
            oshTotalLines: totals.totalLines,
            oshTotalQty: totals.totalQty,
            oshTotalValue: totals.totalValue,
            oshStatus: context.status,
            oshUserId: context.openingUserId,
            oshSessionId: context.sessionId,
            oshDeviceType: context.openingDeviceType,
            oshDeviceId: context.deviceId,
            oshCounterId: context.counterId,
            oshUpdatedOn: now,
            oshUpdatedBy: context.actorUserId,
          },
        });
        await tx.openingStockDetail.deleteMany({
          where: {
            oslVoucherId: avhVoucherId,
          },
        });
        await tx.openingStockDetail.createMany({
          data: normalizedDetails.map((detail, index) =>
            this.buildDetailCreateInput(
              detail,
              index + 1,
              existingHeader.oshId,
              avhVoucherId,
              context,
              now,
            ),
          ),
        });
        const payload = await this.buildDocumentPayloadByVoucherId(tx, avhVoucherId);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: OPENING_STOCK_HEADER_TABLE_NAME,
            screenName: OPENING_STOCK_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: avhVoucherId,
            displayName: this.buildDisplayName(payload.header),
            originalRecord: existingDocument,
            modifiedRecord: payload,
            userId: context.actorUserId,
            branchId: context.branchId,
            notes: 'Opening stock updated',
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
  private resolveHeaderContext(header: OpeningStockHeaderInputDto): ResolvedHeaderContext {
    const requestUserId = this.requestContextService.getUserId();
    const actorUserId = header.osh_user_id ?? requestUserId;
    if (!actorUserId) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'osh_user_id',
          message: 'Authenticated user context or osh_user_id is required',
        },
      ]);
    }
    return {
      accYear: header.osh_acc_year,
      companyId: header.osh_company_id,
      branchId: header.osh_branch_id,
      actorUserId,
      voucherUserId: actorUserId,
      openingUserId: actorUserId,
      sessionId: header.osh_session_id ?? null,
      deviceId: header.osh_device_id ?? null,
      counterId: header.osh_counter_id,
      voucherDeviceType: header.osh_device_type,
      openingDeviceType: this.mapDeviceType(header.osh_device_type),
      status: header.osh_status ?? OpeningStockStatus.DRAFT,
    };
  }
  private buildCreateVoucherPayload(
    header: OpeningStockHeaderInputDto,
    context: ResolvedHeaderContext,
  ): CreateAccountVoucherHeaderPayload {
    return {
      avhAccYear: context.accYear,
      avhCompanyId: context.companyId,
      avhBranchId: context.branchId,
      avhVoucherTypeId: this.resolveVoucherTypeId(header),
      avhVoucherDate: this.parseRequiredDate(header.osh_voucher_date, 'osh_voucher_date'),
      avhUserRefno: null,
      avhBillDate: this.parseNullableDate(header.avh_bill_date, 'avh_bill_date'),
      avhPartyId: header.avh_party_id,
      avhOppositeLedgerId: header.avh_opposite_ledger_id ?? null,
      avhEmployeeId: header.avh_employee_id ?? [],
      avhPayNotes: null,
      avhRemarks: null,
      avhVoucherStatus: this.mapOpeningStatusToVoucherStatus(context.status),
      avhUserId: context.voucherUserId,
      avhSessionId: context.sessionId,
      avhDeviceType: context.voucherDeviceType,
      avhDeviceId: context.deviceId,
      avhCounterId: context.counterId,
      avhCreatedBy: context.actorUserId,
      avhStatusBy: context.actorUserId,
    };
  }
  private buildUpdateVoucherPayload(
    header: OpeningStockHeaderInputDto,
    context: ResolvedHeaderContext,
  ): UpdateAccountVoucherHeaderPayload {
    return {
      avhAccYear: context.accYear,
      avhCompanyId: context.companyId,
      avhBranchId: context.branchId,
      avhVoucherTypeId: this.resolveVoucherTypeId(header),
      avhVoucherDate: this.parseRequiredDate(header.osh_voucher_date, 'osh_voucher_date'),
      avhUserRefno: null,
      avhBillDate: this.parseNullableDate(header.avh_bill_date, 'avh_bill_date'),
      avhPartyId: header.avh_party_id,
      avhOppositeLedgerId: header.avh_opposite_ledger_id ?? null,
      avhEmployeeId: header.avh_employee_id ?? [],
      avhPayNotes: null,
      avhRemarks: null,
      avhVoucherStatus: this.mapOpeningStatusToVoucherStatus(context.status),
      avhUserId: context.voucherUserId,
      avhSessionId: context.sessionId,
      avhDeviceType: context.voucherDeviceType,
      avhDeviceId: context.deviceId,
      avhCounterId: context.counterId,
      avhUpdatedBy: context.actorUserId,
      avhStatusBy: context.actorUserId,
    };
  }
  private normalizeDetailLines(details: OpeningStockDetailLineDto[]): NormalizedDetailLine[] {
    return details.map((detail) => {
      const qty = detail.osl_qty;
      const convFactor = detail.osl_conv_factor ?? 1;
      const baseQty = detail.osl_base_qty ?? qty * convFactor;
      const costRate = detail.osl_cost_rate ?? 0;
      const costRateWot = detail.osl_cost_rate_wot ?? 0;
      return {
        oslBarcode: detail.osl_barcode ?? null,
        oslItemId: detail.osl_item_id,
        oslUnitId: detail.osl_unit_id,
        oslBaseUomId: detail.osl_base_uom_id ?? null,
        oslGodownId: detail.osl_godown_id,
        oslTrackingType: detail.osl_tracking_type ?? OpeningStockDetailTrackingType.NONE,
        oslTaxId: detail.osl_tax_id ?? null,
        oslTaxPerc: detail.osl_tax_perc ?? 0,
        oslCessType: detail.osl_cess_type ?? OpeningStockDetailCessType.NONE,
        oslCessPerc: detail.osl_cess_perc ?? 0,
        oslCessPerUnit: detail.osl_cess_per_unit ?? 0,
        oslQty: qty,
        oslFreeQty: detail.osl_free_qty ?? 0,
        oslBaseQty: baseQty,
        oslConvFactor: convFactor,
        oslBatchNo: detail.osl_batch_no ?? null,
        oslSerialNo: detail.osl_serial_no ?? null,
        oslBatchDate: this.parseNullableDate(detail.osl_batch_date, 'osl_batch_date'),
        oslMfgDate: this.parseNullableDate(detail.osl_mfg_date, 'osl_mfg_date'),
        oslExpiryDate: this.parseNullableDate(detail.osl_expiry_date, 'osl_expiry_date'),
        oslCostRate: costRate,
        oslCostRateWot: costRateWot,
        oslStockValue: this.roundAmount(qty * costRate),
        oslStockValueWot: this.roundAmount(qty * costRateWot),
        oslSaleRateAWot: detail.osl_sale_rate_a_wot ?? 0,
        oslMarkupPercA: detail.osl_markup_perc_a ?? 0,
        oslSaleRateA: detail.osl_sale_rate_a ?? 0,
        oslSaleRateBWot: detail.osl_sale_rate_b_wot ?? 0,
        oslMarkupPercB: detail.osl_markup_perc_b ?? 0,
        oslSaleRateB: detail.osl_sale_rate_b ?? 0,
        oslSaleRateCWot: detail.osl_sale_rate_c_wot ?? 0,
        oslMarkupPercC: detail.osl_markup_perc_c ?? 0,
        oslSaleRateC: detail.osl_sale_rate_c ?? 0,
        oslSaleRateDWot: detail.osl_sale_rate_d_wot ?? 0,
        oslMarkupPercD: detail.osl_markup_perc_d ?? 0,
        oslSaleRateD: detail.osl_sale_rate_d ?? 0,
        oslMrpRate: detail.osl_mrp_rate ?? 0,
        oslMinRate: detail.osl_min_rate ?? 0,
        oslRemarks: detail.osl_remarks ?? null,
      };
    });
  }
  private resolveVoucherTypeId(header: OpeningStockHeaderInputDto): number {
    const voucherTypeId =
      header.avh_voucher_type_id ?? header.vchr_type_id ?? header.voucher_type_id;
    if (
      typeof voucherTypeId !== 'number' ||
      !Number.isInteger(voucherTypeId) ||
      voucherTypeId <= 0
    ) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'avh_voucher_type_id',
          message:
            'avh_voucher_type_id, vchr_type_id, or voucher_type_id must be a positive integer',
        },
      ]);
    }
    return voucherTypeId;
  }
  private async validateHeaderReferences(
    tx: Prisma.TransactionClient,
    header: OpeningStockHeaderInputDto,
    context: ResolvedHeaderContext,
  ): Promise<void> {
    const [companies, branches, partyLedgers, oppositeLedgers, openingUsers] =
      await Promise.all([
        tx.company.findMany({
          where: {
            compId: { in: [context.companyId] },
            compIsDeleted: false,
          },
          select: {
            compId: true,
          },
        }),
        tx.branchMaster.findMany({
          where: {
            brId: { in: [context.branchId] },
            compId: context.companyId,
            brIsDeleted: false,
          },
          select: {
            brId: true,
          },
        }),
        tx.accLedgerMaster.findMany({
          where: {
            ledId: { in: [header.avh_party_id] },
            ledIsDeleted: false,
          },
          select: {
            ledId: true,
          },
        }),
        header.avh_opposite_ledger_id
          ? tx.accLedgerMaster.findMany({
              where: {
                ledId: { in: [header.avh_opposite_ledger_id] },
                ledIsDeleted: false,
              },
              select: {
                ledId: true,
              },
            })
          : Promise.resolve([]),
        tx.user.findMany({
          where: {
            user_id: { in: [context.openingUserId] },
          },
          select: {
            user_id: true,
          },
        }),
      ]);

    this.throwMissingReferenceError('osh_company_id', [context.companyId], companies.map((record) => record.compId));
    this.throwMissingReferenceError('osh_branch_id', [context.branchId], branches.map((record) => record.brId));
    this.throwMissingReferenceError('avh_party_id', [header.avh_party_id], partyLedgers.map((record) => record.ledId));

    if (header.avh_opposite_ledger_id) {
      this.throwMissingReferenceError(
        'avh_opposite_ledger_id',
        [header.avh_opposite_ledger_id],
        oppositeLedgers.map((record) => record.ledId),
      );
    }

    this.throwMissingReferenceError(
      'osh_user_id',
      [context.openingUserId],
      openingUsers.map((record) => record.user_id),
    );
  }
  private async validateDetailReferences(
    tx: Prisma.TransactionClient,
    details: NormalizedDetailLine[],
  ): Promise<void> {
    const itemIds = this.uniqueIds(details.map((detail) => detail.oslItemId));
    const unitIds = this.uniqueIds(details.map((detail) => detail.oslUnitId));
    const baseUomIds = this.uniqueIds(
      details.map((detail) => detail.oslBaseUomId).filter((value): value is string => Boolean(value)),
    );
    const godownIds = this.uniqueIds(details.map((detail) => detail.oslGodownId));
    const taxIds = this.uniqueIds(
      details.map((detail) => detail.oslTaxId).filter((value): value is string => Boolean(value)),
    );
    const [items, units, baseUomPrices, godowns, taxes] = await Promise.all([
      itemIds.length
        ? tx.itemMaster.findMany({
            where: {
              itemId: { in: itemIds },
              itemIsDeleted: false,
            },
            select: {
              itemId: true,
            },
          })
        : Promise.resolve([]),
      unitIds.length
        ? tx.unit.findMany({
            where: {
              unit_id: { in: unitIds },
              unit_is_deleted: false,
            },
            select: {
              unit_id: true,
            },
          })
        : Promise.resolve([]),
      baseUomIds.length
        ? tx.itemPriceMaster.findMany({
            where: {
              ipmId: { in: baseUomIds },
              ipmIsDeleted: false,
            },
            select: {
              ipmId: true,
            },
          })
        : Promise.resolve([]),
      godownIds.length
        ? tx.godownLocation.findMany({
            where: {
              gdlId: { in: godownIds },
              gdlIsDeleted: false,
            },
            select: {
              gdlId: true,
            },
          })
        : Promise.resolve([]),
      taxIds.length
        ? tx.itemTaxMaster.findMany({
            where: {
              taxId: { in: taxIds },
              taxIsDeleted: false,
            },
            select: {
              taxId: true,
            },
          })
        : Promise.resolve([]),
    ]);
    this.throwMissingReferenceError('osl_item_id', itemIds, items.map((record) => record.itemId));
    this.throwMissingReferenceError('osl_unit_id', unitIds, units.map((record) => record.unit_id));
    this.throwMissingReferenceError(
      'osl_base_uom_id',
      baseUomIds,
      baseUomPrices.map((record) => record.ipmId),
    );
    this.throwMissingReferenceError(
      'osl_godown_id',
      godownIds,
      godowns.map((record) => record.gdlId),
    );
    this.throwMissingReferenceError('osl_tax_id', taxIds, taxes.map((record) => record.taxId));
  }
  private throwMissingReferenceError(
    field: string,
    requestedIds: string[],
    existingIds: string[],
  ): void {
    const existingSet = new Set(existingIds);
    const missingIds = requestedIds.filter((id) => !existingSet.has(id));
    if (missingIds.length === 0) {
      return;
    }
    this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
      {
        field,
        message: `Invalid ${field} reference: ${missingIds.join(', ')}`,
      },
    ]);
  }
  private resolveHeaderTotals(header: OpeningStockHeaderInputDto): {
    totalLines: number;
    totalQty: number;
    totalValue: number;
  } {
    return {
      totalLines: header.osh_total_lines ?? 0,
      totalQty: this.roundQuantity(header.osh_total_qty ?? 0),
      totalValue: this.roundAmount(header.osh_total_value ?? 0),
    };
  }
  private buildDetailCreateInput(
    detail: NormalizedDetailLine,
    lineNo: number,
    openingId: string,
    voucherId: string,
    context: ResolvedHeaderContext,
    now: Date,
  ): Prisma.OpeningStockDetailCreateManyInput {
    return {
      oslVoucherId: voucherId,
      oslOpeningId: openingId,
      oslLineNo: lineNo,
      oslAccYear: context.accYear,
      oslCompanyId: context.companyId,
      oslBranchId: context.branchId,
      oslItemId: detail.oslItemId,
      oslUnitId: detail.oslUnitId,
      oslBaseUomId: detail.oslBaseUomId,
      oslGodownId: detail.oslGodownId,
      oslTrackingType: detail.oslTrackingType,
      oslBarcode: detail.oslBarcode,
      oslBatchNo: detail.oslBatchNo,
      oslBatchDate: detail.oslBatchDate,
      oslMfgDate: detail.oslMfgDate,
      oslExpiryDate: detail.oslExpiryDate,
      oslSerialNo: detail.oslSerialNo,
      oslQty: detail.oslQty,
      oslBaseQty: detail.oslBaseQty,
      oslFreeQty: detail.oslFreeQty,
      oslConvFactor: detail.oslConvFactor,
      oslTaxId: detail.oslTaxId,
      oslTaxPerc: detail.oslTaxPerc,
      oslCessType: detail.oslCessType,
      oslCessPerc: detail.oslCessPerc,
      oslCessPerUnit: detail.oslCessPerUnit,
      oslCostRate: detail.oslCostRate,
      oslCostRateWot: detail.oslCostRateWot,
      oslStockValue: detail.oslStockValue,
      oslStockValueWot: detail.oslStockValueWot,
      oslMrpRate: detail.oslMrpRate,
      oslMinRate: detail.oslMinRate,
      oslSaleRateA: detail.oslSaleRateA,
      oslSaleRateB: detail.oslSaleRateB,
      oslSaleRateC: detail.oslSaleRateC,
      oslSaleRateD: detail.oslSaleRateD,
      oslSaleRateAWot: detail.oslSaleRateAWot,
      oslSaleRateBWot: detail.oslSaleRateBWot,
      oslSaleRateCWot: detail.oslSaleRateCWot,
      oslSaleRateDWot: detail.oslSaleRateDWot,
      oslMarkupPercA: detail.oslMarkupPercA,
      oslMarkupPercB: detail.oslMarkupPercB,
      oslMarkupPercC: detail.oslMarkupPercC,
      oslMarkupPercD: detail.oslMarkupPercD,
      oslRemarks: detail.oslRemarks,
      oslCreatedOn: now,
      oslCreatedBy: context.actorUserId,
    };
  }
  private buildListWhere(queryDto: ListOpeningStockQueryDto): Prisma.OpeningStockHeaderWhereInput {
    const where: Prisma.OpeningStockHeaderWhereInput = {
      oshIsDeleted: false,
    };
    if (queryDto.osh_acc_year) {
      where.oshAccYear = queryDto.osh_acc_year;
    }
    if (queryDto.osh_company_id) {
      where.oshCompanyId = queryDto.osh_company_id;
    }
    if (queryDto.osh_branch_id) {
      where.oshBranchId = queryDto.osh_branch_id;
    }
    if (queryDto.osh_status) {
      where.oshStatus = queryDto.osh_status;
    }
    const dateFrom = queryDto.date_from ? this.parseRequiredDate(queryDto.date_from, 'date_from') : null;
    const dateTo = queryDto.date_to ? this.parseRequiredDate(queryDto.date_to, 'date_to') : null;
    if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'date_from',
          message: 'date_from must be less than or equal to date_to',
        },
      ]);
    }
    if (dateFrom || dateTo) {
      where.oshVoucherDate = {};
      if (dateFrom) {
        where.oshVoucherDate.gte = dateFrom;
      }
      if (dateTo) {
        where.oshVoucherDate.lte = dateTo;
      }
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        {
          oshRefNo: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          oshNarration: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          voucherHeader: {
            is: {
              avhVoucherRefno: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          voucherHeader: {
            is: {
              avhBillRefno: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }
    return where;
  }
  private async buildDocumentPayloadByVoucherId(
    client: OpeningStockWriteClient,
    avhVoucherId: string,
  ): Promise<OpeningStockDocumentPayload> {
    const openingHeader = await this.getActiveHeaderByVoucherIdOrThrow(client, avhVoucherId);
    const details = await client.openingStockDetail.findMany({
      where: {
        oslVoucherId: avhVoucherId,
        oslIsDeleted: false,
      },
      orderBy: [{ oslLineNo: 'asc' }, { oslId: 'asc' }],
    });
    const lookups = await this.loadDetailLookups(client, details);
    return {
      header: this.toHeaderPayload(openingHeader),
      details: details.map((detail) => this.toDetailPayload(detail, lookups)),
    };
  }
  private async getActiveHeaderByVoucherIdOrThrow(
    client: OpeningStockWriteClient,
    avhVoucherId: string,
  ): Promise<OpeningStockHeaderWithVoucher> {
    const header = await client.openingStockHeader.findFirst({
      where: {
        oshVoucherId: avhVoucherId,
        oshIsDeleted: false,
      },
      include: {
        voucherHeader: true,
      },
    });
    if (!header) {
      this.throwNotFound(avhVoucherId);
    }
    return header;
  }
  private async loadDetailLookups(
    client: OpeningStockWriteClient,
    details: OpeningStockDetail[],
  ): Promise<DetailLookupMaps> {
    const itemIds = this.uniqueIds(details.map((detail) => detail.oslItemId));
    const unitIds = this.uniqueIds(details.map((detail) => detail.oslUnitId));
    const baseUomPriceIds = this.uniqueIds(
      details.map((detail) => detail.oslBaseUomId).filter((value): value is string => Boolean(value)),
    );
    const godownIds = this.uniqueIds(details.map((detail) => detail.oslGodownId));
    const taxIds = this.uniqueIds(
      details.map((detail) => detail.oslTaxId).filter((value): value is string => Boolean(value)),
    );
    const [items, units, baseUomPrices, godowns, taxes] = await Promise.all([
      itemIds.length
        ? client.itemMaster.findMany({
            where: {
              itemId: { in: itemIds },
            },
            select: {
              itemId: true,
              itemCode: true,
              itemNameEn: true,
            },
          })
        : Promise.resolve([]),
      unitIds.length
        ? client.unit.findMany({
            where: {
              unit_id: { in: unitIds },
            },
            select: {
              unit_id: true,
              unit_name: true,
            },
          })
        : Promise.resolve([]),
      baseUomPriceIds.length
        ? client.itemPriceMaster.findMany({
            where: {
              ipmId: { in: baseUomPriceIds },
            },
            select: {
              ipmId: true,
              unit: {
                select: {
                  unit_name: true,
                },
              },
              baseUnit: {
                select: {
                  unit_name: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      godownIds.length
        ? client.godownLocation.findMany({
            where: {
              gdlId: { in: godownIds },
            },
            select: {
              gdlId: true,
              gdlName: true,
            },
          })
        : Promise.resolve([]),
      taxIds.length
        ? client.itemTaxMaster.findMany({
            where: {
              taxId: { in: taxIds },
            },
            select: {
              taxId: true,
              taxName: true,
            },
          })
        : Promise.resolve([]),
    ]);
    return {
      itemsById: new Map(
        items.map((item) => [item.itemId, { itemCode: item.itemCode, itemNameEn: item.itemNameEn }]),
      ),
      unitsById: new Map(units.map((unit) => [unit.unit_id, { unit_name: unit.unit_name }])),
      baseUomPricesById: new Map(
        baseUomPrices.map((price) => [
          price.ipmId,
          {
            baseUomName: price.baseUnit?.unit_name ?? price.unit?.unit_name ?? null,
          },
        ]),
      ),
      godownsById: new Map(godowns.map((godown) => [godown.gdlId, { gdlName: godown.gdlName }])),
      taxesById: new Map(taxes.map((tax) => [tax.taxId, { taxName: tax.taxName }])),
    };
  }
  private toHeaderPayload(record: OpeningStockHeaderWithVoucher): OpeningStockHeaderPayload {
    return {
      avh_voucher_id: record.voucherHeader.avhVoucherId,
      avh_voucher_refno: record.voucherHeader.avhVoucherRefno,
      avh_voucher_type_id: record.voucherHeader.avhVoucherTypeId,
      avh_bill_refno: record.voucherHeader.avhBillRefno,
      avh_user_refno: record.voucherHeader.avhUserRefno,
      avh_bill_date: this.toNullableIsoString(record.voucherHeader.avhBillDate),
      avh_party_id: record.voucherHeader.avhPartyId,
      avh_opposite_ledger_id: record.voucherHeader.avhOppositeLedgerId,
      avh_employee_id: record.voucherHeader.avhEmployeeId,
      avh_pay_notes: record.voucherHeader.avhPayNotes,
      avh_remarks: record.voucherHeader.avhRemarks,
      avh_voucher_status: record.voucherHeader.avhVoucherStatus,
      avh_user_id: record.voucherHeader.avhUserId,
      avh_session_id: record.voucherHeader.avhSessionId,
      avh_device_type: record.voucherHeader.avhDeviceType,
      avh_device_id: record.voucherHeader.avhDeviceId,
      avh_counter_id: record.voucherHeader.avhCounterId,
      osh_id: record.oshId,
      osh_acc_year: record.oshAccYear,
      osh_company_id: record.oshCompanyId,
      osh_branch_id: record.oshBranchId,
      osh_voucher_no: record.oshVoucherNo.toString(),
      osh_voucher_date: record.oshVoucherDate.toISOString(),
      osh_ref_no: record.oshRefNo,
      osh_narration: record.oshNarration,
      osh_total_lines: record.oshTotalLines,
      osh_total_qty: this.toNumber(record.oshTotalQty),
      osh_total_value: this.toNumber(record.oshTotalValue),
      osh_status: record.oshStatus,
      osh_user_id: record.oshUserId,
      osh_session_id: record.oshSessionId,
      osh_device_type: record.oshDeviceType,
      osh_device_id: record.oshDeviceId,
      osh_counter_id: record.oshCounterId,
      osh_is_active: record.oshIsActive,
      osh_is_deleted: record.oshIsDeleted,
      osh_created_on: record.oshCreatedOn.toISOString(),
      osh_created_by: record.oshCreatedBy,
      osh_updated_on: this.toNullableIsoString(record.oshUpdatedOn),
      osh_updated_by: record.oshUpdatedBy,
    };
  }
  private toDetailPayload(
    record: OpeningStockDetail,
    lookups: DetailLookupMaps,
  ): OpeningStockDetailPayload {
    return {
      osl_id: record.oslId,
      osl_voucher_id: record.oslVoucherId,
      osl_opening_id: record.oslOpeningId,
      osl_line_no: record.oslLineNo,
      osl_acc_year: record.oslAccYear,
      osl_company_id: record.oslCompanyId,
      osl_branch_id: record.oslBranchId,
      osl_item_id: record.oslItemId,
      osl_item_code: lookups.itemsById.get(record.oslItemId)?.itemCode ?? null,
      osl_item_name: lookups.itemsById.get(record.oslItemId)?.itemNameEn ?? null,
      osl_unit_id: record.oslUnitId,
      osl_unit_name: lookups.unitsById.get(record.oslUnitId)?.unit_name ?? null,
      osl_base_uom_id: record.oslBaseUomId,
      osl_base_uom_name: record.oslBaseUomId
        ? lookups.baseUomPricesById.get(record.oslBaseUomId)?.baseUomName ?? null
        : null,
      osl_godown_id: record.oslGodownId,
      osl_godown_name: lookups.godownsById.get(record.oslGodownId)?.gdlName ?? null,
      osl_tracking_type: record.oslTrackingType,
      osl_barcode: record.oslBarcode,
      osl_batch_no: record.oslBatchNo,
      osl_batch_date: this.toNullableIsoString(record.oslBatchDate),
      osl_mfg_date: this.toNullableIsoString(record.oslMfgDate),
      osl_expiry_date: this.toNullableIsoString(record.oslExpiryDate),
      osl_serial_no: record.oslSerialNo,
      osl_qty: this.toNumber(record.oslQty),
      osl_base_qty: this.toNumber(record.oslBaseQty),
      osl_free_qty: this.toNumber(record.oslFreeQty),
      osl_conv_factor: this.toNumber(record.oslConvFactor),
      osl_tax_id: record.oslTaxId,
      osl_tax_name: record.oslTaxId ? lookups.taxesById.get(record.oslTaxId)?.taxName ?? null : null,
      osl_tax_perc: this.toNumber(record.oslTaxPerc),
      osl_cess_type: record.oslCessType,
      osl_cess_perc: this.toNumber(record.oslCessPerc),
      osl_cess_per_unit: this.toNumber(record.oslCessPerUnit),
      osl_cost_rate: this.toNumber(record.oslCostRate),
      osl_cost_rate_wot: this.toNumber(record.oslCostRateWot),
      osl_stock_value: this.toNumber(record.oslStockValue),
      osl_stock_value_wot: this.toNumber(record.oslStockValueWot),
      osl_sale_rate_a: this.toNumber(record.oslSaleRateA),
      osl_sale_rate_b: this.toNumber(record.oslSaleRateB),
      osl_sale_rate_c: this.toNumber(record.oslSaleRateC),
      osl_sale_rate_d: this.toNumber(record.oslSaleRateD),
      osl_sale_rate_a_wot: this.toNumber(record.oslSaleRateAWot),
      osl_sale_rate_b_wot: this.toNumber(record.oslSaleRateBWot),
      osl_sale_rate_c_wot: this.toNumber(record.oslSaleRateCWot),
      osl_sale_rate_d_wot: this.toNumber(record.oslSaleRateDWot),
      osl_markup_perc_a: this.toNumber(record.oslMarkupPercA),
      osl_markup_perc_b: this.toNumber(record.oslMarkupPercB),
      osl_markup_perc_c: this.toNumber(record.oslMarkupPercC),
      osl_markup_perc_d: this.toNumber(record.oslMarkupPercD),
      osl_mrp_rate: this.toNumber(record.oslMrpRate),
      osl_min_rate: this.toNumber(record.oslMinRate),
      osl_remarks: record.oslRemarks,
      osl_is_active: record.oslIsActive,
      osl_is_deleted: record.oslIsDeleted,
      osl_created_on: record.oslCreatedOn.toISOString(),
      osl_created_by: record.oslCreatedBy,
      osl_updated_on: this.toNullableIsoString(record.oslUpdatedOn),
      osl_updated_by: record.oslUpdatedBy,
    };
  }
  private buildDisplayName(header: OpeningStockHeaderPayload): string {
    return header.avh_voucher_refno || header.osh_voucher_no;
  }
  private mapOpeningStatusToVoucherStatus(status: OpeningStockStatus): VoucherStatus {
    return status as unknown as VoucherStatus;
  }
  private mapDeviceType(deviceType: DeviceType): OpeningStockDeviceType {
    return deviceType as unknown as OpeningStockDeviceType;
  }
  private parseRequiredDate(value: string, field: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field,
          message: `${field} must be a valid date`,
        },
      ]);
    }
    return parsed;
  }
  private parseNullableDate(value: string | null | undefined, field: string): Date | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    return this.parseRequiredDate(value, field);
  }
  private ensureDetailsPresent(details: OpeningStockDetailLineDto[]): void {
    if (!Array.isArray(details) || details.length === 0) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'details',
          message: 'At least one opening stock detail row is required',
        },
      ]);
    }
  }
  private resolveActorUserId(): string {
    const actorUserId = this.requestContextService.getUserId();
    if (!actorUserId) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'user_id',
          message: 'Authenticated user context is required',
        },
      ]);
    }
    return actorUserId;
  }
  private uniqueIds(values: string[]): string[] {
    return Array.from(new Set(values));
  }
  private toNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }
    return Number(value.toString());
  }
  private toNullableIsoString(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }
  private roundQuantity(value: number): number {
    return Number(value.toFixed(6));
  }
  private roundAmount(value: number): number {
    return Number(value.toFixed(2));
  }
  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Opening stock already exists', [
          {
            field: 'avh_voucher_id',
            message: 'Duplicate opening stock document is not allowed for the same voucher',
          },
        ]),
      );
    }
    if (this.isForeignKeyConstraintError(error)) {
      this.throwBadRequest(VALIDATION_FAILED_MESSAGE, [
        {
          field: 'request',
          message: 'Invalid foreign key reference in opening stock payload',
        },
      ]);
    }
  }
  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }
    return (error as { code?: string }).code === 'P2002';
  }
  private isForeignKeyConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }
    return (error as { code?: string }).code === 'P2003';
  }
  private throwNotFound(avhVoucherId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Opening stock document not found', [
        {
          field: 'avh_voucher_id',
          message: `No active opening stock document found with avh_voucher_id ${avhVoucherId}`,
        },
      ]),
    );
  }
  private throwBadRequest(message: string, errors: OpeningStockErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }
  private buildErrorResponse(
    message: string,
    errors: OpeningStockErrorDetail[] = [],
  ): OpeningStockSuccessResponse<never> | { success: false; message: string; errors: OpeningStockErrorDetail[] } {
    return {
      success: false,
      message,
      errors,
    };
  }
}
