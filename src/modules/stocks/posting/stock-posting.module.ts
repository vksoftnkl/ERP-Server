import { Module } from '@nestjs/common';
import { StockPostingService } from './stock-posting.service';

/**
 * §3.1 — the one stock engine, as a module every document that moves stock
 * imports.
 *
 * No controller and no routes: nothing posts stock by URL. A document module
 * imports this, hands the service a `StockLineSource`, and the seven phases
 * run in exactly one place — which is the whole reason this folder exists.
 */
@Module({
  providers: [StockPostingService],
  exports: [StockPostingService],
})
export class StockPostingModule {}
