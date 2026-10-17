# Bill Balance — party credit summary

Read-only aggregation over `accounts.acc_bill_balance`, joined to the customer's
configured credit ceilings. One round-trip for the credit check that the Sale
Bill and Sales Order entry screens run on party-select and on save.

## Endpoint

```
GET /api/v1/master-lookups/party-credit
```

The route is registered on `MasterLookupController`, not here, so the entry
screens resolve every per-line and per-party value from one base path. The SQL
stays in this module: the receipt and credit-note screens need the same
outstanding figure, and a second copy would drift from this one.

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `partyId` | uuid | **yes** | — | `customers.cus_id` — the only required parameter |
| `companyId` | uuid | no | null | Tenant scope — omit → **every company**, see below |
| `branchId` | uuid | no | null | Omit → company-wide position (the usual check) |
| `accYear` | `YYYY-YYYY` | no | null | Echoed only — see *Accounting year* below |

There is no as-on date. Overdue and ageing are always measured against the
database server's `CURRENT_DATE`, and the response reports the date used as
`asOnDate` so the client knows which "today" produced the numbers instead of
trusting its own clock and timezone. `CURRENT_DATE` is `STABLE`, so all five
references in the query — the three overdue `FILTER`s, the ageing subtraction
and the echoed value — agree within the statement.

Only `partyId` is required. `companyId` and `branchId` are narrowing filters:
each is short-circuited when null (`abl_company_id = NULL` would match nothing
and silently zero the position), so omitting one widens the read rather than
emptying it. Optional still means validated — a malformed value is a 400, never
an ignored filter.

**Omitting `companyId` drops tenant scoping.** The party is then resolved and
aggregated across every company in the database, which is nobody's real credit
position if an id is ever shared. Entry screens know their company and should
always send it; the parameter is optional for callers that genuinely want the
group-wide figure.

Unknown, soft-deleted, or — when `companyId` is given — another company's
`partyId` → **404**. A party who exists but has no open bills → **200** with
zeroes and a null `oldestOverdueDueDate`.

## Three things the numbers do that are easy to get wrong

### DR and CR are signed apart

`abl_dr_cr` is `DR` = receivable, `CR` = payable, and **both** sit in this table
with a *positive* `abl_pending_amount`. A sale-order `ADVANCE` is a `CR` row —
the customer's own money, held. Summing the column flat would read that advance
as money the customer owes, which is backwards: it would block a party who has
paid ahead.

So `pendingAmount` is `SUM(DR) − SUM(CR)`, and `pendingBillCount` counts `DR`
rows only, because an advance is not a bill against the bill limit. Overdue is
receivables-only for the same reason (an `ADVANCE` carries no due date at all).

### Accounting year does not scope anything

`acc_bill_balance` is partitioned by `abl_acc_year`, but the partition records
where a bill **started**, not where the money is — a bill outstanding past year
end keeps its original year and never moves. Filtering the credit check on the
entry screen's year would drop every still-open bill raised before it, and the
year-end carry-forward gap (clients run FY generation on April 1, then key
missed prior-FY receipts afterwards) guarantees those exist. A customer would
come up clean on their first bill of the new year while carrying real debt.

The aggregate therefore scans every partition, which is what the table's own
design notes prescribe for outstanding and ageing reads, and what `ix_abl_open`
/ `ix_abl_overdue` already do. `accYear` is accepted and echoed back so the
client contract stays stable, but it reaches neither the WHERE clause nor the
bound parameters.

### `available*` is never clamped at zero

The negative value is the payload: it is what the entry screen renders as
"limit exceeded by ₹X / N bills".

When `customers.cus_credit_allowed` is false there is no configured ceiling, so
both `available*` fields come back **null**, both `isXLimitExceeded` flags are
false, and `isCreditCheckEnabled` is false. Without that, every customer with no
limit set would sit at a zero limit and be blocked at billing.

## Caching

**The route is exempt, deliberately.** `acc_bill_balance` moves on every sale
bill, receipt, credit note and bill adjustment; a cached summary means a
salesman bills a customer, collects the payment, and the next bill still
evaluates the pre-payment outstanding. `@CacheTTL(0)` makes
`HttpCacheInterceptor` pass straight through without reading or writing a key,
and the response carries `Cache-Control: no-store`.
`master-lookup.controller.spec.ts` pins this: it asserts no cache read or write
for `party-credit` while `item-price` and the class-TTL routes still cache.

To limit call volume, debounce on the client. Do not put a server TTL back.

## Index

`ix_abl_party_credit` (migration `20260811100000`) —
`(abl_party_id, abl_company_id, abl_branch_id) INCLUDE (abl_pending_amount,
abl_due_date, abl_dr_cr) WHERE abl_is_deleted = false AND abl_pending_amount > 0`.

**Party leads the key** — deliberately, and unlike `ix_abl_open`, which leads
with the company. `partyId` is the endpoint's only required filter, so it is the
only column guaranteed to be in the predicate and therefore the only one that
can always lead the scan. A company-first key would leave the `companyId`-less
call with no usable prefix at all.

Raw SQL only. It is **not** declared in the Prisma schema and must not be:
Prisma cannot express a partial index or an `INCLUDE`, so a matching `@@index`
would make every `migrate diff` see phantom drift and emit an unpredicated
`CREATE INDEX` that fails 42P07 on the name.

Built without `CONCURRENTLY` — Postgres rejects it on a partitioned table, and
Prisma wraps each migration in a transaction where it is illegal anyway. The
index is created on the partitioned parent, so existing partitions get it by
cascade and future years pick it up from the `CREATE TABLE ... PARTITION OF` in
`public.ensure_acc_year_partitions`.
