import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import type { RequestContextService } from '../../../common/request-context/request-context.service';
import type { SalesContextService } from '../posting/sales-context.service';
import { BillVoucherTypeService } from './bill-voucher-type.service';
import { billTypeChoices } from './bill-voucher-type.helper';
import { previewNextVoucherNumber } from '../../../common/Sequence/voucher-sequence.helper';

jest.mock('../../../common/posting/rights', () => ({
  assertMenuRight: jest.fn(async () => undefined),
}));
jest.mock('../../../common/Sequence/voucher-sequence.helper', () => ({
  previewNextVoucherNumber: jest.fn(async () => ({ refno: 'NEXT', code: null })),
}));
jest.mock('./bill-voucher-type.helper', () => ({
  ...jest.requireActual('./bill-voucher-type.helper'),
  billTypeChoices: jest.fn(),
}));

/**
 * Review N11 — /bills/voucher-type-choices previews the number the save draws:
 * sales.pos_series_per_device is read as createBillInTx reads it (company /
 * branch scope, no device), and the counter comes from the same
 * billSeriesDeviceCode the save calls.
 */

const ACME = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const CBE = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const DEV = '019ea5d1-261f-7f3d-b350-93a30c147788';

const offered = [
  {
    vchrTypeId: 3,
    vchrTypeCode: 'Bil',
    vchrTypeName: 'Sales Bill',
    vchrTypeShort: 'Bil',
    vchrParentId: null,
    vchrNoPrefix: 'bil',
    vchrSortOrder: 300,
    vchrDeliveryMode: 'INSTANT',
  },
  {
    vchrTypeId: 68,
    vchrTypeCode: 'Bil-RT',
    vchrTypeName: 'Retail',
    vchrTypeShort: 'RT',
    vchrParentId: 3,
    vchrNoPrefix: 'RT{BR}',
    vchrSortOrder: 301,
    vchrDeliveryMode: null,
  },
  {
    vchrTypeId: 69,
    vchrTypeCode: 'Bil-WS',
    vchrTypeName: 'Wholesale',
    vchrTypeShort: 'WS',
    vchrParentId: 3,
    vchrNoPrefix: 'WS{BR}',
    vchrSortOrder: 302,
    vchrDeliveryMode: 'PICKUP',
  },
];

const make = (posSeriesPerDevice: boolean, offline = false) => {
  (billTypeChoices as jest.Mock).mockResolvedValue({
    offered,
    defaultVchrTypeId: null,
    offerBase: true,
  });
  const salesContext = {
    settings: jest.fn(async () => ({ posSeriesPerDevice })),
    values: jest.fn(async () => ({})),
  };
  const config = {
    get: jest.fn((key: string) => (key === 'cloudSync.enabled' ? offline : undefined)),
  };
  const service = new BillVoucherTypeService(
    {} as PrismaService,
    salesContext as unknown as SalesContextService,
    { getUserId: () => 'u' } as unknown as RequestContextService,
    config as unknown as ConfigService,
  );
  return { service, salesContext };
};

const query = (billMode?: 'POS' | 'WHOLESALE') => ({
  companyId: ACME,
  branchId: CBE,
  accYear: '2026-2027',
  deviceId: DEV,
  billMode,
});

const deviceCodes = () =>
  (previewNextVoucherNumber as jest.Mock).mock.calls.map(
    ([, scope]: [unknown, { vchrTypeId: number; deviceCode: string | null }]) => [
      scope.vchrTypeId,
      scope.deviceCode,
    ],
  );

describe('BillVoucherTypeService.choices (review N11)', () => {
  beforeEach(() => (previewNextVoucherNumber as jest.Mock).mockClear());

  it('reads sales.pos_series_per_device without the device, as the save does', async () => {
    const { service, salesContext } = make(true);
    await service.choices(query('POS'));
    expect(salesContext.settings).toHaveBeenCalledTimes(1);
    expect(salesContext.settings).toHaveBeenCalledWith(ACME, CBE);
  });

  it('previews Sales Bill on the device series in POS mode, a child on the branch counter', async () => {
    const { service } = make(true);
    const data = await service.choices(query('POS'));
    expect(deviceCodes()).toEqual([
      [3, DEV],
      [68, null],
      [69, null],
    ]);
    expect(data.choices.map((c) => c.nextRefno)).toEqual(['NEXT', 'NEXT', 'NEXT']);
  });

  it('previews the branch counter in WHOLESALE mode, or when the setting is off', async () => {
    await make(true).service.choices(query('WHOLESALE'));
    await make(false).service.choices(query('POS'));
    expect(deviceCodes()).toEqual([
      [3, null],
      [68, null],
      [69, null],
      [3, null],
      [68, null],
      [69, null],
    ]);
  });
});

describe('BillVoucherTypeService.choices at an offline site (decision 64, re-review R2)', () => {
  beforeEach(() => (billTypeChoices as jest.Mock).mockClear());

  it('asks the offer rule for an offline site when CLOUD_SYNC_ENABLED is on', async () => {
    await make(true, true).service.choices(query('WHOLESALE'));
    expect(billTypeChoices).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ companyId: ACME, branchId: CBE, offlineSite: true }),
    );
  });

  it('and as the main server when it is off', async () => {
    await make(true, false).service.choices(query('WHOLESALE'));
    expect(billTypeChoices).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ offlineSite: false }),
    );
  });

  it('answers hasChildTypes false when only Sales Bill is offered', async () => {
    const { service } = make(true, true);
    (billTypeChoices as jest.Mock).mockResolvedValue({
      offered: [offered[0]],
      defaultVchrTypeId: null,
      offerBase: false,
    });
    const data = await service.choices(query('WHOLESALE'));
    expect(data.choices.map((c) => c.vchrTypeId)).toEqual([3]);
    expect(data.hasChildTypes).toBe(false);
  });
});

describe('BillVoucherTypeService.choices — deliveryMode (delivery tracking Q3, decision 42)', () => {
  it('gives each choice its own mode, else Sales Bill’s, else INSTANT', async () => {
    const data = await make(true).service.choices(query('WHOLESALE'));
    expect(data.choices.map((c) => [c.vchrTypeId, c.deliveryMode])).toEqual([
      [3, 'INSTANT'],
      [68, 'INSTANT'],
      [69, 'PICKUP'],
    ]);
  });

  it('answers INSTANT for every choice of a POS bill', async () => {
    const data = await make(true).service.choices(query('POS'));
    expect(data.choices.map((c) => c.deliveryMode)).toEqual(['INSTANT', 'INSTANT', 'INSTANT']);
  });
});
