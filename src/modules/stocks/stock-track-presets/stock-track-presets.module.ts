import { Module } from '@nestjs/common';
import { StockTrackPresetsController } from './stock-track-presets.controller';
import { StockTrackPresetsService } from './stock-track-presets.service';
/**
 * Read-only. stock.stock_track_preset is seeded master data
 * (prisma/seed/Stock_Track_Presets.sql); this module exists so the Item Master
 * and Item Group Master screens can offer the presets, and so both screens see
 * the same company merge — see preset-merge.ts, which
 * StockTrackPolicyService shares.
 */
@Module({
  controllers: [StockTrackPresetsController],
  providers: [StockTrackPresetsService],
  exports: [StockTrackPresetsService],
})
export class StockTrackPresetsModule {}
