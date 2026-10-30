import type { Tx } from './purchase-doc.helpers';

/** One GSTIN a supplier bills from: the master's, or a BILL_TO / BOTH address of its ledger (accounts.acc_ship_addrs). */
export interface BillFromRow { addr_id: string | null; gstin: string; state_code: string | null; state_name: string | null; name: string | null; addr: string | null; place: string | null; pin: string | null; is_default: boolean; source: 'MASTER' | 'LEDGER_ADDRESS' }

/** S2 — the supplier's GSTINs: the master's first, then its ledger's BILL_TO / BOTH addresses (one ledger = one supplier). */
export async function supplierBillFrom(db: Tx, supplierId: string): Promise<BillFromRow[]> {
  const rows = await db.$queryRaw<BillFromRow[]>`
    SELECT NULL::uuid AS addr_id, upper(btrim(s.sup_gst_no)) AS gstin, NULLIF(btrim(s.sup_state_code), '') AS state_code, s.sup_state_name AS state_name,
           s.sup_name AS name, concat_ws(', ', NULLIF(s.sup_addr1, ''), NULLIF(s.sup_addr2, ''), NULLIF(s.sup_addr3, '')) AS addr, NULL::text AS place, NULL::text AS pin,
           true AS is_default, 'MASTER' AS source
      FROM purchase.suppliers s WHERE s.sup_id = ${supplierId}::uuid AND NULLIF(btrim(s.sup_gst_no), '') IS NOT NULL
    UNION ALL
    SELECT a.saa_id, upper(btrim(a.saa_gstin)), NULLIF(btrim(a.saa_state_code), ''), a.saa_state_name,
           COALESCE(a.saa_trade_name, a.saa_contact_name), concat_ws(', ', NULLIF(a.saa_addr1, ''), NULLIF(a.saa_addr2, ''), NULLIF(a.saa_addr3, '')), a.saa_location, a.saa_pin,
           false, 'LEDGER_ADDRESS'
      FROM accounts.acc_ship_addrs a
     WHERE a.saa_ledger_id = ${supplierId}::uuid AND a.saa_addr_type IN ('BILL_TO', 'BOTH', 'BILLING') AND a.saa_is_active AND NOT a.saa_is_deleted
       AND NULLIF(btrim(a.saa_gstin), '') IS NOT NULL`;
  return rows.map((r) => ({ ...r, state_code: r.state_code ?? (/^\d{2}/.test(r.gstin) ? r.gstin.slice(0, 2) : null) }));
}

