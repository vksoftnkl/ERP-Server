import type {
  BillLegInput,
  ReturnLegInput,
  SalesLeg,
  TaxBucket,
  TenderLegInput,
} from './types/sales-leg.types';

/**
 * The three leg sources of §3.2, as pure builders.
 *
 * They take a document that has ALREADY been loaded and return the leg list of
 * flow §5.3 in its fixed order. No database, no transaction: the reads belong
 * to the document's own module, and keeping the arithmetic pure is what lets
 * `/bills/validate` build the same legs without writing anything.
 *
 * **Every amount comes out POSITIVE and `drCr` carries the side.** A caller
 * that pre-negates an amount writes a row `ck_av_amount` refuses.
 */

/** Order is the contract — `av_row_no` follows it. See `VoucherPostingService` (src/common/posting). */
export function buildBillLegs(input: BillLegInput): SalesLeg[] {
  const legs: SalesLeg[] = [];

  // 1 — the party. A sale puts the customer into debit for the whole face
  //     value of the bill, and every tender then credits it back.
  const partyDebit = billPartyDebit(input);
  push(legs, {
    ledgerId: input.partyLedgerId,
    drCr: 'DR',
    amount: partyDebit,
    remarks: 'Bill value',
  });

  // 2 — sales. Line-level discounts (item / special / scheme) have already
  //     netted into the taxable value, which is Tally's default and 3.0's.
  push(legs, {
    role: 'SALES',
    roleTag: 'SALES',
    drCr: 'CR',
    amount: input.salesAmount,
    supplyNature: input.supplyNature,
    field: 'sbTaxableAmt',
  });

  // 3 — output tax, one leg per rate per head.
  pushTaxLegs(legs, input.taxes, input.supplyNature, 'CR');

  // 4 — charges that post separately. A charge "before tax" is already part of
  //     the taxable value and posts inside SALES unless cd_sep_post.
  for (const charge of input.charges) {
    if (!charge.separatelyPosted || round2(charge.amount) === 0) {
      continue;
    }
    push(legs, {
      ledgerId: charge.ledgerId,
      // A negative charge is a deduction and posts on the other side.
      drCr: charge.amount >= 0 ? 'CR' : 'DR',
      amount: Math.abs(charge.amount),
      remarks: charge.name ?? null,
      field: 'charges',
    });
    pushTaxLegs(
      legs,
      [
        {
          taxId: charge.taxId ?? null,
          cgst: charge.cgst ?? 0,
          sgst: charge.sgst ?? 0,
          igst: charge.igst ?? 0,
          cess: charge.cess ?? 0,
          acess: 0,
        },
      ],
      input.supplyNature,
      charge.amount >= 0 ? 'CR' : 'DR',
    );
  }

  // 5 — bill-level cash discount, after tax.
  push(legs, {
    role: 'DISCOUNT_ALLOWED',
    roleTag: 'DISCOUNT_ALLOWED',
    drCr: 'DR',
    amount: input.cashDiscount,
    field: 'sbCashDisc',
  });

  // 6 — scheme discount, ONLY when the setting says to split it out.
  push(legs, {
    role: 'SCHEME_DISCOUNT',
    roleTag: 'SCHEME_DISCOUNT',
    drCr: 'DR',
    amount: input.schemeDiscount,
    field: 'sbSchDisc',
  });

  // 7 — round-off, either way.
  if (round2(input.roundOff) !== 0) {
    push(legs, {
      role: 'ROUND_OFF',
      roleTag: 'ROUND_OFF',
      drCr: input.roundOff >= 0 ? 'CR' : 'DR',
      amount: Math.abs(input.roundOff),
      field: 'sbRoundOff',
    });
  }

  // 8 — TCS under 206C(1H).
  push(legs, {
    role: 'TCS_PAYABLE',
    roleTag: 'TCS_PAYABLE',
    drCr: 'CR',
    amount: input.tcsAmount,
    field: 'sbTcsAmt',
  });

  // 9 — the COGS pair, from StockPostingService. Zero under PERIODIC and on a
  //     bill raised against a DC, which already relieved the stock.
  legs.push(...buildCogsLegs(input.cogsAmount));

  // 10 — tenders. A CREDIT or TEMP_CREDIT tender writes NO LEG: the party
  //      stays debited, and that outstanding IS the receivable.
  for (const tender of input.tenders) {
    legs.push(...buildTenderLegs(tender, input.partyLedgerId));
  }

  // 11 — set-offs, last, so `av_row_no` stays stable when one appears. Only a
  //      credit held OUTSIDE the party ledger moves: DR where it sat, CR party.
  //      One held on the party already credited it (see SetOffLegInput).
  for (const setOff of input.setOffs) {
    if (setOff.ledgerId === input.partyLedgerId) {
      continue;
    }
    push(legs, {
      ledgerId: setOff.ledgerId,
      drCr: 'DR',
      amount: setOff.amount,
      remarks: setOff.remarks ?? 'Advance adjusted',
    });
    push(legs, {
      ledgerId: input.partyLedgerId,
      drCr: 'CR',
      amount: setOff.amount,
      remarks: setOff.remarks ?? 'Advance adjusted',
    });
  }

  return legs;
}

