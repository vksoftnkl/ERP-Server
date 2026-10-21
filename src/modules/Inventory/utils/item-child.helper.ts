import { Prisma } from '@prisma/client';
import {
  throwInventoryBadRequest,
  throwInventoryConflict,
} from 'src/common/utils/module-service.utils';
import type { InventoryErrorDetail } from 'src/common/utils/module-service.utils';

/**
 * Rules the four item child tables (unit conversions, prices, EAN codes,
 * reorders) share on their own routes — /item-unit-conversions,
 * /item-prices, /item-ean-codes, /item-reorders — and under the composite
 * save (notes 137 A1 / D1). Each service passes its own `errors[].code`.
 */
type ReadClient = Pick<Prisma.TransactionClient, 'itemMaster' | 'itemUnitConversion'>;

/**
 * A child row is only written for a LIVE item. The standalone routes used to
 * write prices, barcodes and reorders under a deleted item, where nothing
 * shows them and restore cannot tell them from the rows deleted with it.
 * One query per batch, whatever its size.
 */
export async function assertItemsLive(
  client: ReadClient,
  itemIds: readonly string[],
  what: { field: string; code: string },
): Promise<void> {
  const wanted = Array.from(new Set(itemIds.filter((id) => !!id)));
  if (!wanted.length) {
    return;
  }
  const live = await client.itemMaster.findMany({
    where: { itemId: { in: wanted }, itemIsDeleted: false },
    select: { itemId: true },
  });
  const liveIds = new Set(live.map((row) => row.itemId));
  const missing = wanted.filter((id) => !liveIds.has(id));
  if (missing.length) {
    throwInventoryBadRequest<InventoryErrorDetail>('Item is not live', [
      {
        field: what.field,
        code: what.code,
        message: `No live item with id ${missing.join(', ')}: the item is missing or deleted.`,
      },
    ]);
  }
}

/**
 * The unit column of an EAN or reorder row holds an iuc_id, and that
 * conversion row must be the item's own: the foreign key alone accepts any
 * item's unit (notes 137 D1). The price service has done this since notes 50.
 */
export async function assertUnitOfItem(
  client: ReadClient,
  iucId: string,
  itemId: string,
  what: { field: string; code: string },
): Promise<void> {
  const row = await client.itemUnitConversion.findFirst({
    where: { iucId, iucItemId: itemId, iucIsDeleted: false },
    select: { iucId: true },
  });
  if (!row) {
    throwInventoryBadRequest<InventoryErrorDetail>('Validation failed', [
      {
        field: what.field,
        code: what.code,
        message: `Unit conversion ${iucId} is not a live unit of item ${itemId}.`,
      },
    ]);
  }
}

/**
 * DELETE deletes; it no longer toggles (notes 137 D1 — a second DELETE on a
 * child row used to restore it). A row whose item is deleted went with the
 * item and comes back only through POST /items/restore.
 */
export async function assertChildDeletable(
  client: ReadClient,
  row: { isDeleted: boolean; itemId: string },
  what: {
    label: string;
    idField: string;
    alreadyDeletedCode: string;
    itemNotLiveCode: string;
  },
): Promise<void> {
  if (row.isDeleted) {
    throwInventoryConflict<InventoryErrorDetail>(`This ${what.label} is already deleted`, [
      {
        field: what.idField,
        code: what.alreadyDeletedCode,
        message: `Nothing to delete: the ${what.label} is already deleted.`,
      },
    ]);
  }
  const item = await client.itemMaster.findFirst({
    where: { itemId: row.itemId, itemIsDeleted: false },
    select: { itemId: true },
  });
  if (!item) {
    throwInventoryConflict<InventoryErrorDetail>('Item is not live', [
      {
        field: what.idField,
        code: what.itemNotLiveCode,
        message: `The ${what.label}'s item is deleted. POST /items/restore brings the item back with its rows.`,
      },
    ]);
  }
}
