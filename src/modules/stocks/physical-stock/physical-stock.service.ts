import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  CreatePhysicalStockBatchDetailDto,
  CreatePhysicalStockDetailDto,
  CreatePhysicalStockDto,
} from './dto/create-physical-stock.dto';
import { UpdatePhysicalStockDto } from './dto/update-physical-stock.dto';
import { PhysicalStockDocumentResponse } from './types/physical-stock-response.types';
const PHYSICAL_STOCK_DOCUMENT_INCLUDE = {
  details: {
    include: {
      batchDetails: {
        orderBy: {
          psbRowNo: 'asc',
        },
      },
    },
    orderBy: {
      psdRowNo: 'asc',
    },
  },
} satisfies Prisma.PhysicalStockHeaderInclude;
type PhysicalStockDocumentRecord = Prisma.PhysicalStockHeaderGetPayload<{
  include: typeof PHYSICAL_STOCK_DOCUMENT_INCLUDE;
}>;
type PhysicalStockWriteClient = Prisma.TransactionClient | PrismaService;
@Injectable()
export class PhysicalStockService {
  constructor(private readonly prisma: PrismaService) {}
  async create(
    createPhysicalStockDto: CreatePhysicalStockDto,
  ): Promise<PhysicalStockDocumentResponse> {
    return this.prisma.$transaction(async (tx) => {
      const header = await tx.physicalStockHeader.create({
        data: this.buildHeaderCreateInput(createPhysicalStockDto),
      });
      for (const [detailIndex, detailDto] of (createPhysicalStockDto.details ?? []).entries()) {
        const detail = await tx.physicalStockDetail.create({
          data: this.buildDetailCreateInput(
            detailDto,
            header.pscId,
            detailIndex + 1,
            createPhysicalStockDto,
          ),
        });
        for (const [batchIndex, batchDto] of (detailDto.batchDetails ?? []).entries()) {
          await tx.physicalStockBatchDetail.create({
            data: this.buildBatchDetailCreateInput(
              batchDto,
              detail.psdId,
              batchIndex + 1,
              detailDto,
              createPhysicalStockDto,
            ),
          });
        }
      }
      return this.buildDocumentPayload(tx, header.pscId);
    });
  }
  findAll() {
    return `This action returns all physicalStock`;
  }
  findOne(id: number) {
    return `This action returns a #${id} physicalStock`;
  }
  update(
    id: string | number,
    updatePhysicalStockDto: UpdatePhysicalStockDto,
  ): Promise<PhysicalStockDocumentResponse> {
    return this.buildDocumentPayload(this.prisma, String(id));
  }
  remove(id: number) {
    return `This action removes a #${id} physicalStock`;
  }
  private buildHeaderCreateInput(
    dto: CreatePhysicalStockDto,
  ): Prisma.PhysicalStockHeaderUncheckedCreateInput {
    return {
      pscId: dto.psId,
      pscAccYear: dto.psAccYear,
      pscCompanyId: dto.psCompanyId,
      pscBranchId: dto.psBranchId,
      pscGodownId: dto.psGodownId,
      pscDocNo: this.toRequiredBigInt(dto.psDocNo, 'psDocNo'),
      pscDocRefno: dto.psDocRefNo ?? null,
      pscDocDate: dto.psDocDate,
      pscCountType: dto.psCountType,
      pscCountedBy: dto.psCountedBy ?? null,
      pscCountStartedOn: dto.psCountStartedOn,
      pscCountCompletedOn: dto.psCountCompletedOn,
      pscStockCutoffAt: dto.psStockCutoffAt,
      pscFreezeStock: dto.psFreezeStock,
      pscFreezeFrom: dto.psFreezeFrom,
      pscFreezeTo: dto.psFreezeTo,
      pscPostingMode: dto.psPostingMode,
      pscRateSource: dto.psRateSource,
      pscAdjustmentVoucherId: dto.psAdjustmentVoucherId ?? null,
      pscTotalLines: dto.psTotalLines ?? dto.details?.length ?? 0,
      pscTotalBookValue: dto.psTotalBookValue,
      pscTotalCountedValue: dto.psTotalCountedValue,
      pscNetVarianceValue: dto.psNetVarianceValue,
      pscStatus: dto.psStatus,
      pscApprovalRequired: dto.psApprovalRequired,
      pscApprovedOn: dto.psApprovedOn,
      pscApprovedBy: dto.psApprovedBy ?? null,
      pscPostedOn: dto.psPostedOn,
      pscPostedBy: dto.psPostedBy ?? null,
      pscCancelledOn: dto.psCancelledOn,
      pscCancelledBy: dto.psCancelledBy ?? null,
      pscCancelReason: dto.psCancelReason ?? null,
      pscDeviceType: dto.psDeviceType,
      pscDeviceId: dto.psDeviceId ?? null,
      pscCounterId: dto.psCounterId ?? null,
      pscSessionId: dto.psSessionId ?? null,
      pscRemarks: dto.psRemarks ?? null,
      pscIsActive: dto.psIsActive,
      pscIsDeleted: dto.psIsDeleted,
      pscSyncDate: dto.psSyncDate,
      pscCreatedOn: dto.psCreatedOn,
      pscCreatedBy: dto.psCreatedBy,
      pscModifiedOn: dto.psModifiedOn,
      pscModifiedBy: dto.psModifiedBy ?? null,
    };
  }
  private buildDetailCreateInput(
    detail: CreatePhysicalStockDetailDto,
    headerId: string,
    rowNo: number,
    header: CreatePhysicalStockDto,
  ): Prisma.PhysicalStockDetailUncheckedCreateInput {
    return {
      psdId: detail.psdId,
      psdPscId: headerId,
      psdRowNo: detail.psdRowNo ?? rowNo,
      psdAccYear: detail.psdAccYear,
      psdCompanyId: detail.psdCompanyId,
      psdBranchId: detail.psdBranchId,
      psdGodownId: detail.psdGodownId,
      psdItemId: detail.psdItemId,
      psdUnitId: detail.psdUnitId,
      psdBaseUnitId: detail.psdBaseUnitId,
      psdToBaseFactor: detail.psdToBaseFactor,
      psdBarcode: detail.psdBarcode ?? null,
      psdMrp: detail.psdMrp,
      psdTrackingType: detail.psdTrackingType,
      psdBookQty: detail.psdBookQty,
      psdBookBaseQty: detail.psdBookBaseQty,
      psdPhysicalQty: detail.psdPhysicalQty,
      psdPhysicalBaseQty: detail.psdPhysicalBaseQty,
      psdStockRateWot: detail.psdStockRateWot,
      psdStockRateWithTax: detail.psdStockRateWithTax,
      psdReasonId: detail.psdReasonId ?? null,
      psdResolution: detail.psdResolution,
      psdNotes: detail.psdNotes ?? null,
      psdIsPosted: detail.psdIsPosted,
      psdIsActive: detail.psdIsActive,
      psdIsDeleted: detail.psdIsDeleted,
      psdSyncDate: detail.psdSyncDate,
      psdCreatedOn: detail.psdCreatedOn,
      psdCreatedBy: detail.psdCreatedBy ?? header.psCreatedBy,
      psdModifiedOn: detail.psdModifiedOn,
      psdModifiedBy: detail.psdModifiedBy ?? header.psModifiedBy ?? null,
    };
  }
  private buildBatchDetailCreateInput(
    batch: CreatePhysicalStockBatchDetailDto,
    detailId: string,
    rowNo: number,
    detail: CreatePhysicalStockDetailDto,
    header: CreatePhysicalStockDto,
  ): Prisma.PhysicalStockBatchDetailUncheckedCreateInput {
    return {
      psbId: batch.psbId,
      psbPsdId: detailId,
      psbRowNo: batch.psbRowNo ?? rowNo,
      psbAccYear: batch.psbAccYear ?? detail.psdAccYear,
      psbCompanyId: batch.psbCompanyId ?? detail.psdCompanyId,
      psbBranchId: batch.psbBranchId ?? detail.psdBranchId,
      psbGodownId: batch.psbGodownId ?? detail.psdGodownId,
      psbItemId: batch.psbItemId ?? detail.psdItemId,
      psbUnitId: batch.psbUnitId ?? detail.psdUnitId,
      psbBaseUnitId: batch.psbBaseUnitId ?? detail.psdBaseUnitId,
      psbToBaseFactor: batch.psbToBaseFactor ?? detail.psdToBaseFactor,
      psbBatchId: batch.psbBatchId ?? null,
      psbBatchNo: batch.psbBatchNo ?? null,
      psbMfgBatchNo: batch.psbMfgBatchNo ?? null,
      psbBatchDate: batch.psbBatchDate,
      psbMfgDate: batch.psbMfgDate,
      psbExpiryDate: batch.psbExpiryDate,
      psbMrp: batch.psbMrp ?? detail.psdMrp,
      psbBarcode: batch.psbBarcode ?? detail.psdBarcode ?? null,
      psbSerialNo: batch.psbSerialNo ?? null,
      psbBookQty: batch.psbBookQty,
      psbBookBaseQty: batch.psbBookBaseQty,
      psbPhysicalQty: batch.psbPhysicalQty,
      psbPhysicalBaseQty: batch.psbPhysicalBaseQty,
      psbStockRateWot: batch.psbStockRateWot,
      psbStockRateWithTax: batch.psbStockRateWithTax,
      psbReasonId: batch.psbReasonId ?? detail.psdReasonId ?? null,
      psbResolution: batch.psbResolution ?? detail.psdResolution,
      psbNotes: batch.psbNotes ?? null,
      psbIsPosted: batch.psbIsPosted,
      psbIsActive: batch.psbIsActive,
      psbIsDeleted: batch.psbIsDeleted,
      psbSyncDate: batch.psbSyncDate,
      psbCreatedOn: batch.psbCreatedOn,
      psbCreatedBy: batch.psbCreatedBy ?? detail.psdCreatedBy ?? header.psCreatedBy,
      psbModifiedOn: batch.psbModifiedOn,
      psbModifiedBy: batch.psbModifiedBy ?? detail.psdModifiedBy ?? header.psModifiedBy ?? null,
    };
  }
  private async buildDocumentPayload(
    client: PhysicalStockWriteClient,
    headerId: string,
  ): Promise<PhysicalStockDocumentResponse> {
    const document = await client.physicalStockHeader.findUnique({
      where: {
        pscId: headerId,
      },
      include: PHYSICAL_STOCK_DOCUMENT_INCLUDE,
    });
    if (!document) {
      throw new NotFoundException(`Physical stock header ${headerId} not found`);
    }
    return this.toDocumentResponse(document);
  }
  private toDocumentResponse(document: PhysicalStockDocumentRecord): PhysicalStockDocumentResponse {
    return {
      header: {
        psc_id: document.pscId,
        psc_refno: document.pscDocRefno ?? document.pscDocNo.toString(),
        psc_date: this.formatDate(document.pscDocDate),
      },
      details: document.details.map((detail) => ({
        psd_id: detail.psdId,
        psd_psc_id: detail.psdPscId,
        psd_row_no: detail.psdRowNo,
        batch_details: detail.batchDetails.map((batch) => ({
          psb_id: batch.psbId,
          psb_psd_id: batch.psbPsdId,
          psb_row_no: batch.psbRowNo,
        })),
      })),
    };
  }
  private toRequiredBigInt(value: number | undefined, field: string): bigint {
    if (value === undefined || value === null) {
      throw new BadRequestException(`${field} is required`);
    }
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return BigInt(value);
  }
  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
