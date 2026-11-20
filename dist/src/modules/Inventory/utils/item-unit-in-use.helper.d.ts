import type { InventoryWriteClient } from "../../../common/utils/module-service.utils";
export type UnitRowsInUse = {
    byRow: ReadonlyMap<string, readonly string[]>;
    itemUsed: boolean;
    itemUsedBy: readonly string[];
};
export declare function unitRowsInUse(client: InventoryWriteClient, itemId: string): Promise<UnitRowsInUse>;
export declare function rowUnitLock(inUse: UnitRowsInUse, row: {
    iuc_id: string;
    iuc_is_base_unit: boolean;
}): {
    locked: boolean;
    usedBy: readonly string[];
};