/**
 * A sale return is the bill's mirror, and its sales leg is its OWN role —
 * SALES_RETURN, not a negative SALES. A contra posted into the sales ledger
 * would understate turnover, which is the figure the GST return reports.
 */
export function buildReturnLegs(input: ReturnLegInput): SalesLeg[] {
  const legs: SalesLeg[] = [];

  const partyCredit = returnPartyCredit(input);
  push(legs, {
    ledgerId: input.partyLedgerId,
    drCr: 'CR',
    amount: partyCredit,
    remarks: 'Return value',
  });

  push(legs, {
    role: 'SALES_RETURN',
    roleTag: 'SALES_RETURN',
    drCr: 'DR',
    amount: input.salesAmount,
    supplyNature: input.supplyNature,
    field: 'srTaxableAmt',
  });

  // The output tax comes back the other way.
  pushTaxLegs(legs, input.taxes, input.supplyNature, 'DR');

  for (const charge of input.charges) {
    if (!charge.separatelyPosted || round2(charge.amount) === 0) {
      continue;
    }
    push(legs, {
      ledgerId: charge.ledgerId,
      drCr: charge.amount >= 0 ? 'DR' : 'CR',
      amount: Math.abs(charge.amount),
      remarks: charge.name ?? null,
      field: 'charges',
    });
  }

  push(legs, {
    role: 'DISCOUNT_ALLOWED',
    roleTag: 'DISCOUNT_ALLOWED',
    drCr: 'CR',
    amount: input.cashDiscount,
    field: 'srCashDisc',
  });
  push(legs, {
    role: 'SCHEME_DISCOUNT',
    roleTag: 'SCHEME_DISCOUNT',
    drCr: 'CR',
    amount: input.schemeDiscount,
    field: 'srSchDisc',
  });

  if (round2(input.roundOff) !== 0) {
    push(legs, {
      role: 'ROUND_OFF',
      roleTag: 'ROUND_OFF',
      drCr: input.roundOff >= 0 ? 'DR' : 'CR',
      amount: Math.abs(input.roundOff),
      field: 'srRoundOff',
    });
  }

  // The goods come BACK, so the COGS pair runs the other way.
  legs.push(...buildCogsLegs(input.cogsAmount, 'RETURN'));

  for (const tender of input.tenders) {
    // A refund pays the customer: the tender ledger is credited and the party
    // debited, the exact mirror of a bill's tender.
    legs.push(...buildTenderLegs(tender, input.partyLedgerId, 'RETURN'));
  }

  return legs;
}

/**
 * DR COGS / CR INVENTORY — used ALONE by a delivery challan and a DC return,
 * which move goods and no money, and appended to a bill and a return.
 *
 * `direction` flips it: goods coming back credit COGS and debit inventory.
 */
export function buildCogsLegs(
  cogsAmount: number,
  direction: 'ISSUE' | 'RETURN' = 'ISSUE',
): SalesLeg[] {
  if (round2(cogsAmount) === 0) {
    return [];
  }
  const out = direction === 'ISSUE';
  return [
    {
      role: 'COGS',
      roleTag: 'COGS',
      drCr: out ? 'DR' : 'CR',
      amount: Math.abs(cogsAmount),
      field: 'cogsAmt',
    },
    {
      role: 'INVENTORY',
      roleTag: 'INVENTORY',
      drCr: out ? 'CR' : 'DR',
      amount: Math.abs(cogsAmount),
      field: 'cogsAmt',
    },
  ];
}

