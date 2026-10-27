import { Module } from '@nestjs/common';
import { StockTrackPresetsController } from './stock-track-presets.controller';
import { StockTrackPresetsService } from './stock-track-presets.service';
/**
 * stock.stock_track_preset: the shared presets are seeded master data
 * (prisma/seed/Stock_Track_Presets.sql) and read-only; a company writes its
 * own through /save and /deactivate (notes 159 §4, menu 249). The GET feeds
 * the Item Master and Item Group Master combos, so both screens see the same
 * company merge — see preset-merge.ts, which StockTrackPolicyService shares.
 */
@Module({
  controllers: [StockTrackPresetsController],
  providers: [StockTrackPresetsService],
  exports: [StockTrackPresetsService],
})
export class StockTrackPresetsModule {}
