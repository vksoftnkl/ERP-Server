import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { AccTenderMaster, Prisma } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveTenderMasterDto } from './dto/save-tender-master.dto';
import { TenderMasterService } from './tender-master.service';
import { TenderMasterErrorCode } from './types/tender-master-api.types';

const TND_ID = '019c6f6c-be87-7a11-8905-36092c46f701';
const OTHER_TND_ID = '019c6f6c-be87-7a11-8905-36092c46f702';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46f703';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46f704';
const CASH_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46f705';
const SETTLE_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46f706';
const BANK_ACCOUNT_ID = '019c6f6c-be87-7a11-8905-36092c46f707';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f7ff';
const CREATED_ON = new Date('2026-10-01T09:00:00.000Z');

const makeTender = (overrides: Partial<AccTenderMaster> = {}): AccTenderMaster => ({
  tndId: TND_ID,
  tndCompanyId: COMPANY_ID,
  tndBranchId: BRANCH_ID,
  tndTypeId: 1,
  tndName: 'Cash',
  tndShortName: 'Cash',
  tndLedgerId: CASH_LEDGER_ID,
  tndSettlementLedgerId: null,
  tndSettlementDays: 0,
  tndBankAccountId: null,
  tndMinAmount: new Prisma.Decimal('0'),
  tndMaxAmount: new Prisma.Decimal('200000'),
  tndDailyLimit: null,
  tndSurchargePerc: new Prisma.Decimal('0'),
  tndSurchargeAmount: new Prisma.Decimal('0'),
  tndSurchargeLedgerId: null,
  tndEditSurcharge: false,
  tndEditLedger: false,
  tndUpiVpa: null,
  tndUpiQrPayload: null,
  tndMerchantId: null,
  tndTerminalId: null,
  tndConversionRate: new Prisma.Decimal('1'),
  tndNeedsRef: null,
  tndAllowChange: true,
  tndAllowInReturn: null,
  tndOpenCashDrawer: true,
  tndIsDefault: false,
  tndDisplayPosition: 0,
  tndHotkey: 'F2',
  tndColour: null,
  tndEffectiveFrom: new Date('2026-04-01T00:00:00.000Z'),
  tndEffectiveTo: null,
  tndRemarks: null,
  tndIsActive: true,
  tndIsDeleted: false,
  tndSyncDate: null,
  tndCreatedOn: CREATED_ON,
  tndCreatedBy: USER_ID,
  tndModifiedOn: null,
  tndModifiedBy: null,
  tndStatementFormat: null,
  ...overrides,
});

const saveDto = (overrides: Partial<SaveTenderMasterDto> = {}): SaveTenderMasterDto => ({
  tndCompanyId: COMPANY_ID,
  tndBranchId: BRANCH_ID,
  tndTypeId: '1',
  tndName: 'Cash',
  tndLedgerId: CASH_LEDGER_ID,
  tndMinAmount: 0,
  ...overrides,
});

type Args = {
  where: Record<string, unknown>;
  data?: Record<string, unknown>;
  select?: unknown;
  include?: unknown;
  orderBy?: unknown;
};
type Clash = { tndId: string; tndName?: string } | null;
type AuditEntry = Record<string, unknown>;

type PrismaMock = {
  accTenderMaster: {
    findFirst: jest.Mock<Promise<unknown>, [Args]>;
    findMany: jest.Mock<Promise<unknown[]>, [Args]>;
    create: jest.Mock<Promise<AccTenderMaster>, [Args]>;
    update: jest.Mock<Promise<AccTenderMaster>, [Args]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Args]>;
  };
  company: { findFirst: jest.Mock<Promise<{ compId: string } | null>, [Args]> };
  branchMaster: { findFirst: jest.Mock<Promise<{ brId: string } | null>, [Args]> };
  accTenderType: { findFirst: jest.Mock<Promise<{ ttmTypeId: number } | null>, [Args]> };
  accLedgerMaster: {
    findFirst: jest.Mock<Promise<{ ledId: string } | null>, [Args]>;
    findUnique: jest.Mock<
      Promise<{ ledName: string; ledLedgerType: string | null } | null>,
      [Args]
    >;
  };
  accLedgerBankAccount: { findFirst: jest.Mock<Promise<{ lbaId: string } | null>, [Args]> };
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

