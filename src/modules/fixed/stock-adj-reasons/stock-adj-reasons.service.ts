import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockAdjReason } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { GetStockAdjReasonsQueryDto } from './dto/get-stock-adj-reasons-query.dto';
import {
  StockAdjReasonsGetMeta,
  StockAdjReasonsPayload,
} from './types/stock-adj-reasons-api.types';

type StockAdjReasonRecord = Pick<
  StockAdjReason,
  | 'sarId'
  | 'sarCode'
  | 'sarName'
  | 'sarReasonKind'
  | 'sarDefaultResolution'
  | 'sarAffectsAccounts'
  | 'sarIsActive'
  | 'sarIsDeleted'
  | 'sarCreatedOn'
  | 'sarCreatedBy'
  | 'sarModifiedOn'
  | 'sarModifiedBy'
>;

@Injectable()
export class StockAdjReasonsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    queryDto: GetStockAdjReasonsQueryDto,
  ): Promise<{ items: StockAdjReasonsPayload[]; meta: StockAdjReasonsGetMeta }> {
    const activeOnly = queryDto.activeOnly ?? true;
    const includeDeleted = queryDto.includeDeleted ?? false;

    const where: Prisma.StockAdjReasonWhereInput = {};

    if (queryDto.sarId !== undefined) {
      where.sarId = queryDto.sarId;
    }
    if (queryDto.sarCode !== undefined) {
      where.sarCode = { equals: queryDto.sarCode, mode: 'insensitive' };
    }
    if (queryDto.sarReasonKind !== undefined) {
      where.sarReasonKind = { equals: queryDto.sarReasonKind, mode: 'insensitive' };
    }
    if (activeOnly) {
      where.sarIsActive = true;
    }
    if (!includeDeleted) {
      where.sarIsDeleted = false;
    }

    const records = await this.prisma.stockAdjReason.findMany({
      where,
      orderBy: [{ sarCode: 'asc' }, { sarId: 'asc' }],
      select: {
        sarId: true,
        sarCode: true,
        sarName: true,
        sarReasonKind: true,
        sarDefaultResolution: true,
        sarAffectsAccounts: true,
        sarIsActive: true,
        sarIsDeleted: true,
        sarCreatedOn: true,
        sarCreatedBy: true,
        sarModifiedOn: true,
        sarModifiedBy: true,
      },
    });

    if (queryDto.sarId !== undefined && records.length === 0) {
      throw new NotFoundException(`Stock adjustment reason not found for sarId ${queryDto.sarId}`);
    }

    const items = records.map((record) => this.toPayload(record));

    return {
      items,
      meta: {
        sarId: queryDto.sarId,
        sarCode: queryDto.sarCode,
        sarReasonKind: queryDto.sarReasonKind,
        activeOnly,
        includeDeleted,
        count: items.length,
      },
    };
  }

  private toPayload(record: StockAdjReasonRecord): StockAdjReasonsPayload {
    return {
      sarId: record.sarId,
      sarCode: record.sarCode,
      sarName: record.sarName,
      sarReasonKind: record.sarReasonKind,
      sarDefaultResolution: record.sarDefaultResolution,
      sarAffectsAccounts: record.sarAffectsAccounts,
      sarIsActive: record.sarIsActive,
      sarIsDeleted: record.sarIsDeleted,
      sarCreatedOn: record.sarCreatedOn.toISOString(),
      sarCreatedBy: record.sarCreatedBy ?? null,
      sarModifiedOn: record.sarModifiedOn?.toISOString() ?? null,
      sarModifiedBy: record.sarModifiedBy ?? null,
    };
  }
}
