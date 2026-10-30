import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { ChargeMaster, Prisma } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { assertTaxRateRefs } from '../../Inventory/tax-rate-master/utils/tax-rate-reference.helper';
import { ChargeMasterService } from './charge-master.service';
import { SaveChargeMasterDto } from './dto/save-charge-master.dto';
import { createHouseValidationPipe } from '../../../common/validation/house-validation';
import { ChargeLedgerDetail, ChargeTaxDetail } from './types/charge-master-api.types';
import { CHARGE_ERROR } from './types/charge-master-error-codes';

jest.mock('../../Inventory/tax-rate-master/utils/tax-rate-reference.helper', () => ({
  assertTaxRateRefs: jest.fn(),
}));

const assertTaxRateRefsMock = assertTaxRateRefs as jest.MockedFunction<typeof assertTaxRateRefs>;

const CHG_ID = '019c6f6c-be87-7a11-8905-36092c46f601';
const OTHER_CHG_ID = '019c6f6c-be87-7a11-8905-36092c46f602';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46f603';
const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46f604';
const LEDGER_TAX_ID = '019c6f6c-be87-7a11-8905-36092c46f605';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f6ff';
const CREATED_ON = new Date('2026-10-01T09:00:00.000Z');
const MODIFIED_ON = new Date('2026-10-02T09:00:00.000Z');

const makeCharge = (overrides: Partial<ChargeMaster> = {}): ChargeMaster => ({
  chgId: CHG_ID,
  chgName: 'Freight',
  chgCode: 'FRT',
  chgModule: 'P',
  chgRole: 'FREIGHT',
  chgMethod: 'FIXED',
  chgType: 'ADD',
  chgApplyOn: 'VALUE',
  chgDefaultRate: new Prisma.Decimal('250.00'),
  chgLandingCost: true,
  chgCostAlloc: 'VALUE',
  chgOnBill: true,
  chgLedgerCode: LEDGER_ID,
  chgTaxApl: false,
  chgBeforeTax: false,
  chgTaxId: null,
  chgSepPost: false,
  chgManParty: false,
  chgDispOrder: 1,
  chgAutoApply: false,
  chgIsActive: true,
  chgIsDeleted: false,
  chgSyncDate: null,
  chgCreatedOn: CREATED_ON,
  chgCreatedBy: USER_ID,
  chgModifiedOn: MODIFIED_ON,
  chgModifiedBy: USER_ID,
  ...overrides,
});

const taxDetail = (overrides: Partial<ChargeTaxDetail> = {}): ChargeTaxDetail => ({
  taxId: TAX_ID,
  taxName: 'GST 18%',
  taxRatePerc: new Prisma.Decimal('18'),
  taxCgstPerc: new Prisma.Decimal('9'),
  taxSgstPerc: new Prisma.Decimal('9'),
  taxIgstPerc: new Prisma.Decimal('18'),
  taxCessPerc: new Prisma.Decimal('0'),
  taxTaxability: 'TAXABLE',
  ...overrides,
});

const ledgerDetail = (overrides: Partial<ChargeLedgerDetail> = {}): ChargeLedgerDetail => ({
  ledName: 'Freight Inward A/c',
  ledHsnSac: '996511',
  ledTaxId: LEDGER_TAX_ID,
  taxRate: taxDetail({
    taxId: LEDGER_TAX_ID,
    taxName: 'GST 5%',
    taxRatePerc: new Prisma.Decimal('5'),
    taxCgstPerc: new Prisma.Decimal('2.5'),
    taxSgstPerc: new Prisma.Decimal('2.5'),
    taxIgstPerc: new Prisma.Decimal('5'),
  }),
  ...overrides,
});

const saveDto = (overrides: Partial<SaveChargeMasterDto> = {}): SaveChargeMasterDto => ({
  chgName: 'Freight',
  chgModule: 'P',
  chgMethod: 'FIXED',
  chgType: 'ADD',
  chgApplyOn: 'VALUE',
  chgLedgerCode: LEDGER_ID,
  ...overrides,
});

type Args = {
  where: Record<string, unknown>;
  data?: Record<string, unknown>;
  select?: unknown;
  include?: unknown;
  orderBy?: unknown;
};
type ChargeRow = ChargeMaster & {
  ledger?: ChargeLedgerDetail | null;
  tax?: ChargeTaxDetail | null;
};
type AuditEntry = Record<string, unknown>;

