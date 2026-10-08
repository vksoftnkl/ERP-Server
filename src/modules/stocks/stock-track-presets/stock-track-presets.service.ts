import { Injectable, NotFoundException } from '@nestjs/common';
import { StockTrackPreset } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { GetStockTrackPresetsQueryDto } from './dto/get-stock-track-presets-query.dto';
import { mergePresets, presetScopeFilter } from './preset-merge';
import {
  StockTrackPresetsGetMeta,
  StockTrackPresetsPayload,
} from './types/stock-track-presets-api.types';
@Injectable()
export class StockTrackPresetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}
  /**
   * The presets a company may pick from: its own, plus every shared one it has
   * not overridden. `spt_id` fetches one directly and skips the merge — an id
   * already names a single row, and a screen re-opening a saved item needs to
   * show the preset it was configured with even if a company row has since
   * overridden that code.
   */
  async get(
    queryDto: GetStockTrackPresetsQueryDto,
  ): Promise<{ items: StockTrackPresetsPayload[]; meta: StockTrackPresetsGetMeta }> {
    const companyId = queryDto.company_id ?? this.requestContextService.getCompanyId();
    if (queryDto.spt_id) {
      const record = await this.prisma.stockTrackPreset.findUnique({
        where: { sptId: queryDto.spt_id },
      });
      if (!record) {
        throw new NotFoundException(`Stock track preset not found for spt_id ${queryDto.spt_id}`);
      }
      return {
        items: [this.toPayload(record, record.sptCompanyId !== null)],
        meta: { company_id: companyId, spt_id: queryDto.spt_id, count: 1 },
      };
    }
    const rows = await this.prisma.stockTrackPreset.findMany({
      where: {
        ...presetScopeFilter(companyId),
        ...(queryDto.spt_code ? { sptCode: queryDto.spt_code } : {}),
      },
      orderBy: [{ sptSortOrder: 'asc' }, { sptCode: 'asc' }],
    });
    // The merge collapses at most two rows per code and runs over a couple of
    // dozen presets, so it costs nothing to do here — and doing it here rather
    // than in SQL keeps the rule in one readable place (see preset-merge.ts).
    const merged = mergePresets(rows);
    const items = merged.map((record) => this.toPayload(record, record.sptCompanyId !== null));
    return {
      items,
      meta: {
        company_id: companyId,
        spt_code: queryDto.spt_code,
        count: items.length,
      },
    };
  }
  private toPayload(
    record: StockTrackPreset,
    isCompanyOverride: boolean,
  ): StockTrackPresetsPayload {
    return {
      spt_id: record.sptId,
      spt_company_id: record.sptCompanyId,
      spt_code: record.sptCode,
      spt_name: record.sptName,
      spt_description: record.sptDescription,
      spt_track_batch: record.sptTrackBatch,
      spt_track_mrp: record.sptTrackMrp,
      spt_track_sale_price: record.sptTrackSalePrice,
      spt_track_expiry: record.sptTrackExpiry,
      spt_track_serial: record.sptTrackSerial,
      spt_track_supplier: record.sptTrackSupplier,
      spt_track_signature: record.sptTrackSignature,
      spt_valuation_method: record.sptValuationMethod,
      spt_issue_strategy: record.sptIssueStrategy,
      spt_allow_negative: record.sptAllowNegative,
      spt_shelf_life_days: record.sptShelfLifeDays,
      spt_near_expiry_days: record.sptNearExpiryDays,
      spt_block_expired_sale: record.sptBlockExpiredSale,
      spt_ageing_basis: record.sptAgeingBasis,
      spt_sort_order: record.sptSortOrder,
      spt_remarks: record.sptRemarks,
      spt_is_company_override: isCompanyOverride,
    };
  }
}
