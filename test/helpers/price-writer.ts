import type { RequestContextService } from '../../src/common/request-context/request-context.service';
import { PriceChangeLogService } from '../../src/modules/Inventory/item-price-log/price-change-log.service';
import { PriceMasterWriter } from '../../src/modules/Inventory/item-price-log/price-master-writer.service';

/**
 * Notes 144 — the REAL price writer and change log for a suite that builds its
 * services by hand. Every price write then lands a log row in the suite's own
 * (rolled-back) transaction, as on the live server. The suite's context stub
 * may lack the device or IP accessor; a missing one reads as null.
 */
export function priceWriterFor(ctx: RequestContextService): PriceMasterWriter {
  const partial = ctx as Partial<RequestContextService>;
  const context = {
    getUserId: () => partial.getUserId?.call(ctx) ?? null,
    getDeviceId: () => partial.getDeviceId?.call(ctx) ?? null,
    getIpAddress: () => partial.getIpAddress?.call(ctx) ?? null,
  } as unknown as RequestContextService;
  return new PriceMasterWriter(new PriceChangeLogService(context));
}

/**
 * Edit on menu 30 (Change Selling Price) for `userId`, inside the suite's own
 * rolled-back transaction: a price save checks it since the quick rate popup
 * plan (2026-10-23). Nothing outlives the run.
 */
export async function grantPriceEdit(
  tx: { $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number> },
  userId: string,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE public.user_menus SET um_can_view = true, um_can_edit = true
     WHERE um_user_id = ${userId}::uuid AND um_menu_id = 30 AND um_is_deleted = false`;
  await tx.$executeRaw`
    INSERT INTO public.user_menus (um_user_id, um_menu_id, um_can_view, um_can_edit, um_created_by)
    SELECT ${userId}::uuid, 30, true, true, ${userId}::uuid
     WHERE NOT EXISTS (SELECT 1 FROM public.user_menus
                        WHERE um_user_id = ${userId}::uuid AND um_menu_id = 30
                          AND um_is_deleted = false)`;
}
