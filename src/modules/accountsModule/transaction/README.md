# Transaction — party adjustable credits

Settlement reads over `accounts.acc_bill_balance`, the credit side of it. One
question: **what has this party already paid or returned that has not been spent
yet, and how does each of those settle?**

The rows are what the sale bill / receipt / credit-note adjustment panel offers,
and what `acc_bill_adjustment` is then posted from.

## Endpoint

```
GET /api/v1/transactions/party-advance?partyId=<uuid>&companyId=<uuid>&type=CR
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `partyId` | uuid | **yes** | `acc_bill_balance.abl_party_id` |
| `companyId` | uuid | **yes** | Tenant scope — required, not a narrowing filter |
| `type` | `CR` \| `DR` | no — defaults to `CR` | `abl_dr_cr`. Case-insensitive (`cr` works) |

`type` picks the side of the party's account: `CR` is what the company owes the
party (customer advances, sales returns) and is what the adjustment panel wants;
`DR` is what the party owes the company (a supplier advance already paid out, a
purchase return). Omitting it means `CR`, **not** both sides — see *Why the
predicate is what it is*. Each row echoes the side back as `drCr`.

`companyId` is required rather than optional (the credit summary treats it as a
narrowing filter). Offering one tenant's credits as settlement on another
tenant's bill is not a wider read, it is a wrong one.

There is **no accounting-year parameter** — see *Accounting year* below.

### Response

```jsonc
{
  "success": true,
  "message": "Party adjustable credits fetched successfully",
  "data": [
    {
      "billId": "0197f3a1-2b4c-7d8e-9f01-23456789abcd",
      "billAccYear": "2025-2026",
      "billType": "ADVANCE",
      "docRefno": "SO-2201",
      "docDate": "2026-03-27",
      "billAmount": 50000,      // face value — display only
      "pendingAmount": 18500,   // what is LEFT; the ceiling for this row
      "status": "PARTIAL",
      "drCr": "CR",             // the requested side, echoed back
      "srcModule": "SALES",
      "srcDocType": "SALES_ORDER",
      "srcDocId": "0197e0c5-...",
      "srcAccYear": "2025-2026",
      "narration": "Advance received on order",
      "adjType": "ADVANCE_ADJUST",     // derived from billType
      "settlementMode": "ADVANCE"      //      "        "
    }
  ]
}
```

A party holding no credit returns `[]`. So does an unknown party: this is a
panel feed, and "no credit to offer" is the same screen either way. The party id
is validated where it is chosen — `GET /master-lookups/party-credit` 404s on an
unknown one — so a second existence check here would cost a round-trip on every
party change to display nothing different.

## What each field is for

**`billId` is not a key on its own.** `acc_bill_balance` is partitioned by
`abl_acc_year` and its primary key is the pair, so the adjustment must post
`billAccYear` as `abj_bill_acc_year` alongside `billId` as `abj_bill_id` or the
reference does not resolve.

**`billType` is the routing column** — not decoration, and not droppable once it
has done its job in the `WHERE`. It decides how the row settles:

| `billType` | `adjType` | `settlementMode` |
|---|---|---|
| `ADVANCE` | `ADVANCE_ADJUST` | `ADVANCE` |
| `SALES_RETURN` | `NOTE_ADJUST` | `CREDIT_NOTE` |

That mapping is what lets **one** tender row hold a mixed set of credits instead
of needing a separate row per kind. It is resolved server-side and returned as
`adjType` / `settlementMode` so there is one definition of it: a client that
re-derives the pair from `billType` drifts from `ck_abj_adj_type` the first time
a third credit type is admitted.

**`srcDocId`** is the sale order (or sales return) the credit came from. The bill
screen matches on it to pre-fill the panel when an order is imported —
`adjusted = pendingAmount` for every credit whose `srcDocId` is the imported
order.

**`billAmount` vs `pendingAmount`.** `billAmount` is face value, for the tooltip.
`pendingAmount` is the generated `bill − alloc − disc − writeoff` and is the only
ceiling an adjustment may be written against.

## Accounting year

`acc_bill_balance` is partitioned by the FY the credit **originated** in, and a
credit is never carried forward — it stays open in its original partition. A
March advance therefore really does adjust into an April invoice.

So the read carries no year filter and scans every partition, and each row
reports its own `billAccYear`. Filtering on the entry screen's year would make
the customer's money vanish on April 1 while it is still held. Showing the year
also matters on screen: two same-numbered documents from different years are
otherwise indistinguishable to the operator.

## Why the predicate is what it is

- **`abl_dr_cr = $4`** — bound from `type`, defaulted to `CR`, and never left
  out. CR = payable = the company owes the party; DR = receivable = the party
  owes the company. The side filters *alongside* the bill-type filter, not
  instead of it: `ADVANCE` is bidirectional in this schema, and a **supplier**
  advance is money paid out and lands DR. Drop the side clause — or read a
  missing `type` as "both sides" — and a party who is both customer and supplier
  offers their own supplier advances as settlement for a sales invoice.
- **`abl_bill_type IN (ADVANCE, SALES_RETURN)`** — `OPENING` and `JOURNAL`
  credits are deliberately not offered yet. `ck_abj_against` only lets
  `ADVANCE_ADJUST` / `NOTE_ADJUST` / `TRANSFER` name an opposite bill, and which
  of those an opening credit should post as is an accounting decision, not one to
  guess in a query. The list is bound from `AdjustableCreditBillType`, so
  admitting a third type means adding the enum member and its
  `CREDIT_ADJUSTMENT_ROUTING` entry — the SQL follows.
- **`abl_pending_amount > 0`** rather than `<> 0`: `ck_abl_settled` already keeps
  allocations at or below the bill, so a CR credit can never go negative. If one
  ever is, that is a bug to investigate, not a line to offer the cashier. The
  clause still matches `ix_abl_open`'s partial predicate
  (`abl_pending_amount <> 0`), so the index is used.
- **`ORDER BY abl_doc_date, abl_doc_refno`** — FIFO is what the ageing report
  assumes, what `ix_abl_open` is keyed for, and what a customer expects of their
  own money. The refno tie-break is not cosmetic: two credits dated the same day
  must not swap places between two fetches, or the auto-prefill on import lands
  on a different row than the operator last saw.

`ix_abl_open` is `(abl_company_id, abl_party_id, abl_doc_date)` with the refno
and both amounts `INCLUDE`d, partial on
`abl_is_deleted = false AND abl_pending_amount <> 0` — the query's filters and
ordering are written to match it.

## Money and dates

Every monetary column is `numeric(18,2)`; node-pg hands `numeric` back as a
string, so the exact fixed-point value leaves Postgres untouched by float and is
converted once, in the row mapper. `date` columns arrive as `YYYY-MM-DD` text
(`PgService`'s `DATE_AS_TEXT`), never a UTC-shifted midnight.

JSON cannot keep a trailing `.00`, so `18500.00` serialises as `18500` — the
value is the fixed-point one, its rendering is the client's.