type PrismaMock = {
  chargeMaster: {
    findFirst: jest.Mock<Promise<ChargeRow | { chgId: string } | null>, [Args]>;
    findMany: jest.Mock<Promise<ChargeRow[]>, [Args]>;
    create: jest.Mock<Promise<ChargeMaster>, [Args]>;
    update: jest.Mock<Promise<ChargeMaster>, [Args]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Args]>;
  };
  accLedgerMaster: { findFirst: jest.Mock<Promise<ChargeLedgerDetail | null>, [Args]> };
  taxRateMaster: { findUnique: jest.Mock<Promise<ChargeTaxDetail | null>, [Args]> };
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

describe('ChargeMasterService', () => {
  let service: ChargeMasterService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock<Promise<void>, [AuditEntry, unknown]> };
  let userId: string | undefined;

  beforeEach(() => {
    userId = USER_ID;
    assertTaxRateRefsMock.mockReset();
    assertTaxRateRefsMock.mockResolvedValue(undefined);
    prisma = {
      chargeMaster: {
        // Default: no live charge by id, and no code or role clash.
        findFirst: jest.fn<Promise<ChargeRow | { chgId: string } | null>, [Args]>(() =>
          Promise.resolve(null),
        ),
        findMany: jest.fn<Promise<ChargeRow[]>, [Args]>(() => Promise.resolve([])),
        create: jest.fn<Promise<ChargeMaster>, [Args]>(({ data }) =>
          Promise.resolve(makeCharge({ ...(data as Partial<ChargeMaster>) })),
        ),
        update: jest.fn<Promise<ChargeMaster>, [Args]>(({ where, data }) =>
          Promise.resolve(
            makeCharge({
              ...Object.fromEntries(Object.entries(data!).filter(([, v]) => v !== undefined)),
              chgId: where.chgId as string,
            }),
          ),
        ),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [Args]>(() =>
          Promise.resolve({ count: 1 }),
        ),
      },
      accLedgerMaster: {
        findFirst: jest.fn<Promise<ChargeLedgerDetail | null>, [Args]>(() =>
          Promise.resolve(ledgerDetail()),
        ),
      },
      taxRateMaster: {
        findUnique: jest.fn<Promise<ChargeTaxDetail | null>, [Args]>(() =>
          Promise.resolve(taxDetail()),
        ),
      },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    auditLogService = {
      logEntityChange: jest.fn<Promise<void>, [AuditEntry, unknown]>(() => Promise.resolve()),
    };
    service = new ChargeMasterService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      {} as ConfiguredGridSqlService,
      { getUserId: () => userId } as unknown as RequestContextService,
    );
  });

  /** The code / role probes the service sent, by the field they look up. */
  const probe = (field: 'chgCode' | 'chgRole') =>
    prisma.chargeMaster.findFirst.mock.calls.map(([args]) => args.where).find((w) => field in w);

  describe('save — create (no chgId)', () => {
    it('writes the charge with the optional fields sent and stamps the creator', async () => {
      await service.save(
        saveDto({
          chgName: '  Freight ',
          chgCode: ' FRT ',
          chgRole: 'FREIGHT',
          chgDefaultRate: 250,
          chgLandingCost: true,
          chgCostAlloc: 'VALUE',
          chgDispOrder: 1,
        }),
      );

      expect(prisma.chargeMaster.create.mock.calls[0][0].data).toEqual({
        chgName: 'Freight',
        chgModule: 'P',
        chgMethod: 'FIXED',
        chgApplyOn: 'VALUE',
        chgLedgerCode: LEDGER_ID,
        chgCreatedOn: expect.any(Date) as Date,
        chgCreatedBy: USER_ID,
        chgModifiedOn: expect.any(Date) as Date,
        chgModifiedBy: USER_ID,
        chgCode: 'FRT',
        chgRole: 'FREIGHT',
        chgType: 'ADD',
        chgDefaultRate: 250,
        chgLandingCost: true,
        chgCostAlloc: 'VALUE',
        chgDispOrder: 1,
      });
    });

    it('takes the body audit users over the request user', async () => {
      const other = '019c6f6c-be87-7a11-8905-36092c46f6aa';

      await service.save(saveDto({ chgCreatedBy: other, chgModifiedBy: other }));

      expect(prisma.chargeMaster.create.mock.calls[0][0].data).toMatchObject({
        chgCreatedBy: other,
        chgModifiedBy: other,
      });
    });

    it('stamps the default actor when there is no user at all', async () => {
      userId = undefined;

      await service.save(saveDto());

      expect(prisma.chargeMaster.create.mock.calls[0][0].data!.chgCreatedBy).toBe(DEFAULT_ACTOR);
    });

    it('echoes the ledger and inherits its rate when the charge names none', async () => {
      const payload = await service.save(saveDto());

      expect(payload).toMatchObject({
        chgLedgerName: 'Freight Inward A/c',
        ledHsnSac: '996511',
        chgTaxId: null,
        chgTaxName: null,
        ledTaxId: LEDGER_TAX_ID,
        ledgerTaxPerc: 5,
        chgTaxSource: 'LEDGER',
        chgTaxRate: 5,
        chgTaxCgstPerc: 2.5,
        chgTaxSgstPerc: 2.5,
        chgTaxIgstPerc: 5,
        chgTaxCessPerc: 0,
        chgTaxTaxability: 'TAXABLE',
        ledGstRate: 5,
        chgDefaultRate: 250,
      });
    });

    it('prices a charge at its own rate when it names one', async () => {
      const payload = await service.save(saveDto({ chgTaxApl: true, chgTaxId: TAX_ID }));

      expect(assertTaxRateRefsMock).toHaveBeenCalledWith(
        prisma,
        [{ taxId: TAX_ID, field: 'chgTaxId' }],
        'Invalid charge tax rate',
      );
      expect(payload).toMatchObject({
        chgTaxId: TAX_ID,
        chgTaxName: 'GST 18%',
        chgTaxSource: 'CHARGE',
        chgTaxRate: 18,
        ledgerTaxPerc: 5,
        ledGstRate: 18,
      });
    });

    it('reports no rate when neither the charge nor the ledger names one', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValueOnce(
        ledgerDetail({ ledTaxId: null, taxRate: null }),
      );

      await expect(service.save(saveDto())).resolves.toMatchObject({
        chgTaxSource: null,
        chgTaxRate: null,
        ledgerTaxPerc: null,
        chgTaxTaxability: null,
      });
    });

    // ck_chg_tax_id: a rate on a charge nothing taxes on its own is a rate nothing reads.
    it.each([
      ['a charge that is not taxable', { chgTaxApl: false }],
      ['a before-tax charge', { chgTaxApl: true, chgBeforeTax: true }],
    ])('refuses a rate on %s', async (_label, flags) => {
      await expect(
        bodyOf(service.save(saveDto({ ...flags, chgTaxId: TAX_ID }))),
      ).resolves.toMatchObject({
        message: 'Invalid charge tax rate',
        errors: [{ field: 'chgTaxId', code: CHARGE_ERROR.TAX_NOT_APPLICABLE }],
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lets the rate check refuse a retired rate', async () => {
      const refusal = new BadRequestException({
        success: false,
        message: 'Invalid charge tax rate',
        errors: [{ field: 'chgTaxId', message: 'inactive', code: 'TAX_RATE_INACTIVE' }],
      });
      assertTaxRateRefsMock.mockRejectedValueOnce(refusal);

      await expect(service.save(saveDto({ chgTaxApl: true, chgTaxId: TAX_ID }))).rejects.toBe(
        refusal,
      );
      expect(prisma.chargeMaster.create).not.toHaveBeenCalled();
    });

    it('refuses a ledger with no live row', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValueOnce(null);

      await expect(bodyOf(service.save(saveDto()))).resolves.toEqual({
        success: false,
        message: 'Ledger does not exist',
        errors: [
          {
            field: 'chgLedgerCode',
            message: `No active ledger found with id ${LEDGER_ID}`,
            code: CHARGE_ERROR.LEDGER_NOT_FOUND,
          },
        ],
      });
      expect(prisma.chargeMaster.create).not.toHaveBeenCalled();
    });

    it('refuses every value outside its allowed list at once', async () => {
      await expect(
        bodyOf(service.save(saveDto({ chgModule: 'X', chgMethod: 'BOX', chgCostAlloc: 'AREA' }))),
      ).resolves.toEqual({
        success: false,
        message: 'Invalid charge value',
        errors: [
          {
            field: 'chgModule',
            message: 'chgModule must be one of: P, S, B',
            code: CHARGE_ERROR.VALUE_NOT_ALLOWED,
          },
          {
            field: 'chgMethod',
            message: 'chgMethod must be one of: FIXED, QTY, NET_QTY, KG, QTL, TON, PERCENT',
            code: CHARGE_ERROR.VALUE_NOT_ALLOWED,
          },
          {
            field: 'chgCostAlloc',
            message: 'chgCostAlloc must be one of: VALUE, QTY, WEIGHT',
            code: CHARGE_ERROR.VALUE_NOT_ALLOWED,
          },
        ],
      });
    });

    it('lets a nullable role and cost allocation be null', async () => {
      await service.save(saveDto({ chgRole: null, chgCostAlloc: null }));

      expect(prisma.chargeMaster.create).toHaveBeenCalledTimes(1);
    });

    it('checks the code among live charges in any case', async () => {
      await service.save(saveDto({ chgCode: 'frt' }));

      expect(probe('chgCode')).toEqual({
        chgIsDeleted: false,
        chgCode: { equals: 'frt', mode: 'insensitive' },
      });
    });

    it('refuses a code another live charge holds', async () => {
      prisma.chargeMaster.findFirst.mockResolvedValueOnce({ chgId: OTHER_CHG_ID });

      const promise = service.save(saveDto({ chgCode: 'FRT' }));

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toMatchObject({
        message: 'Charge code already exists',
        errors: [{ field: 'chgCode', code: CHARGE_ERROR.CODE_DUPLICATE }],
      });
    });

    it('skips the code check for a charge with no code', async () => {
      await service.save(saveDto({ chgCode: null }));

      expect(probe('chgCode')).toBeUndefined();
    });

    // uq_charge_role: one FREIGHT / LOADING / UNLOADING / CASH_DISC / OTHERS charge per module.
    it('refuses a second one-per-module role in the same module', async () => {
      prisma.chargeMaster.findFirst.mockImplementation(({ where }) =>
        Promise.resolve('chgRole' in where ? { chgId: OTHER_CHG_ID } : null),
      );

      await expect(
        bodyOf(service.save(saveDto({ chgRole: 'FREIGHT', chgModule: 'S' }))),
      ).resolves.toEqual({
        success: false,
        message: 'A FREIGHT charge already exists for module S',
        errors: [
          {
            field: 'chgRole',
            message: 'Only one FREIGHT charge is allowed per module',
            code: CHARGE_ERROR.ROLE_DUPLICATE,
          },
        ],
      });
      expect(probe('chgRole')).toEqual({ chgIsDeleted: false, chgRole: 'FREIGHT', chgModule: 'S' });
    });

    it('lets any number of NONE charges share a module', async () => {
      await service.save(saveDto({ chgRole: 'NONE' }));

      expect(probe('chgRole')).toBeUndefined();
    });

    it('files a New audit row inside the same transaction', async () => {
      const payload = await service.save(saveDto());

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toEqual({
        action: 'New',
        tableName: 'charge master',
        screenName: 'Charge Master',
        screenType: 'master',
        pk: CHG_ID,
        displayName: 'Freight',
        originalRecord: null,
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Charge created',
      });
      expect(client).toBe(prisma);
    });

    it.each([
      ['a unique violation', 'P2002', ConflictException, CHARGE_ERROR.DUPLICATE],
      ['a foreign-key violation', 'P2003', BadRequestException, CHARGE_ERROR.REFERENCE_INVALID],
    ])('answers %s with its code', async (_label, prismaCode, type, code) => {
      prisma.chargeMaster.create.mockRejectedValueOnce(
        Object.assign(new Error('refused'), { code: prismaCode }),
      );

      const promise = service.save(saveDto());

      await expect(promise).rejects.toBeInstanceOf(type);
      await expect(bodyOf(promise)).resolves.toMatchObject({ errors: [{ code }] });
    });
  });

  describe('save — update (chgId sent)', () => {
    beforeEach(() => {
      prisma.chargeMaster.findFirst.mockImplementation(({ where }) =>
        Promise.resolve(
          where.chgId === CHG_ID ? makeCharge({ chgTaxApl: true, chgTaxId: TAX_ID }) : null,
        ),
      );
    });

    const updateDto = (overrides: Partial<SaveChargeMasterDto> = {}) =>
      saveDto({
        chgId: CHG_ID,
        chgCode: 'FRT',
        chgRole: 'FREIGHT',
        chgTaxApl: true,
        chgTaxId: TAX_ID,
        ...overrides,
      });

    it('updates the live charge and stamps the modifier', async () => {
      await service.save(updateDto({ chgName: 'Freight Inward', chgDefaultRate: 300 }));

      const { where, data } = prisma.chargeMaster.update.mock.calls[0][0];
      expect(where).toEqual({ chgId: CHG_ID });
      expect(data).toMatchObject({
        chgName: 'Freight Inward',
        chgCode: 'FRT',
        chgDefaultRate: 300,
        chgModifiedOn: expect.any(Date) as Date,
        chgModifiedBy: USER_ID,
      });
      expect(data).not.toHaveProperty('chgCreatedOn');
      expect(prisma.chargeMaster.create).not.toHaveBeenCalled();
    });

    // A stored rate retired since must not block an edit that leaves it alone.
    it('does not re-check the stored rate when the body keeps it', async () => {
      await service.save(updateDto());

      expect(assertTaxRateRefsMock).not.toHaveBeenCalled();
      expect(prisma.taxRateMaster.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { taxId: TAX_ID } }),
      );
    });

    it('checks a new rate the body names', async () => {
      const NEW_TAX_ID = '019c6f6c-be87-7a11-8905-36092c46f6bb';

      await service.save(updateDto({ chgTaxId: NEW_TAX_ID }));

      expect(assertTaxRateRefsMock).toHaveBeenCalledWith(
        prisma,
        [{ taxId: NEW_TAX_ID, field: 'chgTaxId' }],
        'Invalid charge tax rate',
      );
    });

    it('clears the rate when the body sends null', async () => {
      await service.save(updateDto({ chgTaxId: null }));

      expect(prisma.chargeMaster.update.mock.calls[0][0].data!.chgTaxId).toBeNull();
    });

    it('refuses turning tax off while the charge keeps its rate', async () => {
      await expect(bodyOf(service.save(updateDto({ chgTaxApl: false })))).resolves.toMatchObject({
        errors: [{ field: 'chgTaxId', code: CHARGE_ERROR.TAX_NOT_APPLICABLE }],
      });
      expect(prisma.chargeMaster.update).not.toHaveBeenCalled();
    });

    it('skips its own row when checking the code and the role', async () => {
      await service.save(updateDto());

      expect(probe('chgCode')).toMatchObject({ chgId: { not: CHG_ID } });
      expect(probe('chgRole')).toMatchObject({ chgId: { not: CHG_ID } });
    });

    it('keeps the derived ledger and rate fields out of the audit snapshots', async () => {
      const payload = await service.save(updateDto());

      const [entry] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({ action: 'update', pk: CHG_ID, notes: 'Charge updated' });
      expect(entry.modifiedRecord).toMatchObject({
        chgLedgerName: null,
        chgTaxName: null,
        chgTaxRate: null,
      });
      expect(payload).toMatchObject({ chgLedgerName: 'Freight Inward A/c', chgTaxName: 'GST 18%' });
    });

    // dto-own-undefined trap: after the house ValidationPipe every declared field is
    // an own property holding undefined, so a key left out must read as "keep".
    describe('a partial body through the house ValidationPipe', () => {
      const piped = async (body: Record<string, unknown>) =>
        (await createHouseValidationPipe().transform(body, {
          type: 'body',
          metatype: SaveChargeMasterDto,
        })) as SaveChargeMasterDto;
      const partial = {
        chgId: CHG_ID,
        chgName: 'Freight',
        chgModule: 'P',
        chgMethod: 'FIXED',
        chgApplyOn: 'VALUE',
        chgLedgerCode: LEDGER_ID,
      };

      it('keeps the stored code, role, type and rate when the body leaves them out', async () => {
        const dto = await piped(partial);
        expect(Object.prototype.hasOwnProperty.call(dto, 'chgCode')).toBe(true);

        await service.save(dto);

        const { data } = prisma.chargeMaster.update.mock.calls[0][0];
        expect(data!.chgCode).toBe('FRT');
        expect(data).not.toHaveProperty('chgRole');
        expect(data).not.toHaveProperty('chgType');
        expect(data).not.toHaveProperty('chgTaxId');
        // The role check runs against the stored role, not a null.
        expect(probe('chgRole')).toMatchObject({ chgRole: 'FREIGHT', chgId: { not: CHG_ID } });
      });

      it('judges chgTaxApl=false against the stored rate', async () => {
        await expect(
          bodyOf(service.save(await piped({ ...partial, chgTaxApl: false }))),
        ).resolves.toMatchObject({
          errors: [{ field: 'chgTaxId', code: CHARGE_ERROR.TAX_NOT_APPLICABLE }],
        });
        expect(prisma.chargeMaster.update).not.toHaveBeenCalled();
      });

      it('judges chgBeforeTax=true against the stored tax flag and rate', async () => {
        await expect(
          bodyOf(service.save(await piped({ ...partial, chgBeforeTax: true }))),
        ).resolves.toMatchObject({
          errors: [{ field: 'chgTaxId', code: CHARGE_ERROR.TAX_NOT_APPLICABLE }],
        });
      });

      it('still clears the code when the body sends null', async () => {
        await service.save(await piped({ ...partial, chgCode: null }));

        expect(prisma.chargeMaster.update.mock.calls[0][0].data!.chgCode).toBeNull();
      });
    });

    it('refuses an id with no live charge', async () => {
      const promise = service.save(updateDto({ chgId: OTHER_CHG_ID }));

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Charge not found',
        errors: [
          {
            field: 'chgId',
            message: `No active charge found with id ${OTHER_CHG_ID}`,
            code: CHARGE_ERROR.NOT_FOUND,
          },
        ],
      });
    });
  });

  describe('get', () => {
    it('answers one charge by id, with its ledger and rate', async () => {
      prisma.chargeMaster.findFirst.mockResolvedValueOnce({
        ...makeCharge({ chgTaxApl: true, chgTaxId: TAX_ID }),
        ledger: ledgerDetail(),
        tax: taxDetail(),
      });

      await expect(service.get({ chgId: CHG_ID })).resolves.toMatchObject({
        chgId: CHG_ID,
        chgLedgerName: 'Freight Inward A/c',
        chgTaxSource: 'CHARGE',
        chgTaxRate: 18,
      });
      expect(prisma.chargeMaster.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { chgId: CHG_ID, chgIsDeleted: false } }),
      );
    });

    it('refuses an id with no live charge', async () => {
      await expect(bodyOf(service.get({ chgId: CHG_ID }))).resolves.toMatchObject({
        errors: [{ field: 'chgId', code: CHARGE_ERROR.NOT_FOUND }],
      });
    });

    // A B ("both") charge serves purchase and sales alike.
    it.each([
      ['P', ['P', 'B']],
      ['S', ['S', 'B']],
      ['B', ['B']],
    ])(
      'answers module %s with the live, active charges of %p in display order',
      async (chgModule, modules) => {
        prisma.chargeMaster.findMany.mockResolvedValueOnce([
          { ...makeCharge(), ledger: ledgerDetail(), tax: null },
        ]);

        const charges = await service.get({ chgModule });

        expect(prisma.chargeMaster.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { chgIsDeleted: false, chgIsActive: true, chgModule: { in: modules } },
            orderBy: [{ chgDispOrder: { sort: 'asc', nulls: 'last' } }, { chgName: 'asc' }],
          }),
        );
        expect(charges).toHaveLength(1);
      },
    );

    it.each([
      ['both an id and a module', { chgId: CHG_ID, chgModule: 'P' }, CHARGE_ERROR.LOOKUP_AMBIGUOUS],
      ['neither', {}, CHARGE_ERROR.LOOKUP_MISSING],
    ])('refuses %s', async (_label, query, code) => {
      await expect(bodyOf(service.get(query))).resolves.toMatchObject({
        errors: [{ field: 'chgId', code }],
      });
    });
  });

  describe('softDelete', () => {
    beforeEach(() => {
      prisma.chargeMaster.findFirst.mockResolvedValue(makeCharge());
    });

    it('marks the live charge deleted and inactive and files a cancel audit row', async () => {
      await expect(service.softDelete(CHG_ID)).resolves.toEqual({ chgId: CHG_ID, deleted: true });

      expect(prisma.chargeMaster.updateMany.mock.calls[0][0]).toEqual({
        where: { chgId: CHG_ID, chgIsDeleted: false },
        data: {
          chgIsDeleted: true,
          chgIsActive: false,
          chgModifiedOn: expect.any(Date) as Date,
          chgModifiedBy: USER_ID,
        },
      });
      const [entry] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'cancel',
        pk: CHG_ID,
        displayName: 'Freight',
        notes: 'Charge soft deleted',
      });
      expect(entry.modifiedRecord).toMatchObject({ chgIsDeleted: true, chgIsActive: false });
    });

    it('refuses an id with no live charge', async () => {
      prisma.chargeMaster.findFirst.mockResolvedValue(null);

      await expect(service.softDelete(CHG_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.chargeMaster.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the write finds the row already gone, without an audit row', async () => {
      prisma.chargeMaster.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.softDelete(CHG_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });
  });
});
