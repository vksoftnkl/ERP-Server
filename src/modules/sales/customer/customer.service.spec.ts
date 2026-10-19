import { ConflictException, HttpException } from '@nestjs/common';
import { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { CustomerService } from './customer.service';
import { SaveCustomerDto } from './dto/save-customer.dto';
import { CustomerErrorCode } from './types/customer-error-codes';

const CUS_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46e102';
const AREA_ID = '019c6f6c-be87-7a11-8905-36092c46e103';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46e104';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e105';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e106';
const SUPPLIERS_GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46e107';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e108';
const STAMP = new Date('2026-10-01T04:30:00.000Z');

const customerRow = (overrides: Partial<Customer> = {}): Customer => ({
  cusId: CUS_ID,
  cusTitle: null,
  cusShort: null,
  cusCode: null,
  cusName: 'Ravi Stores',
  cusAddr1: null,
  cusAddr2: null,
  cusAddr3: null,
  cusCity: null,
  cusDistrict: null,
  cusStateName: 'Tamil Nadu',
  cusCountry: null,
  cusStateCode: '33',
  cusLandmark: null,
  cusPin: null,
  cusTel: null,
  cusPhone1: null,
  cusPhone2: null,
  cusWhatsappNo: null,
  cusEmail: null,
  cusAadharNo: null,
  cusContactPerson: null,
  cusDistanceKm: null,
  cusCreditAllowed: false,
  cusCreditBillLimit: 0,
  cusCreditAmtLimit: new Prisma.Decimal(0),
  cusCreditDays: 0,
  cusDebitBalance: new Prisma.Decimal(0),
  cusDiscPerc: new Prisma.Decimal(0),
  cusDebitGraceDays: 0,
  cusEnableSms: false,
  cusOverdueSms: false,
  cusOverdueBilling: false,
  cusAllowPromotion: true,
  cusAllowLoyalty: true,
  cusAllowDiscount: true,
  cusSortOrder: 0,
  cusRegionName: null,
  cusRegionAddr1: null,
  cusRegionAddr2: null,
  cusRegionAddr3: null,
  cusRegionCity: null,
  cusRegionDistrict: null,
  cusRegionStateName: null,
  cusRegionCountry: null,
  cusBirthDate: null,
  cusMarriageDate: null,
  cusTransportName: null,
  cusFreightCharge: false,
  cusLoadingCharge: false,
  cusUnloadingCharge: false,
  cusGstNo: null,
  cusPanNo: null,
  cusForm60On: null,
  cusPanVerifiedOn: null,
  cusGstType: null,
  cusEcommerceGstin: null,
  cusTcsApplicable: false,
  cusItcollExempted: false,
  cusItcollType: null,
  cusGeoLocation: null,
  cusCollectionDays: [],
  cusDefaultSalesman: null,
  cusPriceLevelId: 1,
  cusBilledDate: STAMP,
  cusBilledCount: 1,
  cusNotes: null,
  cusCompanyId: null,
  cusBranchId: null,
  cusAreaId: AREA_ID,
  cusGroupId: GROUP_ID,
  cusIsActive: true,
  cusIsDeleted: false,
  cusSyncDate: null,
  cusCreatedOn: STAMP,
  cusCreatedBy: USER_ID,
  cusModifiedOn: STAMP,
  cusModifiedBy: USER_ID,
  ...overrides,
});

/** A party ledger as the link create reads it; only the fields the service touches. */
const ledgerRow = (overrides: Record<string, unknown> = {}) => ({
  ledId: LEDGER_ID,
  ledName: 'Ravi Traders',
  ledLedgerType: 'PARTY',
  ledStateName: 'Kerala',
  ledStateCode: '32',
  ledPhone1: '9840000001',
  ledEmail: 'accounts@ravi.example',
  ledGstinNo: '32ABCDE1234F1Z5',
  ledRemarks: 'Supplier since 2024',
  ledIsActive: false,
  ledSortOrder: 9,
  ledAllowSms: true,
  ledGroupId: SUPPLIERS_GROUP_ID,
  ...overrides,
});

const createDto = (overrides: Partial<SaveCustomerDto> = {}): SaveCustomerDto => ({
  cusName: '  Ravi Stores  ',
  cusStateName: ' Tamil Nadu ',
  cusStateCode: '33',
  cusAreaId: AREA_ID,
  cusGroupId: GROUP_ID,
  cusPriceLevelId: 1,
  ...overrides,
});

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

type PrismaMock = {
  customer: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  accLedgerMaster: { findFirst: jest.Mock; updateMany: jest.Mock };
  supplier: { findFirst: jest.Mock };
  company: { findFirst: jest.Mock };
  branchMaster: { findFirst: jest.Mock };
  areaMaster: { findFirst: jest.Mock };
  custGroup: { findFirst: jest.Mock };
  itemPriceLevel: { findFirst: jest.Mock };
  stateCode: { findFirst: jest.Mock };
  $transaction: jest.Mock;
};

describe('CustomerService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let ledgers: { createLedgerWithinTx: jest.Mock; updateLedgerWithinTx: jest.Mock };
  let service: CustomerService;

  beforeEach(() => {
    prisma = {
      customer: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<Customer> }) => customerRow(data)),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
          customerRow({ ...(data as Partial<Customer>), cusBilledCount: 2 }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      accLedgerMaster: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      supplier: { findFirst: jest.fn().mockResolvedValue(null) },
      company: { findFirst: jest.fn().mockResolvedValue({ compId: COMPANY_ID, compName: 'Zeta' }) },
      branchMaster: { findFirst: jest.fn().mockResolvedValue({ brName: 'Main Branch' }) },
      areaMaster: { findFirst: jest.fn().mockResolvedValue({ armId: AREA_ID, armName: 'Beat 4' }) },
      custGroup: { findFirst: jest.fn().mockResolvedValue({ cgrId: GROUP_ID, cgrName: 'Retail' }) },
      itemPriceLevel: { findFirst: jest.fn().mockResolvedValue({ iplName: 'MRP' }) },
      stateCode: { findFirst: jest.fn().mockResolvedValue({ stateCode: '33' }) },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    ledgers = {
      createLedgerWithinTx: jest.fn().mockResolvedValue({ ledId: LEDGER_ID }),
      updateLedgerWithinTx: jest.fn().mockResolvedValue({}),
    };
    service = new CustomerService(
      prisma as unknown as PrismaService,
      audit as never,
      context as never,
      ledgers as never,
    );
  });

  const createdData = () =>
    (prisma.customer.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const updatedData = () =>
    (prisma.customer.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const ledgerCreateDto = () =>
    ledgers.createLedgerWithinTx.mock.calls[0][0] as Record<string, unknown>;
  const ledgerUpdateDto = () =>
    ledgers.updateLedgerWithinTx.mock.calls[0][0] as Record<string, unknown>;
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('save — create on a new ledger', () => {
    it('provisions the ledger first and takes its id as the customer id', async () => {
      const payload = await service.save(createDto());

      expect(ledgers.createLedgerWithinTx).toHaveBeenCalledWith(
        {
          ledGroupId: AREA_ID,
          ledName: 'Ravi Stores',
          ledStateName: 'Tamil Nadu',
          ledStateCode: '33',
          ledIsBillByBill: true,
        },
        prisma,
      );
      expect(createdData()).toMatchObject({
        cusId: LEDGER_ID,
        cusName: 'Ravi Stores',
        cusStateName: 'Tamil Nadu',
        cusStateCode: '33',
        cusCompanyId: null,
        cusAreaId: AREA_ID,
        cusGroupId: GROUP_ID,
        cusPriceLevelId: 1,
        cusCollectionDays: [],
        cusBilledCount: 1,
        cusCreatedBy: USER_ID,
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'customers',
        pk: LEDGER_ID,
        originalRecord: null,
        modifiedRecord: payload,
        notes: 'Customer created',
      });
    });

    it('copies the shared fields it was sent onto the ledger under their ledger names', async () => {
      await service.save(
        createDto({
          cusCompanyId: COMPANY_ID,
          cusBranchId: BRANCH_ID,
          cusPhone1: '9840000001',
          cusGstNo: '33ABCDE1234F1Z5',
          cusNotes: 'Pays on Fridays',
          cusIsActive: false,
          cusSortOrder: 3,
        }),
      );

      expect(ledgerCreateDto()).toEqual({
        ledGroupId: AREA_ID,
        ledName: 'Ravi Stores',
        ledStateName: 'Tamil Nadu',
        ledStateCode: '33',
        ledIsBillByBill: true,
        ledCompanyId: COMPANY_ID,
        ledBranchId: BRANCH_ID,
        ledPhone1: '9840000001',
        ledGstinNo: '33ABCDE1234F1Z5',
        ledRemarks: 'Pays on Fridays',
        ledIsActive: false,
        ledSortOrder: 3,
      });
    });

    it.each([
      ['regular', 'REGULAR'],
      ['Composition', 'COMPOSITION'],
      ['un-registered', 'UNREGISTERED'],
      ['Un Registered', 'UNREGISTERED'],
      ['SEZ', null],
      ['', null],
      [null, null],
    ])('maps a GST type of %p to the ledger vocabulary as %p', async (cusGstType, expected) => {
      await service.save(createDto({ cusGstType }));

      expect(ledgerCreateDto().ledGstPartyRegType).toBe(expected);
    });

    it.each([
      ['a TCS flag', { cusTcsApplicable: true }, { ledIsTcsApplicable: true }],
      [
        'a TDS collection type',
        { cusItcollType: ' tds ' },
        { ledIsTcsApplicable: false, ledIsTdsApplicable: true },
      ],
      [
        'a TCS collection type',
        { cusItcollType: 'TCS' },
        { ledIsTcsApplicable: true, ledIsTdsApplicable: false },
      ],
      [
        'an exemption, which vetoes both',
        { cusTcsApplicable: true, cusItcollType: 'TCS', cusItcollExempted: true },
        { ledIsTcsApplicable: false, ledIsTdsApplicable: false },
      ],
    ])('turns %s into the ledger TCS/TDS flags', async (_label, fields, expected) => {
      await service.save(createDto(fields));

      expect(ledgerCreateDto()).toMatchObject(expected);
    });

    it('leaves the TDS flag alone when only the TCS flag was sent', async () => {
      await service.save(createDto({ cusTcsApplicable: false }));

      expect(ledgerCreateDto()).toMatchObject({ ledIsTcsApplicable: false });
      expect(ledgerCreateDto()).not.toHaveProperty('ledIsTdsApplicable');
    });

    it('stores a birth date as a Date and refuses one that is not a date', async () => {
      await service.save(createDto({ cusBirthDate: '1990-05-01' }));
      expect(createdData().cusBirthDate).toEqual(new Date('1990-05-01'));

      const refusal = await refusalOf(service.save(createDto({ cusMarriageDate: '31/02/2020' })));
      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'cusMarriageDate', code: CustomerErrorCode.INVALID_DATE }] },
      });
    });

    it('upper-cases the state code before checking it against the state list', async () => {
      await service.save(createDto({ cusStateCode: ' tn ' }));

      expect(prisma.stateCode.findFirst).toHaveBeenCalledWith({
        where: { stateCode: 'TN', isDeleted: false },
        select: { stateCode: true },
      });
      expect(createdData().cusStateCode).toBe('TN');
    });

    it.each([
      ['a blank name', { cusName: '  ' }, 'cusName', CustomerErrorCode.NAME_REQUIRED],
      ['a missing name', { cusName: null }, 'cusName', CustomerErrorCode.NAME_REQUIRED],
      [
        'a blank state name',
        { cusStateName: ' ' },
        'cusStateName',
        CustomerErrorCode.STATE_NAME_REQUIRED,
      ],
      [
        'a three-letter state code',
        { cusStateCode: 'TNX' },
        'cusStateCode',
        CustomerErrorCode.STATE_CODE_INVALID,
      ],
    ])('refuses %s with a 400 before any ledger is made', async (_label, fields, field, code) => {
      const refusal = await refusalOf(service.save(createDto(fields)));

      expect(refusal).toMatchObject({ status: 400, body: { errors: [{ field, code }] } });
      expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
    });

    it.each([
      ['company', 'company', 'cusCompanyId', CustomerErrorCode.COMPANY_NOT_FOUND],
      ['area', 'areaMaster', 'cusAreaId', CustomerErrorCode.AREA_NOT_FOUND],
      ['customer group', 'custGroup', 'cusGroupId', CustomerErrorCode.GROUP_NOT_FOUND],
      ['state', 'stateCode', 'cusStateCode', CustomerErrorCode.STATE_NOT_FOUND],
    ] as const)(
      'refuses an unknown %s before any ledger is made',
      async (_l, model, field, code) => {
        prisma[model].findFirst.mockResolvedValue(null);

        const refusal = await refusalOf(service.save(createDto({ cusCompanyId: COMPANY_ID })));

        expect(refusal).toMatchObject({ status: 400, body: { errors: [{ field, code }] } });
        expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
        expect(prisma.customer.create).not.toHaveBeenCalled();
      },
    );

    it('does not look the company up when none is named', async () => {
      await service.save(createDto());

      expect(prisma.company.findFirst).not.toHaveBeenCalled();
    });

    it('answers a unique-index race (P2002) with a 409 DUPLICATE', async () => {
      prisma.customer.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(service.save(createDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'cusName', code: CustomerErrorCode.DUPLICATE }] },
      });
    });
  });

  describe('save — create on an existing ledger (cusLinkLedId, notes 81)', () => {
    const linkDto = (overrides: Partial<SaveCustomerDto> = {}) =>
      createDto({
        cusLinkLedId: LEDGER_ID,
        cusName: undefined,
        cusStateName: '',
        cusStateCode: '',
        ...overrides,
      });

    it('refuses a ledger that does not exist', async () => {
      const refusal = await refusalOf(service.save(linkDto()));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'cusLinkLedId', code: CustomerErrorCode.LINK_LEDGER_NOT_FOUND }],
        },
      });
      expect(prisma.accLedgerMaster.findFirst).toHaveBeenCalledWith({
        where: { ledId: LEDGER_ID, ledIsDeleted: false },
      });
    });

    it('refuses a ledger that is not a party ledger', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue(
        ledgerRow({ ledLedgerType: 'BANK', ledName: 'HDFC Current' }),
      );

      const refusal = await refusalOf(service.save(linkDto()));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'cusLinkLedId',
              code: CustomerErrorCode.LINK_LEDGER_NOT_PARTY,
              message:
                'Ledger "HDFC Current" is a BANK ledger; only a PARTY ledger can be a customer',
            },
          ],
        },
      });
    });

    it('accepts an untyped ledger that a live supplier already holds', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue(ledgerRow({ ledLedgerType: null }));
      prisma.supplier.findFirst.mockResolvedValue({ supIsActive: true });

      await expect(service.save(linkDto())).resolves.toMatchObject({ cusId: LEDGER_ID });
    });

    it('fills the blank fields from the ledger and writes no ledger at all', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue(ledgerRow());

      const payload = await service.save(linkDto({ cusPhone1: '' }));

      expect(createdData()).toMatchObject({
        cusId: LEDGER_ID,
        cusName: 'Ravi Traders',
        cusStateName: 'Kerala',
        cusStateCode: '32',
        cusPhone1: '9840000001',
        cusEmail: 'accounts@ravi.example',
        cusGstNo: '32ABCDE1234F1Z5',
        cusAreaId: AREA_ID,
      });
      // Flags, sort order and notes belong to the role, not the shared ledger.
      expect(createdData()).not.toHaveProperty('cusNotes');
      expect(createdData()).not.toHaveProperty('cusIsActive');
      expect(createdData()).not.toHaveProperty('cusSortOrder');
      expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
      expect(ledgers.updateLedgerWithinTx).not.toHaveBeenCalled();
      expect(auditEntry()).toMatchObject({
        action: 'New',
        modifiedRecord: payload,
        notes: 'Customer created on an existing ledger',
      });
    });

    it('keeps what the payload did fill in over the ledger value', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue(ledgerRow());

      await service.save(linkDto({ cusName: 'Ravi Retail', cusPhone1: '9000000000' }));

      expect(createdData()).toMatchObject({ cusName: 'Ravi Retail', cusPhone1: '9000000000' });
    });

    it('leaves out a ledger value too long for the customer column', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue(
        ledgerRow({ ledEmail: `${'a'.repeat(115)}@x.example` }),
      );

      await service.save(linkDto());

      expect(createdData()).not.toHaveProperty('cusEmail');
    });

    it('refuses a ledger that is already a live customer', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue(ledgerRow());
      prisma.customer.findUnique.mockResolvedValue(customerRow({ cusId: LEDGER_ID }));

      const refusal = await refusalOf(service.save(linkDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [{ field: 'cusLinkLedId', code: CustomerErrorCode.LINK_LEDGER_ALREADY_CUSTOMER }],
        },
      });
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('revives a customer row deleted earlier, keeping its creation stamp', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue(ledgerRow());
      prisma.customer.findUnique.mockResolvedValue(
        customerRow({ cusId: LEDGER_ID, cusIsDeleted: true, cusIsActive: false }),
      );

      await service.save(linkDto());

      expect(prisma.customer.create).not.toHaveBeenCalled();
      const data = updatedData();
      expect(data).toMatchObject({
        cusBilledCount: { increment: 1 },
        cusIsDeleted: false,
        cusIsActive: true,
        cusModifiedOn: expect.any(Date),
        cusModifiedBy: USER_ID,
      });
      expect(data).not.toHaveProperty('cusCreatedOn');
      expect(data).not.toHaveProperty('cusCreatedBy');
      expect(auditEntry()).toMatchObject({
        action: 'update',
        originalRecord: expect.objectContaining({ cusIsDeleted: true }),
        notes: 'Customer restored on its existing ledger',
      });
    });
  });

  describe('save — update', () => {
    const updateDto = (overrides: Partial<SaveCustomerDto> = {}) =>
      createDto({ cusId: CUS_ID, cusName: 'Ravi Stores', ...overrides });

    beforeEach(() => {
      prisma.customer.findFirst.mockResolvedValue(customerRow());
      prisma.accLedgerMaster.findFirst.mockResolvedValue({
        ledId: CUS_ID,
        ledName: 'Ravi Stores',
        ledGroupId: AREA_ID,
      });
    });

    it('refuses a cusLinkLedId naming another ledger, since linking is create-only', async () => {
      const refusal = await refusalOf(service.save(updateDto({ cusLinkLedId: LEDGER_ID })));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'cusLinkLedId', code: CustomerErrorCode.LINK_LEDGER_ON_UPDATE }],
        },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lets a client echo the link it created the customer with', async () => {
      await expect(service.save(updateDto({ cusLinkLedId: CUS_ID }))).resolves.toMatchObject({
        cusId: CUS_ID,
      });
    });

    it('refuses an id with no live customer', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(service.save(updateDto()));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'cusId', code: CustomerErrorCode.NOT_FOUND }] },
      });
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });

    it('counts the save and stamps the modifier named in the body', async () => {
      await service.save(updateDto({ cusModifiedBy: 'counter-3' }));

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { cusId: CUS_ID } }),
      );
      expect(updatedData()).toMatchObject({
        cusStateName: 'Tamil Nadu',
        cusStateCode: '33',
        cusAreaId: AREA_ID,
        cusGroupId: GROUP_ID,
        cusBilledDate: expect.any(Date),
        cusBilledCount: { increment: 1 },
        cusModifiedBy: 'counter-3',
      });
    });

    it('syncs the linked ledger under the customer id, filed in the customer area', async () => {
      const otherArea = '019c6f6c-be87-7a11-8905-36092c46e1ff';

      await service.save(updateDto({ cusAreaId: otherArea, cusPhone1: '9840000002' }));

      expect(ledgers.updateLedgerWithinTx).toHaveBeenCalledWith(
        expect.objectContaining({
          ledId: CUS_ID,
          ledGroupId: otherArea,
          ledName: 'Ravi Stores',
          ledStateName: 'Tamil Nadu',
          ledStateCode: '33',
          ledPhone1: '9840000002',
          ledIsBillByBill: true,
        }),
        prisma,
      );
      expect(ledgerUpdateDto()).not.toHaveProperty('ledIsActive');
    });

    it('falls back to the ledger name when the customer name is empty', async () => {
      prisma.customer.update.mockResolvedValue(customerRow({ cusName: null }));

      await service.save(updateDto({ cusName: null }));

      expect(ledgerUpdateDto().ledName).toBe('Ravi Stores');
    });

    it('keeps the group of a ledger shared with a live supplier, and its active flag', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue({
        ledId: CUS_ID,
        ledName: 'Ravi Stores',
        ledGroupId: SUPPLIERS_GROUP_ID,
      });
      prisma.supplier.findFirst.mockResolvedValue({ supIsActive: true });
      prisma.customer.update.mockResolvedValue(customerRow({ cusIsActive: false }));

      await service.save(updateDto({ cusIsActive: false }));

      expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
        where: { supId: CUS_ID, supIsDeleted: false },
        select: { supIsActive: true },
      });
      expect(ledgerUpdateDto()).toMatchObject({
        ledGroupId: SUPPLIERS_GROUP_ID,
        ledIsActive: true,
      });
    });

    it('leaves a legacy customer with no linked ledger alone', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue(null);

      await service.save(updateDto());

      expect(ledgers.updateLedgerWithinTx).not.toHaveBeenCalled();
      expect(auditEntry()).toMatchObject({ action: 'update', notes: 'Customer updated' });
    });

    it('words a ledger name clash as a customer name clash', async () => {
      ledgers.updateLedgerWithinTx.mockRejectedValue(new ConflictException('ledName taken'));

      const refusal = await refusalOf(service.save(updateDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'cusName', code: CustomerErrorCode.NAME_EXISTS }] },
      });
    });

    it('rethrows any other ledger failure untouched', async () => {
      const failure = new Error('connection reset');
      ledgers.updateLedgerWithinTx.mockRejectedValue(failure);

      await expect(service.save(updateDto())).rejects.toBe(failure);
    });

    it('answers a unique-index race (P2002) with a 409 DUPLICATE', async () => {
      prisma.customer.update.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(service.save(updateDto()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: CustomerErrorCode.DUPLICATE }] },
      });
    });
  });

  describe('getById', () => {
    it('refuses an id with no live customer', async () => {
      const refusal = await refusalOf(service.getById(CUS_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: CustomerErrorCode.NOT_FOUND }] },
      });
    });

    it('adds the names of the company, branch, area, group and price level', async () => {
      prisma.customer.findFirst.mockResolvedValue(
        customerRow({
          cusCompanyId: COMPANY_ID,
          cusBranchId: BRANCH_ID,
          cusCreditAmtLimit: new Prisma.Decimal('5000.50'),
          cusDiscPerc: new Prisma.Decimal('2.5'),
          cusCollectionDays: [1, 4],
        }),
      );

      await expect(service.getById(CUS_ID)).resolves.toMatchObject({
        cusId: CUS_ID,
        cusCompanyName: 'Zeta',
        cusBranchName: 'Main Branch',
        cusAreaName: 'Beat 4',
        cusGroupName: 'Retail',
        cusPriceLevelName: 'MRP',
        cusCreditAmtLimit: 5000.5,
        cusDiscPerc: 2.5,
        cusCollectionDays: [1, 4],
        cusCreatedOn: STAMP.toISOString(),
      });
    });

    it('looks up no company or branch for a customer without them', async () => {
      prisma.customer.findFirst.mockResolvedValue(customerRow());

      await expect(service.getById(CUS_ID)).resolves.toMatchObject({
        cusCompanyName: null,
        cusBranchName: null,
      });
      expect(prisma.company.findFirst).not.toHaveBeenCalled();
      expect(prisma.branchMaster.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('refuses an id with no live customer', async () => {
      const refusal = await refusalOf(service.softDelete(CUS_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.customer.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the row was deleted between the read and the write', async () => {
      prisma.customer.findFirst.mockResolvedValue(customerRow());
      prisma.customer.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(CUS_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.accLedgerMaster.updateMany).not.toHaveBeenCalled();
    });

    it('deletes the customer and the ledger it alone owns', async () => {
      prisma.customer.findFirst.mockResolvedValue(customerRow());

      await expect(service.softDelete(CUS_ID)).resolves.toEqual({ cusId: CUS_ID, deleted: true });
      expect(prisma.customer.updateMany).toHaveBeenCalledWith({
        where: { cusId: CUS_ID, cusIsDeleted: false },
        data: {
          cusIsDeleted: true,
          cusIsActive: false,
          cusModifiedOn: expect.any(Date),
          cusModifiedBy: USER_ID,
        },
      });
      expect(prisma.accLedgerMaster.updateMany).toHaveBeenCalledWith({
        where: { ledId: CUS_ID, ledIsDeleted: false },
        data: {
          ledIsDeleted: true,
          ledIsActive: false,
          ledModifiedOn: expect.any(Date),
          ledModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'Ravi Stores',
        modifiedRecord: expect.objectContaining({ cusIsDeleted: true, cusIsActive: false }),
        notes: 'Customer soft deleted',
      });
    });

    it('keeps a ledger shared with a live supplier, at the supplier active flag', async () => {
      prisma.customer.findFirst.mockResolvedValue(customerRow());
      prisma.supplier.findFirst.mockResolvedValue({ supIsActive: false });
      context.getUserId.mockReturnValue(null);

      await service.softDelete(CUS_ID);

      expect(prisma.accLedgerMaster.updateMany).toHaveBeenCalledWith({
        where: { ledId: CUS_ID, ledIsDeleted: false },
        data: {
          ledIsActive: false,
          ledModifiedOn: expect.any(Date),
          ledModifiedBy: DEFAULT_ACTOR,
        },
      });
      expect(auditEntry()).toMatchObject({
        notes: 'Customer soft deleted; its ledger stays with the supplier',
      });
    });

    it('audits a nameless customer under its id', async () => {
      prisma.customer.findFirst.mockResolvedValue(customerRow({ cusName: null }));

      await service.softDelete(CUS_ID);

      expect(auditEntry().displayName).toBe(CUS_ID);
    });
  });
});
