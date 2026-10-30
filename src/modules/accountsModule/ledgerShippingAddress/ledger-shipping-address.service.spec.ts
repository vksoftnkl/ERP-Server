import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { AccShipAddr, Prisma } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveLedgerShippingAddressDto } from './dto/save-ledger-shipping-address.dto';
import { createHouseValidationPipe } from '../../../common/validation/house-validation';
import { LedgerShippingAddressService } from './ledger-shipping-address.service';
import { SaaAddrType } from './types/ledger-shipping-address-enum';
import { LedgerShippingAddressErrorCode } from './types/ledger-shipping-address-error-codes';

const SAA_ID = '019c6f6c-be87-7a11-8905-36092c46f301';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46f302';
const OTHER_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46f303';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46f304';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46f305';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f3ff';
const GSTIN = '29ABCDE1234F1Z5';
const CREATED_ON = new Date('2026-10-01T09:00:00.000Z');
const MODIFIED_ON = new Date('2026-10-02T09:00:00.000Z');

const makeAddress = (overrides: Partial<AccShipAddr> = {}): AccShipAddr => ({
  saaId: SAA_ID,
  saaCompanyId: null,
  saaBranchId: null,
  saaLedgerId: LEDGER_ID,
  saaAddrType: 'SHIP_TO',
  saaIsDefault: false,
  saaSort: 0,
  saaTradeName: 'Acme Godown',
  saaContactName: 'Ravi',
  saaAddr1: '12 Mill Road',
  saaAddr2: null,
  saaAddr3: null,
  saaLocation: 'Bengaluru',
  saaPin: '560001',
  saaStateCode: '29',
  saaStateName: 'Karnataka',
  saaCountryCode: 'IN',
  saaDistanceKm: 12,
  saaPhone: null,
  saaEmail: null,
  saaGstin: GSTIN,
  saaSyncedOn: null,
  saaIsActive: true,
  saaIsDeleted: false,
  saaCreatedOn: CREATED_ON,
  saaCreatedBy: USER_ID,
  saaModifiedOn: MODIFIED_ON,
  saaModifiedBy: USER_ID,
  saaRemarks: null,
  ...overrides,
});

const saveDto = (
  overrides: Partial<SaveLedgerShippingAddressDto> = {},
): SaveLedgerShippingAddressDto => ({
  saaLedgerId: LEDGER_ID,
  saaGstin: GSTIN,
  ...overrides,
});

type Args = {
  where: Record<string, unknown>;
  data?: Record<string, unknown>;
  select?: unknown;
  orderBy?: unknown;
};
type AuditEntry = Record<string, unknown>;

type PrismaMock = {
  accShipAddr: {
    findFirst: jest.Mock<Promise<AccShipAddr | null>, [Args]>;
    findMany: jest.Mock<Promise<AccShipAddr[]>, [Args]>;
    create: jest.Mock<Promise<AccShipAddr>, [Args]>;
    update: jest.Mock<Promise<AccShipAddr>, [Args]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Args]>;
  };
  accLedgerMaster: { findFirst: jest.Mock<Promise<{ ledId: string } | null>, [Args]> };
  company: { findFirst: jest.Mock<Promise<{ compId: string } | null>, [Args]> };
  branchMaster: { findFirst: jest.Mock<Promise<{ brId: string } | null>, [Args]> };
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => Promise<unknown>]>;
};

/** The refusal body a thrown HttpException carries. */
const bodyOf = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error.getResponse();
    throw error;
  }
  throw new Error('expected the call to refuse');
};

