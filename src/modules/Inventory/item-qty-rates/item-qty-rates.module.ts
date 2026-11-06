import { Module } from '@nestjs/common';
import { AppSettingsModule } from 'src/modules/settings/appSettings/app-settings.module';
import { CostPriceBulkModule } from '../../stocks/cost-price-bulk/cost-price-bulk.module';
import { SellingPriceBulkModule } from '../../stocks/selling-price-bulk/selling-price-bulk.module';
import { ItemsQtyPriceMasterModule } from '../items-qty-price-master/items-qty-price-master.module';
import { ItemQtyRatesExceptionFilter } from './item-qty-rates-exception.filter';
import { ItemQtyRatesController } from './item-qty-rates.controller';
import { ItemQtyRatesGateway } from './item-qty-rates.gateway';
import { ItemQtyRatesService } from './item-qty-rates.service';

/**
 * Qty-wise Prices + Cost + Card Rate, one form (menu 244, plan 2026-11-05).
 * Owns no write and copies no rule:
 *   - SellingPriceBulkModule — the card rows (prepareBulk / writeBulkInTx, the
 *     menu-30 right) and PriceBucketGateway's cost basis;
 *   - ItemsQtyPriceMasterModule — the slabs (save / softDelete in our tx, the
 *     menu-244 rights, the level and HQ rules);
 *   - CostPriceBulkModule — findItem, the Plain-stock eligibility (menu 298);
 *   - AppSettingsModule — inventory.below_cost_price.
 */
@Module({
  imports: [
    ItemsQtyPriceMasterModule,
    SellingPriceBulkModule,
    CostPriceBulkModule,
    AppSettingsModule,
  ],
  controllers: [ItemQtyRatesController],
  providers: [ItemQtyRatesService, ItemQtyRatesGateway, ItemQtyRatesExceptionFilter],
})
export class ItemQtyRatesModule {}
