import { Module } from '@nestjs/common';
import { DeliveryPendingService } from './delivery-pending.service';
import { DeliveryStatusService } from './delivery-status.service';

/**
 * Delivery tracking's shared core (plan §5): the billed-not-delivered readers
 * and the ONE writer of the bill's computed delivery status.
 *
 * Depends on nothing but the (global) PrismaService, so the bill, the sale
 * return, physical stock and the stock reports can all import it without a
 * cycle back into the Delivery Note module.
 */
@Module({
  providers: [DeliveryPendingService, DeliveryStatusService],
  exports: [DeliveryPendingService, DeliveryStatusService],
})
export class DeliveryCoreModule {}