describe('TenderMasterService', () => {
  let service: TenderMasterService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock<Promise<void>, [AuditEntry, unknown]> };
  let userId: string | undefined;
  let clashes: { name: Clash; shortName: Clash; hotkey: Clash; default: Clash };
  let ledgerType: string | null;

  beforeEach(() => {
    userId = USER_ID;
    clashes = { name: null, shortName: null, hotkey: null, default: null };
    ledgerType = 'CASH';
    prisma = {
      accTenderMaster: {
        findFirst: jest.fn<Promise<unknown>, [Args]>(({ where }) => {
          if ('tndName' in where) return Promise.resolve(clashes.name);
          if ('tndShortName' in where) return Promise.resolve(clashes.shortName);
          if ('tndHotkey' in where) return Promise.resolve(clashes.hotkey);
          if ('tndIsDefault' in where) return Promise.resolve(clashes.default);
          return Promise.resolve(where.tndId === TND_ID ? makeTender() : null);
        }),
        findMany: jest.fn<Promise<unknown[]>, [Args]>(() => Promise.resolve([])),
        create: jest.fn<Promise<AccTenderMaster>, [Args]>(({ data }) =>
          Promise.resolve(makeTender({ ...(data as Partial<AccTenderMaster>) })),
        ),
        update: jest.fn<Promise<AccTenderMaster>, [Args]>(({ where, data }) =>
          Promise.resolve(
            makeTender({
              ...Object.fromEntries(Object.entries(data!).filter(([, v]) => v !== undefined)),
              tndId: where.tndId as string,
            }),
          ),
        ),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [Args]>(() =>
          Promise.resolve({ count: 1 }),
        ),
      },
      company: {
        findFirst: jest.fn<Promise<{ compId: string } | null>, [Args]>(() =>
          Promise.resolve({ compId: COMPANY_ID }),
        ),
      },
      branchMaster: {
        findFirst: jest.fn<Promise<{ brId: string } | null>, [Args]>(() =>
          Promise.resolve({ brId: BRANCH_ID }),
        ),
      },
      accTenderType: {
        findFirst: jest.fn<Promise<{ ttmTypeId: number } | null>, [Args]>(({ where }) =>
          Promise.resolve({ ttmTypeId: where.ttmTypeId as number }),
        ),
      },
      accLedgerMaster: {
        findFirst: jest.fn<Promise<{ ledId: string } | null>, [Args]>(({ where }) =>
          Promise.resolve({ ledId: where.ledId as string }),
        ),
        findUnique: jest.fn<
          Promise<{ ledName: string; ledLedgerType: string | null } | null>,
          [Args]
        >(() => Promise.resolve({ ledName: 'Counter Cash', ledLedgerType: ledgerType })),
      },
      accLedgerBankAccount: {
        findFirst: jest.fn<Promise<{ lbaId: string } | null>, [Args]>(() =>
          Promise.resolve({ lbaId: BANK_ACCOUNT_ID }),
        ),
      },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    auditLogService = {
      logEntityChange: jest.fn<Promise<void>, [AuditEntry, unknown]>(() => Promise.resolve()),
    };
    service = new TenderMasterService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => userId } as unknown as RequestContextService,
    );
  });

  describe('save — create (no tndId)', () => {
    it('writes the tender with its numeric type and stamps the creator', async () => {
      await service.save(saveDto({ tndName: '  Counter Cash ' }));

      expect(prisma.accTenderMaster.create.mock.calls[0][0].data).toEqual({
        tndCompanyId: COMPANY_ID,
        tndBranchId: BRANCH_ID,
        tndTypeId: 1,
        tndName: 'Counter Cash',
        tndShortName: 'Counter Cash',
        tndLedgerId: CASH_LEDGER_ID,
        tndMinAmount: 0,
        tndCreatedOn: expect.any(Date) as Date,
        tndCreatedBy: USER_ID,
      });
    });

    it('clips a derived short name to 30 characters and keeps a sent one', async () => {
      await service.save(saveDto({ tndName: 'C'.repeat(40) }));
      expect(prisma.accTenderMaster.create.mock.calls[0][0].data!.tndShortName).toBe(
        'C'.repeat(30),
      );

      await service.save(saveDto({ tndShortName: ' Csh ' }));
      expect(prisma.accTenderMaster.create.mock.calls[1][0].data!.tndShortName).toBe('Csh');
    });

    it('makes a tender with no branch company-wide', async () => {
      await service.save(saveDto({ tndBranchId: undefined }));

      expect(prisma.accTenderMaster.create.mock.calls[0][0].data!.tndBranchId).toBeNull();
      expect(prisma.branchMaster.findFirst).not.toHaveBeenCalled();
    });

    it('drops an explicit null on a defaulted column, blanks a text column and reads dates', async () => {
      await service.save(
        saveDto({
          tndSettlementDays: null as unknown as number,
          tndIsActive: null as unknown as boolean,
          tndRemarks: '   ',
          tndUpiVpa: ' shop@upi ',
          tndEffectiveFrom: '2026-04-01',
          tndEffectiveTo: null,
        }),
      );

      const { data } = prisma.accTenderMaster.create.mock.calls[0][0];
      expect(data).not.toHaveProperty('tndSettlementDays', null);
      expect(data!.tndSettlementDays).toBeUndefined();
      expect(data!.tndIsActive).toBeUndefined();
      expect(data).toMatchObject({
        tndRemarks: null,
        tndUpiVpa: 'shop@upi',
        tndEffectiveFrom: new Date('2026-04-01'),
        tndEffectiveTo: null,
      });
    });

    it('returns the amounts as numbers and the effective dates as YYYY-MM-DD', async () => {
      const payload = await service.save(saveDto({ tndEffectiveFrom: '2026-04-01' }));

      expect(payload).toMatchObject({
        tndTypeId: '1',
        tndMinAmount: 0,
        tndMaxAmount: 200000,
        tndDailyLimit: null,
        tndConversionRate: 1,
        tndEffectiveFrom: '2026-04-01',
        tndEffectiveTo: null,
        tndModifiedOn: null,
        tndCompanyName: null,
        tndLedgerName: null,
      });
    });

    it.each([
      ['an id that is not a number', 'cash'],
      ['an id wider than 32 bits', '2147483648'],
    ])('refuses %s with TENDER_BAD_TYPE_ID', async (_label, tndTypeId) => {
      await expect(bodyOf(service.save(saveDto({ tndTypeId })))).resolves.toMatchObject({
        errors: [{ field: 'tndTypeId', code: TenderMasterErrorCode.BAD_TYPE_ID }],
      });
    });

    it('refuses a maximum below the minimum', async () => {
      await expect(
        bodyOf(service.save(saveDto({ tndMinAmount: 500, tndMaxAmount: 100 }))),
      ).resolves.toMatchObject({
        errors: [{ field: 'tndMaxAmount', code: TenderMasterErrorCode.AMOUNT_RANGE }],
      });
    });

    it('refuses an effective-to before the effective-from', async () => {
      await expect(
        bodyOf(
          service.save(saveDto({ tndEffectiveFrom: '2026-10-01', tndEffectiveTo: '2026-09-30' })),
        ),
      ).resolves.toMatchObject({
        errors: [{ field: 'tndEffectiveTo', code: TenderMasterErrorCode.DATE_RANGE }],
      });
    });

    it('refuses an effective date that is not a date', async () => {
      await expect(
        bodyOf(service.save(saveDto({ tndEffectiveFrom: 'someday' }))),
      ).resolves.toMatchObject({
        errors: [{ field: 'tndEffectiveFrom', code: TenderMasterErrorCode.DATE_INVALID }],
      });
    });

    it.each([
      [
        'the company',
        () => prisma.company.findFirst.mockResolvedValueOnce(null),
        'tndCompanyId',
        TenderMasterErrorCode.COMPANY_NOT_FOUND,
      ],
      [
        'the branch',
        () => prisma.branchMaster.findFirst.mockResolvedValueOnce(null),
        'tndBranchId',
        TenderMasterErrorCode.BRANCH_NOT_FOUND,
      ],
      [
        'the tender type',
        () => prisma.accTenderType.findFirst.mockResolvedValueOnce(null),
        'tndTypeId',
        TenderMasterErrorCode.UNKNOWN_TYPE,
      ],
      [
        'the posting ledger',
        () => prisma.accLedgerMaster.findFirst.mockResolvedValueOnce(null),
        'tndLedgerId',
        TenderMasterErrorCode.LEDGER_NOT_FOUND,
      ],
    ])('refuses when %s has no live row', async (_label, arrange, field, code) => {
      arrange();

      const promise = service.save(saveDto());

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toMatchObject({ errors: [{ field, code }] });
      expect(prisma.accTenderMaster.create).not.toHaveBeenCalled();
    });

    it('checks the settlement and surcharge ledgers and the bank account when named', async () => {
      prisma.accLedgerMaster.findFirst
        .mockResolvedValueOnce({ ledId: CASH_LEDGER_ID })
        .mockResolvedValueOnce(null);

      await expect(
        bodyOf(service.save(saveDto({ tndSettlementLedgerId: SETTLE_LEDGER_ID }))),
      ).resolves.toMatchObject({
        errors: [{ field: 'tndSettlementLedgerId', code: TenderMasterErrorCode.LEDGER_NOT_FOUND }],
      });

      prisma.accLedgerBankAccount.findFirst.mockResolvedValueOnce(null);
      await expect(
        bodyOf(service.save(saveDto({ tndBankAccountId: BANK_ACCOUNT_ID }))),
      ).resolves.toMatchObject({
        errors: [{ field: 'tndBankAccountId', code: TenderMasterErrorCode.BANK_ACCOUNT_NOT_FOUND }],
      });
    });

    describe('ledger fit (notes 126 / 128 §2)', () => {
      it.each([
        ['CASH on a CASH ledger', '1', 'CASH'],
        ['CARD on a clearing ledger', '2', 'CLEARING'],
        ['UPI on an untyped ledger', '3', null],
        ['WALLET on a clearing ledger', '4', 'CLEARING'],
        ['CHEQUE on Cheques In Hand', '5', 'CHEQUE'],
        ['BANK on a BANK ledger', '6', 'bank'],
      ])('accepts %s', async (_label, tndTypeId, type) => {
        ledgerType = type;

        await service.save(saveDto({ tndTypeId }));

        expect(prisma.accTenderMaster.create).toHaveBeenCalledTimes(1);
      });

      it.each([
        ['CASH on a BANK ledger', '1', 'BANK', TenderMasterErrorCode.CASH_LEDGER_NOT_CASH],
        ['CARD on a BANK ledger', '2', 'BANK', TenderMasterErrorCode.CLEARING_LEDGER_IS_MONEY],
        ['UPI on a CASH ledger', '3', 'CASH', TenderMasterErrorCode.CLEARING_LEDGER_IS_MONEY],
        ['CHEQUE on a BANK ledger', '5', 'BANK', TenderMasterErrorCode.CHEQUE_LEDGER_IS_MONEY],
        ['BANK on a CASH ledger', '6', 'CASH', TenderMasterErrorCode.BANK_LEDGER_NOT_BANK],
      ])('refuses %s', async (_label, tndTypeId, type, code) => {
        ledgerType = type;

        await expect(bodyOf(service.save(saveDto({ tndTypeId })))).resolves.toMatchObject({
          message: 'Tender ledger does not fit',
          errors: [{ field: 'tndLedgerId', code }],
        });
        expect(prisma.accTenderMaster.create).not.toHaveBeenCalled();
      });

      it('names the ledger in the refusal', async () => {
        ledgerType = 'BANK';

        await expect(bodyOf(service.save(saveDto()))).resolves.toMatchObject({
          errors: [
            {
              message:
                'Counter Cash is not a cash ledger: a CASH tender posts to a ledger under Cash-in-Hand',
            },
          ],
        });
      });

      it.each([['7'], ['8'], ['9'], ['10']])(
        'lets tender type %s, which posts no leg, go without a ledger',
        async (tndTypeId) => {
          await service.save(saveDto({ tndTypeId, tndLedgerId: null }));

          expect(prisma.accTenderMaster.create.mock.calls[0][0].data!.tndLedgerId).toBeNull();
        },
      );

      it('refuses a ledger on a tender type that posts no leg', async () => {
        await expect(bodyOf(service.save(saveDto({ tndTypeId: '9' })))).resolves.toMatchObject({
          errors: [{ field: 'tndLedgerId', code: TenderMasterErrorCode.LEDGER_NOT_ALLOWED }],
        });
      });

      it('refuses a money tender with no ledger', async () => {
        await expect(bodyOf(service.save(saveDto({ tndLedgerId: null })))).resolves.toMatchObject({
          errors: [{ field: 'tndLedgerId', code: TenderMasterErrorCode.LEDGER_REQUIRED }],
        });
      });
    });

    describe('uniqueness within the company and branch', () => {
      it('checks the name, short name and hotkey among the scope live tenders', async () => {
        await service.save(saveDto({ tndHotkey: 'F2' }));

        const wheres = prisma.accTenderMaster.findFirst.mock.calls.map(([args]) => args.where);
        const scope = { tndIsDeleted: false, tndCompanyId: COMPANY_ID, tndBranchId: BRANCH_ID };
        expect(wheres).toEqual(
          expect.arrayContaining([
            { ...scope, tndName: { equals: 'Cash', mode: 'insensitive' } },
            { ...scope, tndShortName: { equals: 'Cash', mode: 'insensitive' } },
            { ...scope, tndHotkey: 'F2' },
          ]),
        );
      });

      it.each([
        ['name', 'name', 'tndName', TenderMasterErrorCode.NAME_TAKEN],
        ['short name', 'shortName', 'tndShortName', TenderMasterErrorCode.SHORT_NAME_TAKEN],
        ['hotkey', 'hotkey', 'tndHotkey', TenderMasterErrorCode.HOTKEY_TAKEN],
      ] as const)('refuses a %s another live tender holds', async (_label, key, field, code) => {
        clashes[key] = { tndId: OTHER_TND_ID };

        const promise = service.save(saveDto({ tndHotkey: 'F2' }));

        await expect(promise).rejects.toBeInstanceOf(ConflictException);
        await expect(bodyOf(promise)).resolves.toMatchObject({ errors: [{ field, code }] });
      });

      it('refuses a second active default, naming the first', async () => {
        clashes.default = { tndId: OTHER_TND_ID, tndName: 'Card' };

        await expect(bodyOf(service.save(saveDto({ tndIsDefault: true })))).resolves.toMatchObject({
          errors: [
            {
              field: 'tndIsDefault',
              message: 'Card is already the default tender for this company/branch',
              code: TenderMasterErrorCode.DEFAULT_TAKEN,
            },
          ],
        });
      });

      it('lets an inactive tender be a default alongside an active one', async () => {
        clashes.default = { tndId: OTHER_TND_ID, tndName: 'Card' };

        await service.save(saveDto({ tndIsDefault: true, tndIsActive: false }));

        expect(prisma.accTenderMaster.create).toHaveBeenCalledTimes(1);
      });
    });

    it('stamps the default actor when the request carries no user', async () => {
      userId = undefined;

      await service.save(saveDto());

      expect(prisma.accTenderMaster.create.mock.calls[0][0].data!.tndCreatedBy).toBe(DEFAULT_ACTOR);
    });

    it('answers a unique violation as TENDER_DUPLICATE', async () => {
      prisma.accTenderMaster.create.mockRejectedValueOnce(
        Object.assign(new Error('Unique'), { code: 'P2002' }),
      );

      await expect(bodyOf(service.save(saveDto()))).resolves.toMatchObject({
        errors: [{ field: 'tndName', code: TenderMasterErrorCode.DUPLICATE }],
      });
    });
  });

  describe('save — update (tndId sent)', () => {
    it('updates the live tender and stamps the modifier', async () => {
      await service.save(saveDto({ tndId: TND_ID, tndName: 'Counter Cash' }));

      const { where, data } = prisma.accTenderMaster.update.mock.calls[0][0];
      expect(where).toEqual({ tndId: TND_ID });
      expect(data).toMatchObject({
        tndName: 'Counter Cash',
        tndBranchId: BRANCH_ID,
        tndModifiedOn: expect.any(Date) as Date,
        tndModifiedBy: USER_ID,
      });
      expect(data).not.toHaveProperty('tndCreatedOn');
    });

    it('keeps the stored ledger when the body leaves it out', async () => {
      await service.save(saveDto({ tndId: TND_ID, tndLedgerId: undefined }));

      expect(prisma.accTenderMaster.update.mock.calls[0][0].data!.tndLedgerId).toBe(CASH_LEDGER_ID);
    });

    it('checks a new minimum against the stored maximum', async () => {
      await expect(
        bodyOf(service.save(saveDto({ tndId: TND_ID, tndMinAmount: 300000 }))),
      ).resolves.toMatchObject({ errors: [{ code: TenderMasterErrorCode.AMOUNT_RANGE }] });
      expect(prisma.accTenderMaster.update).not.toHaveBeenCalled();
    });

    it('checks a new effective-to against the stored effective-from', async () => {
      await expect(
        bodyOf(service.save(saveDto({ tndId: TND_ID, tndEffectiveTo: '2026-03-31' }))),
      ).resolves.toMatchObject({ errors: [{ code: TenderMasterErrorCode.DATE_RANGE }] });
    });

    it('skips its own row in every uniqueness check', async () => {
      await service.save(saveDto({ tndId: TND_ID, tndHotkey: 'F2', tndIsDefault: true }));

      const probes = prisma.accTenderMaster.findFirst.mock.calls
        .map(([args]) => args.where)
        .filter((where) => !('tndId' in where && typeof where.tndId === 'string'));
      expect(probes).toHaveLength(4);
      for (const where of probes) {
        expect(where).toMatchObject({ tndId: { not: TND_ID } });
      }
    });

    it('files an update audit row holding the row before and after', async () => {
      const payload = await service.save(saveDto({ tndId: TND_ID, tndName: 'Counter Cash' }));

      const [entry] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'update',
        pk: TND_ID,
        modifiedRecord: payload,
        notes: 'Tender updated',
      });
      expect(entry.originalRecord).toMatchObject({ tndName: 'Cash' });
    });

    it('refuses an id with no live tender', async () => {
      const promise = service.save(saveDto({ tndId: OTHER_TND_ID }));

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Tender not found',
        errors: [
          {
            field: 'tndId',
            message: `No active tender found with id ${OTHER_TND_ID}`,
            code: TenderMasterErrorCode.NOT_FOUND,
          },
        ],
      });
    });
  });

  describe('list and getById', () => {
    it('lists every live tender in POS strip order with the master names', async () => {
      prisma.accTenderMaster.findMany.mockResolvedValueOnce([
        {
          ...makeTender(),
          company: { compName: 'Acme' },
          tenderType: { ttmTypeName: 'CASH' },
          ledger: { ledName: 'Counter Cash' },
        },
      ]);

      const tenders = await service.list();

      expect(prisma.accTenderMaster.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tndIsDeleted: false },
          orderBy: [{ tndDisplayPosition: 'asc' }, { tndName: 'asc' }, { tndId: 'asc' }],
        }),
      );
      expect(tenders[0]).toMatchObject({
        tndCompanyName: 'Acme',
        tndTypeName: 'CASH',
        tndLedgerName: 'Counter Cash',
        tndBranchName: null,
      });
    });

    it('reads one live tender with its names', async () => {
      prisma.accTenderMaster.findFirst.mockResolvedValueOnce({
        ...makeTender(),
        branch: { brName: 'Main' },
      });

      await expect(service.getById(TND_ID)).resolves.toMatchObject({
        tndId: TND_ID,
        tndBranchName: 'Main',
      });
      expect(prisma.accTenderMaster.findFirst.mock.calls[0][0].where).toEqual({
        tndId: TND_ID,
        tndIsDeleted: false,
      });
    });

    it('refuses an id with no live tender', async () => {
      await expect(bodyOf(service.getById(OTHER_TND_ID))).resolves.toMatchObject({
        errors: [{ code: TenderMasterErrorCode.NOT_FOUND }],
      });
    });
  });

  describe('softDelete', () => {
    it('marks the live tender deleted and inactive and files a cancel audit row', async () => {
      await expect(service.softDelete(TND_ID)).resolves.toEqual({ tndId: TND_ID, deleted: true });

      expect(prisma.accTenderMaster.updateMany.mock.calls[0][0]).toEqual({
        where: { tndId: TND_ID, tndIsDeleted: false },
        data: {
          tndIsDeleted: true,
          tndIsActive: false,
          tndModifiedOn: expect.any(Date) as Date,
          tndModifiedBy: USER_ID,
        },
      });
      const [entry] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'cancel',
        pk: TND_ID,
        displayName: 'Cash',
        notes: 'Tender soft deleted',
      });
      expect(entry.modifiedRecord).toMatchObject({ tndIsDeleted: true, tndIsActive: false });
    });

    it('refuses an id with no live tender', async () => {
      await expect(service.softDelete(OTHER_TND_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.accTenderMaster.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the write finds the row already gone, without an audit row', async () => {
      prisma.accTenderMaster.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.softDelete(TND_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });
  });
});