describe('LedgerShippingAddressService', () => {
  let service: LedgerShippingAddressService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock<Promise<void>, [AuditEntry, unknown]> };
  let userId: string | undefined;

  beforeEach(() => {
    userId = USER_ID;
    prisma = {
      accShipAddr: {
        findFirst: jest.fn<Promise<AccShipAddr | null>, [Args]>(() => Promise.resolve(null)),
        findMany: jest.fn<Promise<AccShipAddr[]>, [Args]>(() => Promise.resolve([])),
        create: jest.fn<Promise<AccShipAddr>, [Args]>(({ data }) =>
          Promise.resolve(makeAddress({ ...(data as Partial<AccShipAddr>) })),
        ),
        update: jest.fn<Promise<AccShipAddr>, [Args]>(({ where, data }) =>
          Promise.resolve(
            makeAddress({
              ...Object.fromEntries(Object.entries(data!).filter(([, v]) => v !== undefined)),
              saaId: where.saaId as string,
            }),
          ),
        ),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [Args]>(() =>
          Promise.resolve({ count: 1 }),
        ),
      },
      accLedgerMaster: {
        findFirst: jest.fn<Promise<{ ledId: string } | null>, [Args]>(({ where }) =>
          Promise.resolve({ ledId: where.ledId as string }),
        ),
      },
      company: {
        findFirst: jest.fn<Promise<{ compId: string } | null>, [Args]>(({ where }) =>
          Promise.resolve({ compId: where.compId as string }),
        ),
      },
      branchMaster: {
        findFirst: jest.fn<Promise<{ brId: string } | null>, [Args]>(({ where }) =>
          Promise.resolve({ brId: where.brId as string }),
        ),
      },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    auditLogService = {
      logEntityChange: jest.fn<Promise<void>, [AuditEntry, unknown]>(() => Promise.resolve()),
    };
    service = new LedgerShippingAddressService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => userId } as unknown as RequestContextService,
    );
  });

  describe('save — create (no saaId)', () => {
    it('defaults to a ship-to address in India and upper-cases the GSTIN', async () => {
      await service.save(saveDto({ saaGstin: ' 29abcde1234f1z5 ' }));

      expect(prisma.accShipAddr.create.mock.calls[0][0].data).toEqual({
        saaLedgerId: LEDGER_ID,
        saaAddrType: 'SHIP_TO',
        saaCountryCode: 'IN',
        saaGstin: GSTIN,
        saaCreatedOn: expect.any(Date) as Date,
        saaCreatedBy: USER_ID,
      });
    });

    it('writes the address fields sent', async () => {
      await service.save(
        saveDto({
          saaAddrType: SaaAddrType.BOTH,
          saaCompanyId: COMPANY_ID,
          saaBranchId: BRANCH_ID,
          saaSort: 2,
          saaTradeName: 'Acme Godown',
          saaAddr1: '12 Mill Road',
          saaPin: '560001',
          saaStateCode: '29',
          saaStateName: 'Karnataka',
          saaDistanceKm: 12,
          saaEmail: 'ship@acme.in',
          saaIsActive: true,
          saaRemarks: null,
        }),
      );

      expect(prisma.accShipAddr.create.mock.calls[0][0].data).toMatchObject({
        saaAddrType: 'BOTH',
        saaCompanyId: COMPANY_ID,
        saaBranchId: BRANCH_ID,
        saaSort: 2,
        saaTradeName: 'Acme Godown',
        saaAddr1: '12 Mill Road',
        saaPin: '560001',
        saaStateCode: '29',
        saaStateName: 'Karnataka',
        saaDistanceKm: 12,
        saaEmail: 'ship@acme.in',
        saaIsActive: true,
        saaRemarks: null,
      });
    });

    it('checks the company and branch only when they are named', async () => {
      await service.save(saveDto());
      expect(prisma.company.findFirst).not.toHaveBeenCalled();
      expect(prisma.branchMaster.findFirst).not.toHaveBeenCalled();

      await service.save(saveDto({ saaCompanyId: COMPANY_ID, saaBranchId: BRANCH_ID }));
      expect(prisma.company.findFirst).toHaveBeenCalledWith({
        where: { compId: COMPANY_ID, compIsDeleted: false },
        select: { compId: true },
      });
      expect(prisma.branchMaster.findFirst).toHaveBeenCalledWith({
        where: { brId: BRANCH_ID, brIsDeleted: false },
        select: { brId: true },
      });
    });

    it.each([
      [
        'the ledger',
        () => prisma.accLedgerMaster.findFirst.mockResolvedValueOnce(null),
        {},
        'saaLedgerId',
        LedgerShippingAddressErrorCode.LEDGER_NOT_FOUND,
      ],
      [
        'the company',
        () => prisma.company.findFirst.mockResolvedValueOnce(null),
        { saaCompanyId: COMPANY_ID },
        'saaCompanyId',
        LedgerShippingAddressErrorCode.COMPANY_NOT_FOUND,
      ],
      [
        'the branch',
        () => prisma.branchMaster.findFirst.mockResolvedValueOnce(null),
        { saaBranchId: BRANCH_ID },
        'saaBranchId',
        LedgerShippingAddressErrorCode.BRANCH_NOT_FOUND,
      ],
    ])('refuses when %s has no live row', async (_label, arrange, extra, field, code) => {
      arrange();

      const promise = service.save(saveDto(extra));

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toMatchObject({ errors: [{ field, code }] });
      expect(prisma.accShipAddr.create).not.toHaveBeenCalled();
    });

    // One default per ledger and address type.
    it('clears the ledger other defaults of the same type before saving a new default', async () => {
      await service.save(saveDto({ saaAddrType: SaaAddrType.BILL_TO, saaIsDefault: true }));

      expect(prisma.accShipAddr.updateMany).toHaveBeenCalledWith({
        where: {
          saaLedgerId: LEDGER_ID,
          saaAddrType: 'BILL_TO',
          saaIsDeleted: false,
          saaIsDefault: true,
        },
        data: {
          saaIsDefault: false,
          saaModifiedOn: expect.any(Date) as Date,
          saaModifiedBy: USER_ID,
        },
      });
    });

    it('leaves the other defaults alone for a non-default address', async () => {
      await service.save(saveDto({ saaIsDefault: false }));

      expect(prisma.accShipAddr.updateMany).not.toHaveBeenCalled();
    });

    it('refuses a bad GSTIN, state code or PIN before touching the ledger', async () => {
      for (const dto of [
        saveDto({ saaGstin: '29ABCDE1234F1X5' }),
        saveDto({ saaStateCode: '2A' }),
        saveDto({ saaPin: '5600' }),
      ]) {
        await expect(service.save(dto)).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(prisma.accLedgerMaster.findFirst).not.toHaveBeenCalled();
    });

    it('lets any PIN through for an address outside India', async () => {
      await service.save(saveDto({ saaCountryCode: 'ae', saaPin: 'DXB-01' }));

      expect(prisma.accShipAddr.create.mock.calls[0][0].data).toMatchObject({
        saaCountryCode: 'AE',
        saaPin: 'DXB-01',
      });
    });

    it.each([
      ['the trade name', { saaTradeName: 'Acme Godown' }, 'Acme Godown'],
      [
        'the contact name when there is no trade name',
        { saaTradeName: null, saaContactName: 'Ravi' },
        'Ravi',
      ],
      ['the id when there is neither', { saaTradeName: null, saaContactName: null }, SAA_ID],
    ])('names the audit row by %s', async (_label, names, displayName) => {
      prisma.accShipAddr.create.mockResolvedValueOnce(makeAddress(names));

      await service.save(saveDto());

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'New',
        tableName: 'acc ship addrs',
        screenName: 'Ledger Shipping Address',
        pk: SAA_ID,
        displayName,
        originalRecord: null,
        userId: USER_ID,
        notes: 'Ledger shipping address created',
      });
      expect(client).toBe(prisma);
    });

    it('stamps the default actor when the request carries no user', async () => {
      userId = undefined;

      await service.save(saveDto());

      expect(prisma.accShipAddr.create.mock.calls[0][0].data!.saaCreatedBy).toBe(DEFAULT_ACTOR);
    });

    it('answers a unique violation as SHIPPING_DUPLICATE', async () => {
      prisma.accShipAddr.create.mockRejectedValueOnce(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const promise = service.save(saveDto());

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Ledger shipping address already exists',
        errors: [
          {
            field: 'saaId',
            message: 'Duplicate ledger shipping address unique value is not allowed',
            code: LedgerShippingAddressErrorCode.DUPLICATE,
          },
        ],
      });
    });
  });

  describe('save — update (saaId sent)', () => {
    beforeEach(() => {
      prisma.accShipAddr.findFirst.mockResolvedValue(
        makeAddress({ saaAddrType: 'BILL_TO', saaCountryCode: 'AE', saaCompanyId: COMPANY_ID }),
      );
    });

    it('keeps the stored type and country when the body does not carry them', async () => {
      await service.save(saveDto({ saaId: SAA_ID, saaPin: 'DXB-01' }));

      const { where, data } = prisma.accShipAddr.update.mock.calls[0][0];
      expect(where).toEqual({ saaId: SAA_ID });
      expect(data).toMatchObject({
        saaLedgerId: LEDGER_ID,
        saaAddrType: 'BILL_TO',
        saaCountryCode: 'AE',
        saaGstin: GSTIN,
        saaPin: 'DXB-01',
        saaModifiedOn: expect.any(Date) as Date,
        saaModifiedBy: USER_ID,
      });
    });

    it('checks the stored company when the body does not name one', async () => {
      await service.save(saveDto({ saaId: SAA_ID }));

      expect(prisma.company.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { compId: COMPANY_ID, compIsDeleted: false } }),
      );
    });

    it('moves the address to another live ledger', async () => {
      await service.save(saveDto({ saaId: SAA_ID, saaLedgerId: OTHER_LEDGER_ID }));

      expect(prisma.accLedgerMaster.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ledId: OTHER_LEDGER_ID, ledIsDeleted: false } }),
      );
      expect(prisma.accShipAddr.update.mock.calls[0][0].data!.saaLedgerId).toBe(OTHER_LEDGER_ID);
    });

    it('clears the other defaults of its type, never itself', async () => {
      await service.save(saveDto({ saaId: SAA_ID, saaIsDefault: true }));

      expect(prisma.accShipAddr.updateMany.mock.calls[0][0].where).toEqual({
        saaLedgerId: LEDGER_ID,
        saaAddrType: 'BILL_TO',
        saaIsDeleted: false,
        saaIsDefault: true,
        saaId: { not: SAA_ID },
      });
    });

    it('re-clears the defaults when a stored default is saved again', async () => {
      prisma.accShipAddr.findFirst.mockResolvedValue(makeAddress({ saaIsDefault: true }));

      await service.save(saveDto({ saaId: SAA_ID }));

      expect(prisma.accShipAddr.updateMany).toHaveBeenCalledTimes(1);
    });

    // dto-own-undefined trap: through the house ValidationPipe every declared field is
    // own (undefined when left out), so the checks must see the stored values.
    it('checks the stored company and re-clears a stored default for a piped partial body', async () => {
      prisma.accShipAddr.findFirst.mockResolvedValue(
        makeAddress({ saaCompanyId: COMPANY_ID, saaIsDefault: true }),
      );
      const dto = (await createHouseValidationPipe().transform(
        { saaId: SAA_ID, saaLedgerId: LEDGER_ID, saaGstin: GSTIN },
        { type: 'body', metatype: SaveLedgerShippingAddressDto },
      )) as SaveLedgerShippingAddressDto;
      expect(Object.prototype.hasOwnProperty.call(dto, 'saaCompanyId')).toBe(true);

      await service.save(dto);

      expect(prisma.company.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { compId: COMPANY_ID, compIsDeleted: false } }),
      );
      expect(prisma.accShipAddr.updateMany).toHaveBeenCalledTimes(1);
      const { data } = prisma.accShipAddr.update.mock.calls[0][0];
      expect(data).not.toHaveProperty('saaCompanyId');
      expect(data).not.toHaveProperty('saaIsDefault');
    });

    it('checks the PIN against the stored country', async () => {
      prisma.accShipAddr.findFirst.mockResolvedValue(makeAddress({ saaCountryCode: 'IN' }));

      await expect(
        bodyOf(service.save(saveDto({ saaId: SAA_ID, saaPin: '5600' }))),
      ).resolves.toMatchObject({
        errors: [{ field: 'saaPin', code: LedgerShippingAddressErrorCode.PIN_INVALID }],
      });
    });

    it('files an update audit row holding the row before and after', async () => {
      const payload = await service.save(saveDto({ saaId: SAA_ID, saaTradeName: 'Acme Depot' }));

      const [entry] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'update',
        pk: SAA_ID,
        displayName: 'Acme Depot',
        modifiedRecord: payload,
        notes: 'Ledger shipping address updated',
      });
      expect(entry.originalRecord).toMatchObject({ saaTradeName: 'Acme Godown' });
    });

    it('refuses an id with no live address', async () => {
      prisma.accShipAddr.findFirst.mockResolvedValue(null);

      const promise = service.save(saveDto({ saaId: SAA_ID }));

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Ledger shipping address not found',
        errors: [
          {
            field: 'saaId',
            message: `No active ledger shipping address found with id ${SAA_ID}`,
            code: LedgerShippingAddressErrorCode.NOT_FOUND,
          },
        ],
      });
      expect(prisma.accShipAddr.update).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('reads a live address only', async () => {
      prisma.accShipAddr.findFirst.mockResolvedValueOnce(
        makeAddress({ saaSyncedOn: new Date('2026-10-03T09:00:00.000Z') }),
      );

      await expect(service.getById(SAA_ID)).resolves.toMatchObject({
        saaId: SAA_ID,
        saaGstin: GSTIN,
        saaSyncedOn: '2026-10-03T09:00:00.000Z',
        saaCreatedOn: CREATED_ON.toISOString(),
      });
      expect(prisma.accShipAddr.findFirst).toHaveBeenCalledWith({
        where: { saaId: SAA_ID, saaIsDeleted: false },
      });
    });

    it('refuses an id with no live address', async () => {
      await expect(bodyOf(service.getById(SAA_ID))).resolves.toMatchObject({
        errors: [{ field: 'saaId', code: LedgerShippingAddressErrorCode.NOT_FOUND }],
      });
    });
  });

  describe('listByLedger', () => {
    it('lists the ledger live addresses default-first, then oldest-first', async () => {
      prisma.accShipAddr.findMany.mockResolvedValueOnce([
        makeAddress({ saaIsDefault: true }),
        makeAddress({ saaId: '019c6f6c-be87-7a11-8905-36092c46f3a2' }),
      ]);

      const result = await service.listByLedger(LEDGER_ID);

      expect(prisma.accShipAddr.findMany).toHaveBeenCalledWith({
        where: { saaLedgerId: LEDGER_ID, saaIsDeleted: false },
        orderBy: [{ saaIsDefault: 'desc' }, { saaCreatedOn: 'asc' }],
      });
      expect(result.total).toBe(2);
      expect(result.data.map((address) => address.saaIsDefault)).toEqual([true, false]);
    });

    it('answers an empty list for a ledger with no addresses', async () => {
      await expect(service.listByLedger(LEDGER_ID)).resolves.toEqual({ data: [], total: 0 });
    });
  });

  describe('softDelete', () => {
    beforeEach(() => {
      prisma.accShipAddr.findFirst.mockResolvedValue(makeAddress());
    });

    it('marks the live address deleted and inactive and files a cancel audit row', async () => {
      await expect(service.softDelete(SAA_ID)).resolves.toEqual({ saaId: SAA_ID, deleted: true });

      expect(prisma.accShipAddr.updateMany.mock.calls[0][0]).toEqual({
        where: { saaId: SAA_ID, saaIsDeleted: false },
        data: {
          saaIsDeleted: true,
          saaIsActive: false,
          saaModifiedOn: expect.any(Date) as Date,
          saaModifiedBy: USER_ID,
        },
      });
      const [entry] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'cancel',
        pk: SAA_ID,
        displayName: 'Acme Godown',
        notes: 'Ledger shipping address soft deleted',
      });
      expect(entry.modifiedRecord).toMatchObject({ saaIsDeleted: true, saaIsActive: false });
    });

    it('refuses an id with no live address and writes nothing', async () => {
      prisma.accShipAddr.findFirst.mockResolvedValue(null);

      await expect(service.softDelete(SAA_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.accShipAddr.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the write finds the row already gone, without an audit row', async () => {
      prisma.accShipAddr.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.softDelete(SAA_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });
  });
});
