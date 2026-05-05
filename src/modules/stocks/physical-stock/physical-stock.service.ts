import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PhysicalStockHeader } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { CreatePhysicalStockDto } from './dto/create-physical-stock.dto';
import { UpdatePhysicalStockDto } from './dto/update-physical-stock.dto';
@Injectable()
export class PhysicalStockService {
  constructor(private readonly prisma: PrismaService) {}
  async save(createPhysicalStockDto: CreatePhysicalStockDto) {
    if (createPhysicalStockDto.pscId) {
      return this.updateById(createPhysicalStockDto.pscId, createPhysicalStockDto);
    }
    return this.create(createPhysicalStockDto);
  }
  async create(createPhysicalStockDto: CreatePhysicalStockDto) {
    const data = this.toCreateInput(createPhysicalStockDto);
    const created = await this.prisma.physicalStockHeader.create({ data });
    return this.toPayload(created);
  }
  async findAll() {
    const records = await this.prisma.physicalStockHeader.findMany({
      where: {
        pscIsDeleted: false,
      },
      orderBy: [{ pscDocDate: 'desc' }, { pscDocNo: 'desc' }],
    });
    return records.map((record) => this.toPayload(record));
  }
  async findOne(id: string) {
    const record = await this.prisma.physicalStockHeader.findFirst({
      where: {
        pscId: id,
        pscIsDeleted: false,
      },
    });
    if (!record) {
      throw new NotFoundException(`Physical stock ${id} not found`);
    }
    return this.toPayload(record);
  }
  async update(id: string, updatePhysicalStockDto: UpdatePhysicalStockDto) {
    return this.updateById(id, updatePhysicalStockDto);
  }
  async remove(id: string) {
    await this.findOne(id);
    const deleted = await this.prisma.physicalStockHeader.update({
      where: {
        pscId: id,
      },
      data: {
        pscIsDeleted: true,
        pscIsActive: false,
        pscModifiedOn: new Date(),  
      },
    });
    return {
      ...this.toPayload(deleted),
      deleted: true,
    };
  }
  private async updateById(
    pscId: string,
    updatePhysicalStockDto: UpdatePhysicalStockDto,
  ) {
    await this.findOne(pscId);
    const data = this.toUpdateInput(updatePhysicalStockDto);
    const updated = await this.prisma.physicalStockHeader.update({
      where: {
        pscId,
      },
      data,
    });
    return this.toPayload(updated);
  }
  private toCreateInput(
    createPhysicalStockDto: CreatePhysicalStockDto,
  ): Prisma.PhysicalStockHeaderUncheckedCreateInput {
    const optionalData = this.toWriteInput(createPhysicalStockDto) as Record<string, unknown>;
    return {
      ...optionalData,
      ...(createPhysicalStockDto.pscId ? { pscId: createPhysicalStockDto.pscId } : {}),
      pscAccYear: createPhysicalStockDto.pscAccYear,
      pscCompanyId: createPhysicalStockDto.pscCompanyId,
      pscBranchId: createPhysicalStockDto.pscBranchId,
      pscGodownId: createPhysicalStockDto.pscGodownId,
      pscDocNo: this.toBigInt(createPhysicalStockDto.pscDocNo, 'pscDocNo'),
    };
  }
  private toUpdateInput(
    updatePhysicalStockDto: UpdatePhysicalStockDto,
  ): Prisma.PhysicalStockHeaderUncheckedUpdateInput {
    return this.toWriteInput(updatePhysicalStockDto);
  }
  private toWriteInput(
    dto: CreatePhysicalStockDto | UpdatePhysicalStockDto,
  ): Prisma.PhysicalStockHeaderUncheckedUpdateInput {
    const data: Record<string, unknown> = {};
    this.assignDefined(data, 'pscAccYear', dto.pscAccYear);
    this.assignDefined(data, 'pscCompanyId', dto.pscCompanyId);
    this.assignDefined(data, 'pscBranchId', dto.pscBranchId);
    this.assignDefined(data, 'pscGodownId', dto.pscGodownId);
    this.assignDefined(
      data,
      'pscDocNo',
      dto.pscDocNo === undefined ? undefined : this.toBigInt(dto.pscDocNo, 'pscDocNo'),
    );
    this.assignDefined(data, 'pscDocRefno', dto.pscDocRefno);
    this.assignDefined(data, 'pscDocDate', dto.pscDocDate, false);
    this.assignDefined(data, 'pscCountType', dto.pscCountType);
    this.assignDefined(data, 'pscCountedBy', dto.pscCountedBy);
    this.assignDefined(data, 'pscCountStartedOn', dto.pscCountStartedOn);
    this.assignDefined(data, 'pscCountCompletedOn', dto.pscCountCompletedOn);
    this.assignDefined(data, 'pscStockCutoffAt', dto.pscStockCutoffAt, false);
    this.assignDefined(data, 'pscFreezeStock', dto.pscFreezeStock);
    this.assignDefined(data, 'pscFreezeFrom', dto.pscFreezeFrom);
    this.assignDefined(data, 'pscFreezeTo', dto.pscFreezeTo);
    this.assignDefined(data, 'pscPostingMode', dto.pscPostingMode);
    this.assignDefined(data, 'pscRateSource', dto.pscRateSource);
    this.assignDefined(data, 'pscAdjustmentVoucherId', dto.pscAdjustmentVoucherId);
    this.assignDefined(data, 'pscTotalLines', dto.pscTotalLines);
    this.assignDefined(data, 'pscTotalBookValue', dto.pscTotalBookValue);
    this.assignDefined(data, 'pscTotalCountedValue', dto.pscTotalCountedValue);
    this.assignDefined(data, 'pscNetVarianceValue', dto.pscNetVarianceValue);
    this.assignDefined(data, 'pscStatus', dto.pscStatus);
    this.assignDefined(data, 'pscApprovalRequired', dto.pscApprovalRequired);
    this.assignDefined(data, 'pscApprovedOn', dto.pscApprovedOn);
    this.assignDefined(data, 'pscApprovedBy', dto.pscApprovedBy);
    this.assignDefined(data, 'pscPostedOn', dto.pscPostedOn);
    this.assignDefined(data, 'pscPostedBy', dto.pscPostedBy);
    this.assignDefined(data, 'pscCancelledOn', dto.pscCancelledOn);
    this.assignDefined(data, 'pscCancelledBy', dto.pscCancelledBy);
    this.assignDefined(data, 'pscCancelReason', dto.pscCancelReason);
    this.assignDefined(data, 'pscDeviceType', dto.pscDeviceType);
    this.assignDefined(data, 'pscDeviceId', dto.pscDeviceId);
    this.assignDefined(data, 'pscCounterId', dto.pscCounterId);
    this.assignDefined(data, 'pscSessionId', dto.pscSessionId);
    this.assignDefined(data, 'pscRemarks', dto.pscRemarks);
    this.assignDefined(data, 'pscIsActive', dto.pscIsActive);
    this.assignDefined(data, 'pscIsDeleted', dto.pscIsDeleted);
    this.assignDefined(data, 'pscSyncDate', dto.pscSyncDate);
    this.assignDefined(data, 'pscCreatedOn', dto.pscCreatedOn, false);
    this.assignDefined(data, 'pscCreatedBy', dto.pscCreatedBy);
    this.assignDefined(data, 'pscModifiedOn', dto.pscModifiedOn, false);
    this.assignDefined(data, 'pscModifiedBy', dto.pscModifiedBy);
    return data as Prisma.PhysicalStockHeaderUncheckedUpdateInput;
  }
  private assignDefined(
    data: Record<string, unknown>,
    field: string,
    value: unknown,
    allowNull = true,
  ): void {
    if (value === undefined || (!allowNull && value === null)) {
      return;
    }
    data[field] = value;
  }
  private toBigInt(value: string | undefined, field: string): bigint {
    if (value === undefined) {
      throw new BadRequestException(`${field} is required`);
    }
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`${field} must be a valid integer`);
    }
  }
  private toPayload(record: PhysicalStockHeader): Record<string, unknown> {
    return {
      ...record,
      pscDocNo: record.pscDocNo.toString(),
    };
  }
}