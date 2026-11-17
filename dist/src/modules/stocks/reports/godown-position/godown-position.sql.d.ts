import { Prisma } from '@prisma/client';
export interface PositionSqlScope {
    companyId: string;
    branchId: string;
    godownId: string | null;
    bucket: string | null;
    groupId: string | null;
    brandId: string | null;
}
export interface PositionDbRow {
    item_id: string;
    godown_id: string;
    owned: Prisma.Decimal;
    reserved: Prisma.Decimal;
    free: Prisma.Decimal;
    bnd: Prisma.Decimal;
    bnd_ev: Prisma.Decimal;
    over_given: Prisma.Decimal;
    bill_ids: string[];
    dc_open: Prisma.Decimal;
    dc_ids: string[];
    last_refno: string | null;
    last_date: string | null;
    last_doc_id: string | null;
    last_doc_year: string | null;
}
export interface ItemFactDbRow {
    item_id: string;
    item_code: string | null;
    item_name: string | null;
    barcode: string | null;
    sell_factor: Prisma.Decimal;
    sell_unit: string;
    base_unit: string;
    kg_per_base: Prisma.Decimal;
}
export declare function positionSql(s: PositionSqlScope): Prisma.Sql;
export declare function itemFactsSql(itemIds: readonly string[]): Prisma.Sql;
export interface BehindBillDbRow {
    bill_id: string;
    bill_acc_year: string;
    bill_refno: string | null;
    bill_date: string | null;
    days: number | null;
    cust_id: string | null;
    cust_name: string | null;
    area_name: string | null;
    mode: string;
    line_id: string;
    line_no: number;
    lot_id: string | null;
    lot_no: string | null;
    factor: Prisma.Decimal;
    billed_qty: Prisma.Decimal;
    given_qty: Prisma.Decimal;
    pending_qty: Prisma.Decimal;
    pending_base: Prisma.Decimal;
    last_refno: string | null;
    last_date: string | null;
    last_doc_id: string | null;
    last_doc_year: string | null;
}
export declare function behindBillsSql(s: PositionSqlScope, itemId: string): Prisma.Sql;
export interface BehindChallanDbRow {
    dc_id: string;
    dc_acc_year: string;
    dc_refno: string | null;
    dc_date: string | null;
    days: number | null;
    cust_id: string | null;
    cust_name: string | null;
    open_base: Prisma.Decimal;
    total_base: Prisma.Decimal;
}
export declare function behindChallansSql(s: PositionSqlScope, itemId: string): Prisma.Sql;
export interface ByLotDbRow {
    lot_id: string | null;
    lot_no: string | null;
    owned: Prisma.Decimal;
    reserved: Prisma.Decimal;
    free: Prisma.Decimal;
    bnd: Prisma.Decimal;
}
export declare function byLotSql(s: PositionSqlScope, itemId: string): Prisma.Sql;
