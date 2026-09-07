import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SaveOpeningStockVoucherDto } from './save-opening-stock-voucher.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46fe04';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const UOM_ID = '019c6f6c-be87-7a11-8905-36092c46fe06';

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
        { lineNo: 1, itemId: ITEM_ID, uomId: UOM_ID, godownId: GODOWN_ID, qty: 10, costRate: 20 },
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
          godownId: GODOWN_ID,
          qty: 1,
          costRate: 20,
          bucket: 'SHELF',
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // Not a validation rule but a documented one: the generated columns and the
  // header totals have no place on this DTO at all, so a client that sends them
  // is refused by forbidNonWhitelisted rather than having them quietly stripped
  // and then wondering why its totals were ignored.
  it('refuses a payload that tries to set a header total', async () => {
    await expect(transform({ totalQty: 175 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a line that tries to set a generated value column', async () => {
    await expect(
      transform({}, [
        {
          lineNo: 1,
          itemId: ITEM_ID,
          uomId: UOM_ID,
          godownId: GODOWN_ID,
          qty: 1,
          costRate: 20,
          value: 2400,
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a line that tries to choose its own lot or conversion factor', async () => {
    await expect(
      transform({}, [
        {
          lineNo: 1,
          itemId: ITEM_ID,
          uomId: UOM_ID,
          godownId: GODOWN_ID,
          qty: 1,
          costRate: 20,
          lotId: '019c6f6c-be87-7a11-8905-36092c46fe07',
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      transform({}, [
        {
          lineNo: 1,
          itemId: ITEM_ID,
          uomId: UOM_ID,
          godownId: GODOWN_ID,
          qty: 1,
          costRate: 20,
          toBaseFactor: 999,
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
