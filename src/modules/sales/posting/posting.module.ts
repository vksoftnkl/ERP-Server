import { Module } from '@nestjs/common';
import { StockPostingModule } from '../../stocks/posting/stock-posting.module';
import { AppSettingsModule } from '../../settings/appSettings/app-settings.module';
import { ChargeCarryService } from './charge-carry.service';
import { DcFulfilmentService } from './dc-fulfilment.service';
import { DocRegisterService } from './doc-register.service';
import { GstGatewayService } from './gst-gateway.service';
import { LoyaltyLedgerService } from './loyalty-ledger.service';
import { PromotionUsageService } from './promotion-usage.service';
import { SalesContextService } from './sales-context.service';
import { SalesDocBlocksService } from './sales-doc-blocks.service';
import { SalesPostingService } from './sales-posting.service';
import { SalesStockService } from './sales-stock.service';
import { StockReservationService } from './stock-reservation.service';
import { StatutoryService } from './statutory.service';
import { TransportBandService } from './transport-band.service';

/**
 * A2 — the shared posting services.
 *
 * Nothing user-visible comes out of this module: it has no controller and no
 * routes, exactly like `StockPostingModule`. Every sales document — bill,
 * order, challan, DC return, sale return — imports it and posts THROUGH it, so
 * there is one copy of each rule instead of one per screen.
 *
 * `StockPostingModule` is re-exported because a sales document needs both: the
 * legs and the register are this module's, the stock movement is that one's,
 * and a document that imported only one of them would be half-posted.
 *
 * `AppSettingsModule` supplies the resolver behind `SalesContextService`: the
 * settings are read through `fn_app_settings_effective`, never re-merged here.
 */
const SERVICES = [
  StatutoryService,
  LoyaltyLedgerService,
  PromotionUsageService,
  ChargeCarryService,
  SalesPostingService,
  DocRegisterService,
  SalesContextService,
  SalesDocBlocksService,
  TransportBandService,
  SalesStockService,
  StockReservationService,
  DcFulfilmentService,
  GstGatewayService,
];

@Module({
  imports: [StockPostingModule, AppSettingsModule],
  providers: SERVICES,
  exports: [...SERVICES, StockPostingModule],
})
export class SalesPostingModule {}
