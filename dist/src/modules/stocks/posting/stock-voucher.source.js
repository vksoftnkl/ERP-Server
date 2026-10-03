"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockVoucherSource = void 0;
class StockVoucherSource {
    input;
    srcModule = 'STOCK';
    srcDocType = 'STOCK_VOUCHER';
    constructor(input) {
        this.input = input;
    }
    get svhId() {
        return this.input.svhId;
    }
    get accYear() {
        return this.input.accYear;
    }
    get srcDocId() {
        return this.input.svhId;
    }
    get companyId() {
        return this.input.companyId;
    }
    get branchId() {
        return this.input.branchId;
    }
    get rules() {
        return this.input.rules;
    }
    async docDatetime(tx) {
        const [row] = await tx.$queryRaw `
      SELECT svh_doc_datetime
        FROM stock.stock_voucher
       WHERE svh_id       = ${this.input.svhId}::uuid
         AND svh_acc_year = ${this.input.accYear}::bpchar`;
        return row?.svh_doc_datetime ?? null;
    }
    async godownIds(tx) {
        const rows = await tx.$queryRaw `
      SELECT DISTINCT g.godown_id
        FROM (
          SELECT svi.svi_godown_id AS godown_id
            FROM stock.stock_voucher_item svi
           WHERE svi.svi_voucher_id = ${this.input.svhId}::uuid
             AND svi.svi_acc_year   = ${this.input.accYear}::bpchar
             AND svi.svi_is_deleted = false
          UNION
          SELECT svh.svh_from_godown_id
            FROM stock.stock_voucher svh
           WHERE svh.svh_id       = ${this.input.svhId}::uuid
             AND svh.svh_acc_year = ${this.input.accYear}::bpchar
          UNION
          SELECT svh.svh_to_godown_id
            FROM stock.stock_voucher svh
           WHERE svh.svh_id       = ${this.input.svhId}::uuid
             AND svh.svh_acc_year = ${this.input.accYear}::bpchar
        ) g(godown_id)
       WHERE g.godown_id IS NOT NULL`;
        return rows.map((r) => r.godown_id);
    }
}
exports.StockVoucherSource = StockVoucherSource;
//# sourceMappingURL=stock-voucher.source.js.map