import { Prisma } from '@prisma/client';
import type { BehindBillDbRow, BehindChallanDbRow, ByLotDbRow, ItemFactDbRow, PositionDbRow } from './godown-position.sql';
import type { BehindBillRow, BehindChallanRow, BehindLot, LastGiven, PositionQtyIn, PositionRow, PositionTiles, PositionTotals } from './types/godown-position.types';
type Dec = Prisma.Decimal;
type Num = Dec | string | number;
export declare const D0: Prisma.Decimal;
export declare function dec(v: Num | null | undefined): Dec;
export declare function qtyIn(base: Num, factor: Num): string;
export declare function kg(v: Num): string;
export declare function unitOf(f: ItemFactDbRow | undefined, mode: PositionQtyIn): {
    name: string;
    factor: Dec;
};
export declare function lastGivenOf(r: {
    last_refno: string | null;
    last_date: string | null;
    last_doc_id: string | null;
    last_doc_year: string | null;
}): LastGiven | null;
export interface PositionRunRow {
    wire: PositionRow;
    nameKey: string;
    godownSort: number;
    godownNameKey: string;
    findText: string;
    billIds: readonly string[];
    dcIds: readonly string[];
    num: {
        owned: Dec;
        bnd: Dec;
        physical: Dec;
        reserved: Dec;
        free: Dec;
        dc: Dec;
        short: Dec;
    };
    kgPerBase: Dec;
    sellFactor: Dec;
}
export interface BuildRowsInput {
    rows: readonly PositionDbRow[];
    facts: readonly ItemFactDbRow[];
    godowns: ReadonlyMap<string, {
        name: string;
        sort: number;
    }>;
    qtyIn: PositionQtyIn;
}
export declare function buildRows(input: BuildRowsInput): PositionRunRow[];
export declare function sortRows(rows: readonly PositionRunRow[]): PositionRunRow[];
export declare function filterRows(rows: readonly PositionRunRow[], v: {
    hideZero: boolean;
    onlyToGive: boolean;
    find: string;
}): PositionRunRow[];
export declare function tilesOf(rows: readonly PositionRunRow[]): PositionTiles;
export declare function totalsOf(rows: readonly PositionRunRow[]): PositionTotals;
export declare function behindBillRows(rows: readonly BehindBillDbRow[], factor: Dec): BehindBillRow[];
export declare function behindChallanRows(rows: readonly BehindChallanDbRow[], factor: Dec): BehindChallanRow[];
export declare function byLotOf(rows: readonly ByLotDbRow[], factor: Dec): {
    byLot: BehindLot[];
    sum: {
        owned: string;
        billedNotDelivered: string;
        physical: string;
        reserved: string;
        freeToSell: string;
    };
};
export declare function printedAsOf(p: {
    branchName: string | null;
    godownName: string | null;
    groupName: string | null;
    brandName: string | null;
    asOf: string;
    qtyIn: PositionQtyIn;
    bucket: string;
    onlyToGive: boolean;
    hideZero: boolean;
    find: string;
}): string;
export {};
