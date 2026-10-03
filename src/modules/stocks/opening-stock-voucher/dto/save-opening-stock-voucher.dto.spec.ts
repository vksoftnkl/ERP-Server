import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SaveOpeningStockVoucherDto } from './save-opening-stock-voucher.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46fe04';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const UOM_ID = '019c6f6c-be87-7a11-8905-36092c46fe06';
const BASE_UOM_ID = '019c6f6c-be87-7a11-8905-36092c46fe08';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const transform = (header: Record<string, unknown> = {}, lines?: unknown[]) =>
  validationPipe.transform(
    {
      header: {
        accYear: '2026-2027',
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        deviceId: DEVICE_ID,
        docDate: '2026-04-01',
        toGodownId: GODOWN_ID,
        ...header,
      },
      lines: lines ?? [
        {
          lineNo: 1,
          itemId: ITEM_ID,
          uomId: UOM_ID,
          baseUomId: BASE_UOM_ID,
          toBaseFactor: 12,
          baseQty: 120,
          godownId: GODOWN_ID,
          qty: 10,
          costRate: 20,
        },
      ],
    },
    { type: 'body', metatype: SaveOpeningStockVoucherDto },
  ) as Promise<SaveOpeningStockVoucherDto>;

describe('SaveOpeningStockVoucherDto', () => {
  it('accepts a well-formed opening', async () => {
    const result = await transform();

    expect(result.header.accYear).toBe('2026-2027');
    expect(result.lines).toHaveLength(1);
  });

  // The route pins OPENING. A payload claiming another type is refused rather
  // than silently honoured: a transfer posted through this route would leave
  // its stock_transit row uncreated.
  it('refuses a voucherType other than OPENING', async () => {
    await expect(transform({ voucherType: 'TRANSFER_OUT' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts an explicit OPENING, which the controller then ignores anyway', async () => {
    const result = await transform({ voucherType: 'OPENING' });

    expect(result.header.voucherType).toBe('OPENING');
  });

  // bpchar space-pads anything shorter than nine characters and ck_svh_acc_year
  // then rejects the padded value with a message mentioning neither.
  it.each(['2026', '2026-27', '26-27', '2026_2027'])(
    'refuses the malformed accYear %s',
    async (accYear) => {
      await expect(transform({ accYear })).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('refuses a docDate that is not yyyy-MM-dd', async () => {
    await expect(transform({ docDate: '01/04/2026' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses an unknown rate source', async () => {
    await expect(transform({ rateSource: 'GUESS' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses an unknown bucket on a line', async () => {
    await expect(
      transform({}, [
        {
          lineNo: 1,
          itemId: ITEM_ID,
          uomId: UOM_ID,
          baseUomId: BASE_UOM_ID,
          toBaseFactor: 12,
          baseQty: 120,
          godownId: GODOWN_ID,
          qty: 1,
          costRate: 20,
          bucket: 'SHELF',
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // THE HEADER TOTALS ARE NOW THE SCREEN'S — this used to be the test that
  // refused them, back when tr_svi_refresh_header and fn_svh_recompute were the
  // only things allowed to write the four columns. They are accepted and
  // written verbatim; see 'accepts the four header totals from the payload'.
  //
  // The GENERATED columns are a different matter and are still refused: no
  // trigger owns svi_value, svi_value_wot or svi_diff_qty — Postgres itself
  // rejects any write to them, including a write of the value it would compute.
  it('refuses a line that tries to set a generated value column', async () => {
    await expect(
      transform({}, [
        {
          lineNo: 1,
          itemId: ITEM_ID,
          uomId: UOM_ID,
          baseUomId: BASE_UOM_ID,
          toBaseFactor: 12,
          baseQty: 120,
          godownId: GODOWN_ID,
          qty: 1,
          costRate: 20,
          value: 2400,
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // lotId IS a valid field on the SHARED line DTO — a COUNT line comes from a
  // count sheet that names the holding it reconciles, and a TRANSFER must carry
  // the same lot to the destination or ageing resets. The OPENING route now
  // narrows it away on its own line DTO, so what used to be a silent discard
  // (the service forced it to NULL) is a 400 that names the property.
  it.each(['lotId', 'bookQty', 'countedQty', 'reasonId', 'syncDate'])(
    'refuses %s, which belongs to a count, to the post, or to the header',
    async (field) => {
      await expect(
        transform({}, [
          {
            lineNo: 1,
            itemId: ITEM_ID,
            uomId: UOM_ID,
            baseUomId: BASE_UOM_ID,
            toBaseFactor: 12,
            baseQty: 120,
            godownId: GODOWN_ID,
            qty: 1,
            costRate: 20,
            [field]:
              field === 'lotId' || field === 'reasonId'
                ? '019c6f6c-be87-7a11-8905-36092c46fe07'
                : field === 'syncDate'
                  ? '2026-09-07T14:48:33.947Z'
                  : 5,
          },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  // THE BATCH GROUP IS KEPT, and this is the test that says why: these seven
  // properties are what fn_slt_resolve builds stock_lot from at post time. An
  // opening that could not send them could not bring in a batch- or
  // serial-tracked item at all.
  it('still accepts the batch attributes that become the lot', async () => {
    const result = await transform({}, [
      {
        lineNo: 1,
        splitNo: 2,
        itemId: ITEM_ID,
        uomId: UOM_ID,
        baseUomId: BASE_UOM_ID,
        toBaseFactor: 12,
        baseQty: 120,
        godownId: GODOWN_ID,
        bucket: 'DAMAGED',
        qty: 10,
        costRate: 20,
        batchNo: 'B-2604',
        mfgDate: '2026-04-01',
        expiryDate: '2026-06-30',
        mrp: 30,
        salePrice: 28,
        serialNo: 'SN-1',
        supplierId: '019c6f6c-be87-7a11-8905-36092c46fe0b',
        weightQty: 9.7,
        landedRate: 22.5,
      },
    ]);

    expect(result.lines[0]).toMatchObject({
      batchNo: 'B-2604',
      expiryDate: '2026-06-30',
      serialNo: 'SN-1',
      bucket: 'DAMAGED',
      splitNo: 2,
      weightQty: 9.7,
    });
  });

  // THE LINE NOW CHOOSES ITS OWN CONVERSION, and this used to be the test that
  // refused it. The server no longer reads item_unit_conversion on the save
  // path: the screen sends the factor and the base quantities it priced the
  // line with, and they are written verbatim.
  it('accepts the conversion factor and base quantities the line states', async () => {
    const result = await transform({}, [
      {
        lineNo: 1,
        itemId: ITEM_ID,
        uomId: UOM_ID,
        baseUomId: BASE_UOM_ID,
        toBaseFactor: 12,
        baseQty: 120,
        freeBaseQty: 60,
        godownId: GODOWN_ID,
        qty: 10,
        freeQty: 5,
        costRate: 20,
      },
    ]);

    expect(result.lines[0]).toMatchObject({
      baseUomId: BASE_UOM_ID,
      toBaseFactor: 12,
      baseQty: 120,
      freeBaseQty: 60,
    });
  });

  // svi_base_uom_id, svi_to_base_factor and svi_base_qty are all NOT NULL, and
  // nothing fills them in any more, so their absence has to be a 400 here
  // rather than a NOT NULL violation from Postgres forty lines later.
  it.each(['baseUomId', 'toBaseFactor', 'baseQty'])(
    'refuses a line with no %s',
    async (missing) => {
      const line: Record<string, unknown> = {
        lineNo: 1,
        itemId: ITEM_ID,
        uomId: UOM_ID,
        baseUomId: BASE_UOM_ID,
        toBaseFactor: 12,
        baseQty: 120,
        godownId: GODOWN_ID,
        qty: 10,
        costRate: 20,
      };
      delete line[missing];

      await expect(transform({}, [line])).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  // ck_svi_to_base_factor CHECKs (svi_to_base_factor > 0). A zero factor would
  // otherwise reach the database and be refused by constraint name.
  it.each([0, -1])('refuses a toBaseFactor of %s', async (factor) => {
    await expect(
      transform({}, [
        {
          lineNo: 1,
          itemId: ITEM_ID,
          uomId: UOM_ID,
          baseUomId: BASE_UOM_ID,
          toBaseFactor: factor,
          baseQty: 120,
          godownId: GODOWN_ID,
          qty: 10,
          costRate: 20,
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // All four are NOT NULL DEFAULT 0, so they are optional — but when sent they
  // are what the document stores. The server counts nothing.
  it('accepts the four header totals from the payload', async () => {
    const result = await transform({
      lineCount: 1,
      totalQty: 120,
      totalValue: 2400.5,
      totalValueWot: 2286.19,
    });

    expect(result.header).toMatchObject({
      lineCount: 1,
      totalQty: 120,
      totalValue: 2400.5,
      totalValueWot: 2286.19,
    });
  });

  it('refuses a fractional lineCount — svh_line_count is an integer column', async () => {
    await expect(transform({ lineCount: 1.5 })).rejects.toBeInstanceOf(BadRequestException);
  });

  // ── Nine header fields the SHARED voucher DTO carries and this one omits ──
  //
  // Every one is now refused by `forbidNonWhitelisted` alone, because this DTO
  // is STANDALONE and simply does not declare them — there is no @IsEmpty
  // anywhere. lrNo / vehicleNo / expectedOn are stock_transit columns that used
  // to be accepted and SILENTLY DISCARDED; fromGodownId and reasonId were
  // stored on a document they do not describe; toBranchId and the freeze window
  // were 422s from assertPayloadRules, which still refuses them on the other
  // routes that share the base class.
  it.each([
    ['lrNo', 'LR-99'],
    ['vehicleNo', 'TN-01-AB-1234'],
    ['expectedOn', '2026-09-12'],
    ['fromGodownId', GODOWN_ID],
    ['reasonId', '019c6f6c-be87-7a11-8905-36092c46fe09'],
    ['toBranchId', '019c6f6c-be87-7a11-8905-36092c46fe0c'],
    // An opening is the starting figure, not a receipt from anybody, and this
    // route is not the offline path.
    ['supplierId', '019c6f6c-be87-7a11-8905-36092c46fe0b'],
    ['partyRef', 'DOCKET-1'],
    ['syncDate', '2026-09-07T14:48:33.947Z'],
    ['freezeStock', true],
    ['freezeFrom', '2026-09-07T14:07:53.578Z'],
    ['freezeTo', '2026-09-07T18:07:53.578Z'],
  ])('refuses %s, which belongs to a transfer, an adjustment or a count', async (field, value) => {
    await expect(transform({ [field]: value })).rejects.toBeInstanceOf(BadRequestException);
  });

  // ── What the STANDALONE DTO buys that extending never could ─────────────
  //
  // A subclass cannot TIGHTEN an inherited property: @IsOptional() on the base
  // whitelists undefined for every validator on it, so a @RequiredUuid() added
  // downstream never fires. Both of these were therefore 422s from
  // assertPayloadRules — reported after the whole payload had been walked —
  // and are now 400s naming the field.
  it('refuses a header with no toGodownId — an opening must say where stock arrives', async () => {
    const header: Record<string, unknown> = {
      accYear: '2026-2027',
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      deviceId: DEVICE_ID,
      docDate: '2026-04-01',
    };

    await expect(
      validationPipe.transform(
        {
          header,
          lines: [
            {
              lineNo: 1,
              itemId: ITEM_ID,
              uomId: UOM_ID,
              baseUomId: BASE_UOM_ID,
              toBaseFactor: 12,
              baseQty: 120,
              godownId: GODOWN_ID,
              qty: 10,
              costRate: 20,
            },
          ],
        },
        { type: 'body', metatype: SaveOpeningStockVoucherDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a line with no uomId — svi_uom_id is NOT NULL and nothing fills it in', async () => {
    await expect(
      transform({}, [
        {
          lineNo: 1,
          itemId: ITEM_ID,
          baseUomId: BASE_UOM_ID,
          toBaseFactor: 12,
          baseQty: 120,
          godownId: GODOWN_ID,
          qty: 10,
          costRate: 20,
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ck_svi_qty_sign — quantities are MAGNITUDES; direction comes from the
  // voucher type. Also a 422 before, because the shared line carried no minimum.
  it.each(['qty', 'freeQty', 'baseQty', 'weightQty', 'costRate'])(
    'refuses a negative %s',
    async (field) => {
      await expect(
        transform({}, [
          {
            lineNo: 1,
            itemId: ITEM_ID,
            uomId: UOM_ID,
            baseUomId: BASE_UOM_ID,
            toBaseFactor: 12,
            baseQty: 120,
            godownId: GODOWN_ID,
            qty: 10,
            costRate: 20,
            [field]: -1,
          },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  // STILL THE SERVICE'S, and deliberately: neither is a property of one field.
  // A free-goods line legitimately has qty 0, and whether costRate is required
  // depends on the header's rateSource.
  it('accepts a line with qty 0 and free goods — the qty/freeQty pair is a service rule', async () => {
    const result = await transform({}, [
      {
        lineNo: 1,
        itemId: ITEM_ID,
        uomId: UOM_ID,
        baseUomId: BASE_UOM_ID,
        toBaseFactor: 12,
        baseQty: 0,
        godownId: GODOWN_ID,
        qty: 0,
        freeQty: 5,
        freeBaseQty: 60,
        costRate: 20,
      },
    ]);

    expect(result.lines[0].qty).toBe(0);
    expect(result.lines[0].freeQty).toBe(5);
  });

  // Nothing CAUSES an opening — it is where the ledger starts, so there is no
  // source document to point at. ck_svh_link is all-or-nothing and is satisfied
  // by all four staying NULL, which is what the service now always writes.
  it.each(['linkSrcModule', 'linkSrcDocType', 'linkSrcDocId', 'linkSrcAccYear'])(
    'refuses %s — an opening answers no document',
    async (field) => {
      await expect(transform({ [field]: 'MIGRATION' })).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