/**
 * One tender row's legs.
 *
 * Three cases and they are genuinely different:
 *
 *  * CREDIT (type 9) and TEMP_CREDIT (type 8) write NOTHING. The party stays
 *    debited and that debit IS the outstanding — a leg here would settle a
 *    bill nobody has paid for.
 *  * LOYALTY (type 10) posts DR LOYALTY_REDEMPTION, and the tender master's
 *    own `tnd_ledger_id` is IGNORED: points are not money the shop received.
 *  * everything else posts DR its tender ledger / CR the party.
 */
export function buildTenderLegs(
  tender: TenderLegInput,
  partyLedgerId: string,
  direction: 'BILL' | 'RETURN' = 'BILL',
): SalesLeg[] {
  if (tender.isCredit || round2(tender.amount) === 0) {
    return [];
  }
  const paying = direction === 'BILL';

  const settlement: SalesLeg = tender.isLoyalty
    ? {
        role: 'LOYALTY_REDEMPTION',
        roleTag: 'LOYALTY_REDEMPTION',
        drCr: paying ? 'DR' : 'CR',
        amount: Math.abs(tender.amount),
        field: 'tenders',
      }
    : {
        ledgerId: tender.tenderLedgerId,
        drCr: paying ? 'DR' : 'CR',
        amount: Math.abs(tender.amount),
        remarks: tender.name ?? null,
        field: 'tenders',
      };

  return [
    settlement,
    {
      ledgerId: partyLedgerId,
      drCr: paying ? 'CR' : 'DR',
      amount: Math.abs(tender.amount),
      remarks: tender.name ?? null,
    },
  ];
}

// ─── internals ──────────────────────────────────────────────────────────────

/**
 * What the party is debited for: everything the bill charges, before any
 * tender settles it. Building it from the same parts the credit legs use is
 * what makes Σ DR = Σ CR hold by construction rather than by luck.
 */
function billPartyDebit(input: BillLegInput): number {
  const tax = input.taxes.reduce((s, t) => s + t.cgst + t.sgst + t.igst + t.cess + t.acess, 0);
  const charges = input.charges
    .filter((c) => c.separatelyPosted)
    .reduce(
      (s, c) => s + c.amount + (c.cgst ?? 0) + (c.sgst ?? 0) + (c.igst ?? 0) + (c.cess ?? 0),
      0,
    );
  return round2(
    input.salesAmount +
      tax +
      charges +
      input.roundOff +
      input.tcsAmount -
      input.cashDiscount -
      input.schemeDiscount,
  );
}

function returnPartyCredit(input: ReturnLegInput): number {
  const tax = input.taxes.reduce((s, t) => s + t.cgst + t.sgst + t.igst + t.cess + t.acess, 0);
  const charges = input.charges.filter((c) => c.separatelyPosted).reduce((s, c) => s + c.amount, 0);
  return round2(
    input.salesAmount + tax + charges + input.roundOff - input.cashDiscount - input.schemeDiscount,
  );
}

/** CGST and SGST exist only intra-state, IGST only inter-state. */
function pushTaxLegs(
  legs: SalesLeg[],
  buckets: TaxBucket[],
  supplyNature: 'INTRA' | 'INTER',
  drCr: 'DR' | 'CR',
): void {
  for (const bucket of buckets) {
    const heads: [string, number][] = [
      ['OUTPUT_CGST', bucket.cgst],
      ['OUTPUT_SGST', bucket.sgst],
      ['OUTPUT_IGST', bucket.igst],
      ['OUTPUT_CESS', bucket.cess],
      ['OUTPUT_ACESS', bucket.acess],
    ];
    for (const [role, amount] of heads) {
      push(legs, {
        role,
        roleTag: role,
        drCr,
        amount,
        taxId: bucket.taxId,
        supplyNature,
        field: 'taxes',
      });
    }
  }
}

/** A zero leg is not an event — and `ck_av_amount` refuses it anyway. */
function push(legs: SalesLeg[], leg: SalesLeg): void {
  if (round2(leg.amount) !== 0) {
    legs.push({ ...leg, amount: round2(leg.amount) });
  }
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * 100) / 100;
}
