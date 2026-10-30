"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertItemsLive = assertItemsLive;
exports.assertUnitOfItem = assertUnitOfItem;
exports.assertChildDeletable = assertChildDeletable;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
async function assertItemsLive(client, itemIds, what) {
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
        (0, module_service_utils_1.throwInventoryBadRequest)('Item is not live', [
            {
                field: what.field,
                code: what.code,
                message: `No live item with id ${missing.join(', ')}: the item is missing or deleted.`,
            },
        ]);
    }
}
async function assertUnitOfItem(client, iucId, itemId, what) {
    const row = await client.itemUnitConversion.findFirst({
        where: { iucId, iucItemId: itemId, iucIsDeleted: false },
        select: { iucId: true },
    });
    if (!row) {
        (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
            {
                field: what.field,
                code: what.code,
                message: `Unit conversion ${iucId} is not a live unit of item ${itemId}.`,
            },
        ]);
    }
}
async function assertChildDeletable(client, row, what) {
    if (row.isDeleted) {
        (0, module_service_utils_1.throwInventoryConflict)(`This ${what.label} is already deleted`, [
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
        (0, module_service_utils_1.throwInventoryConflict)('Item is not live', [
            {
                field: what.idField,
                code: what.itemNotLiveCode,
                message: `The ${what.label}'s item is deleted. POST /items/restore brings the item back with its rows.`,
            },
        ]);
    }
}
//# sourceMappingURL=item-child.helper.js.map