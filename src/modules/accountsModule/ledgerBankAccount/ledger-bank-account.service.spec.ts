import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { AccLedgerBankAccount, Prisma } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveLedgerBankAccountDto } from './dto/save-ledger-bank-account.dto';
import { createHouseValidationPipe } from '../../../common/validation/house-validation';
import { LedgerBankAccountService } from './ledger-bank-account.service';
import { LedgerBankErrorCode } from './types/ledger-bank-account-error-codes';

const LBA_ID = '019c6f6c-be87-7a11-8905-36092c46d101';
const OTHER_LBA_ID = '019c6f6c-be87-7a11-8905-36092c46d102';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46d103';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46d104';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46d105';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46d1ff';
const CREATED_ON = new Date('2026-10-01T09:00:00.000Z');
const MODIFIED_ON = new Date('2026-10-02T09:00:00.000Z');

const makeAccount = (overrides: Partial<AccLedgerBankAccount> = {}): AccLedgerBankAccount => ({
  lbaId: LBA_ID,
  lbaCompanyId: COMPANY_ID,
  lbaLedgerId: LEDGER_ID,
  lbaAccountHolder: 'Acme Industries Pvt Ltd',
  lbaBankName: 'HDFC Bank',
  lbaBranchName: 'MG Road',
  lbaAccountNo: '50100123456789',
  lbaIfscCode: 'HDFC0001234',
  lbaMicrCode: null,
  lbaAccountType: 'CURRENT',
  lbaUpiId: null,
  lbaChequeName: null,
  lbaIsDefault: false,
  lbaIsActive: true,
  lbaIsDeleted: false,
  lbaSyncDate: null,
  lbaCreatedOn: CREATED_ON,
  lbaCreatedBy: USER_ID,
  lbaModifiedOn: MODIFIED_ON,
  lbaModifiedBy: USER_ID,
  lbaRemarks: null,
  ...overrides,
});

const saveDto = (overrides: Partial<SaveLedgerBankAccountDto> = {}): SaveLedgerBankAccountDto => ({
  lbaLedgerId: LEDGER_ID,
  lbaAccountHolder: 'Acme Industries Pvt Ltd',
  lbaBankName: 'HDFC Bank',
  lbaAccountNo: '50100123456789',
  ...overrides,
});

type CreateArgs = { data: Prisma.AccLedgerBankAccountUncheckedCreateInput };
type UpdateArgs = {
  where: { lbaId: string };
  data: Prisma.AccLedgerBankAccountUncheckedUpdateInput;
};
type FindArgs = { where: Record<string, unknown>; select?: Record<string, boolean> };
type FindResult = AccLedgerBankAccount | { lbaId: string } | null;
type UpdateManyArgs = { where: Record<string, unknown>; data: Record<string, unknown> };
type AuditEntry = Record<string, unknown>;

type PrismaMock = {
  accLedgerBankAccount: {
    findFirst: jest.Mock<Promise<FindResult>, [FindArgs]>;
    create: jest.Mock<Promise<AccLedgerBankAccount>, [CreateArgs]>;
    update: jest.Mock<Promise<AccLedgerBankAccount>, [UpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [UpdateManyArgs]>;
  };
  accLedgerMaster: {
    findFirst: jest.Mock<
      Promise<{ ledId: string; ledCompanyId: string | null } | null>,
      [FindArgs]
    >;
  };
  company: { findFirst: jest.Mock<Promise<{ compId: string } | null>, [FindArgs]> };
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

describe('LedgerBankAccountService', () => {
  let service: LedgerBankAccountService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock<Promise<void>, [AuditEntry, unknown]> };
  let userId: string | undefined;

  beforeEach(() => {
    userId = USER_ID;
    prisma = {
      accLedgerBankAccount: {
        // Default: no live account by id, and no clash on the account number.
        findFirst: jest.fn<Promise<FindResult>, [FindArgs]>(() => Promise.resolve(null)),
        create: jest.fn(({ data }: CreateArgs) =>
          Promise.resolve(makeAccount({ ...(data as unknown as Partial<AccLedgerBankAccount>) })),
        ),
        update: jest.fn(({ where, data }: UpdateArgs) =>
          Promise.resolve(
            makeAccount({
              ...(data as unknown as Partial<AccLedgerBankAccount>),
              lbaId: where.lbaId,
            }),
          ),
        ),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [UpdateManyArgs]>(() =>
          Promise.resolve({ count: 1 }),
        ),
      },
      accLedgerMaster: {
        findFirst: jest.fn<
          Promise<{ ledId: string; ledCompanyId: string | null } | null>,
          [FindArgs]
        >(() => Promise.resolve({ ledId: LEDGER_ID, ledCompanyId: COMPANY_ID })),
      },
      company: {
        findFirst: jest.fn<Promise<{ compId: string } | null>, [FindArgs]>(({ where }) =>
          Promise.resolve({ compId: where.compId as string }),
        ),
      },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    auditLogService = {
      logEntityChange: jest.fn<Promise<void>, [AuditEntry, unknown]>(() => Promise.resolve()),
    };
    service = new LedgerBankAccountService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => userId } as unknown as RequestContextService,
    );
  });

  describe('save — create (no lbaId)', () => {
    it('trims the required text, takes the ledger company and stamps the creator', async () => {
      const payload = await service.save(
        saveDto({
          lbaAccountHolder: '  Acme Industries Pvt Ltd ',
          lbaBankName: ' HDFC Bank ',
          lbaAccountNo: ' 50100123456789 ',
        }),
      );

      expect(prisma.accLedgerBankAccount.create.mock.calls[0][0].data).toEqual({
        lbaCompanyId: COMPANY_ID,
        lbaLedgerId: LEDGER_ID,
        lbaAccountHolder: 'Acme Industries Pvt Ltd',
        lbaBankName: 'HDFC Bank',
        lbaAccountNo: '50100123456789',
        lbaCreatedOn: expect.any(Date) as Date,
        lbaCreatedBy: USER_ID,
      });
      expect(payload).toMatchObject({
        lbaId: LBA_ID,
        lbaCompanyId: COMPANY_ID,
        lbaSyncDate: null,
        lbaModifiedOn: MODIFIED_ON.toISOString(),
      });
    });

    it('writes the optional fields sent', async () => {
      await service.save(
        saveDto({
          lbaBranchName: 'MG Road',
          lbaIfscCode: 'HDFC0001234',
          lbaMicrCode: '560240002',
          lbaAccountType: 'CURRENT',
          lbaUpiId: 'acme@hdfcbank',
          lbaChequeName: 'Acme Industries',
          lbaIsActive: true,
          lbaRemarks: null,
        }),
      );

      expect(prisma.accLedgerBankAccount.create.mock.calls[0][0].data).toMatchObject({
        lbaBranchName: 'MG Road',
        lbaIfscCode: 'HDFC0001234',
        lbaMicrCode: '560240002',
        lbaAccountType: 'CURRENT',
        lbaUpiId: 'acme@hdfcbank',
        lbaChequeName: 'Acme Industries',
        lbaIsActive: true,
        lbaRemarks: null,
      });
    });

    it('reads the ledger as a live ledger', async () => {
      await service.save(saveDto());

      expect(prisma.accLedgerMaster.findFirst).toHaveBeenCalledWith({
        where: { ledId: LEDGER_ID, ledIsDeleted: false },
        select: { ledId: true, ledCompanyId: true },
      });
    });

    it('refuses a ledger with no live row', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValueOnce(null);

      const promise = service.save(saveDto());

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Account ledger does not exist',
        errors: [
          {
            field: 'lbaLedgerId',
            message: `No active account ledger found with id ${LEDGER_ID}`,
            code: LedgerBankErrorCode.LEDGER_NOT_FOUND,
          },
        ],
      });
      expect(prisma.accLedgerBankAccount.create).not.toHaveBeenCalled();
    });

    describe('company', () => {
      it('accepts the ledger company sent explicitly', async () => {
        await service.save(saveDto({ lbaCompanyId: COMPANY_ID }));

        expect(prisma.accLedgerBankAccount.create.mock.calls[0][0].data.lbaCompanyId).toBe(
          COMPANY_ID,
        );
        expect(prisma.company.findFirst).toHaveBeenCalledWith({
          where: { compId: COMPANY_ID, compIsDeleted: false },
          select: { compId: true },
        });
      });

      it('fills a null company from the ledger', async () => {
        await service.save(saveDto({ lbaCompanyId: null }));

        expect(prisma.accLedgerBankAccount.create.mock.calls[0][0].data.lbaCompanyId).toBe(
          COMPANY_ID,
        );
      });

      it('refuses a company other than the ledger company', async () => {
        const promise = service.save(saveDto({ lbaCompanyId: OTHER_COMPANY_ID }));

        await expect(bodyOf(promise)).resolves.toEqual({
          success: false,
          message: 'Ledger company mismatch',
          errors: [
            {
              field: 'lbaCompanyId',
              message: `lbaCompanyId ${OTHER_COMPANY_ID} must match ledger company id ${COMPANY_ID}`,
              code: LedgerBankErrorCode.COMPANY_MISMATCH,
            },
          ],
        });
        expect(prisma.accLedgerBankAccount.create).not.toHaveBeenCalled();
      });

      it('takes any live company for a ledger that has none', async () => {
        prisma.accLedgerMaster.findFirst.mockResolvedValueOnce({
          ledId: LEDGER_ID,
          ledCompanyId: null,
        });

        await service.save(saveDto({ lbaCompanyId: OTHER_COMPANY_ID }));

        expect(prisma.accLedgerBankAccount.create.mock.calls[0][0].data.lbaCompanyId).toBe(
          OTHER_COMPANY_ID,
        );
      });

      it('stores no company when neither the body nor the ledger names one', async () => {
        prisma.accLedgerMaster.findFirst.mockResolvedValueOnce({
          ledId: LEDGER_ID,
          ledCompanyId: null,
        });

        await service.save(saveDto({ lbaCompanyId: null }));

        expect(prisma.accLedgerBankAccount.create.mock.calls[0][0].data.lbaCompanyId).toBeNull();
        expect(prisma.company.findFirst).not.toHaveBeenCalled();
      });

      it('refuses a company with no live row', async () => {
        prisma.company.findFirst.mockResolvedValueOnce(null);

        await expect(bodyOf(service.save(saveDto()))).resolves.toEqual({
          success: false,
          message: 'Company does not exist',
          errors: [
            {
              field: 'lbaCompanyId',
              message: `No active company found with id ${COMPANY_ID}`,
              code: LedgerBankErrorCode.COMPANY_NOT_FOUND,
            },
          ],
        });
      });
    });

    it('checks the account number against the ledger live accounts in any case', async () => {
      await service.save(saveDto({ lbaAccountNo: 'ab123' }));

      expect(prisma.accLedgerBankAccount.findFirst).toHaveBeenCalledWith({
        where: {
          lbaIsDeleted: false,
          lbaLedgerId: LEDGER_ID,
          lbaAccountNo: { equals: 'ab123', mode: 'insensitive' },
        },
        select: { lbaId: true },
      });
    });

    it('refuses an account number the ledger already holds', async () => {
      prisma.accLedgerBankAccount.findFirst.mockResolvedValueOnce({ lbaId: OTHER_LBA_ID });

      const promise = service.save(saveDto());

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Ledger bank account already exists for this ledger',
        errors: [
          {
            field: 'lbaAccountNo',
            message: 'Duplicate lbaAccountNo is not allowed for this ledger',
            code: LedgerBankErrorCode.DUPLICATE_ACCOUNT_NO,
          },
        ],
      });
      expect(prisma.accLedgerBankAccount.create).not.toHaveBeenCalled();
    });

    // One default per ledger: a new default takes the flag from the rest.
    it('clears the ledger other defaults before saving a new default', async () => {
      await service.save(saveDto({ lbaIsDefault: true }));

      expect(prisma.accLedgerBankAccount.updateMany).toHaveBeenCalledWith({
        where: { lbaLedgerId: LEDGER_ID, lbaIsDeleted: false, lbaIsDefault: true },
        data: {
          lbaIsDefault: false,
          lbaModifiedOn: expect.any(Date) as Date,
          lbaModifiedBy: USER_ID,
        },
      });
      expect(prisma.accLedgerBankAccount.create.mock.calls[0][0].data.lbaIsDefault).toBe(true);
      expect(prisma.accLedgerBankAccount.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.accLedgerBankAccount.create.mock.invocationCallOrder[0],
      );
    });

    it.each([[false], [undefined]])(
      'leaves the other defaults alone when lbaIsDefault is %p',
      async (lbaIsDefault) => {
        await service.save(saveDto({ lbaIsDefault }));

        expect(prisma.accLedgerBankAccount.updateMany).not.toHaveBeenCalled();
      },
    );

    it.each(['lbaAccountHolder', 'lbaBankName', 'lbaAccountNo'] as const)(
      'refuses a blank %s with LEDGER_BANK_FIELD_EMPTY',
      async (field) => {
        const promise = service.save(saveDto({ [field]: '   ' }));

        await expect(promise).rejects.toBeInstanceOf(BadRequestException);
        await expect(bodyOf(promise)).resolves.toEqual({
          success: false,
          message: 'Validation failed',
          errors: [
            { field, message: `${field} must not be empty`, code: LedgerBankErrorCode.FIELD_EMPTY },
          ],
        });
        expect(prisma.accLedgerMaster.findFirst).not.toHaveBeenCalled();
      },
    );

    it('stamps the default actor when the request carries no user', async () => {
      userId = undefined;

      await service.save(saveDto());

      expect(prisma.accLedgerBankAccount.create.mock.calls[0][0].data.lbaCreatedBy).toBe(
        DEFAULT_ACTOR,
      );
    });

    it('files a New audit row named by the account holder', async () => {
      const payload = await service.save(saveDto());

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toEqual({
        action: 'New',
        tableName: 'acc ledger bank accounts',
        screenName: 'Ledger Bank Account',
        screenType: 'master',
        pk: LBA_ID,
        displayName: 'Acme Industries Pvt Ltd',
        originalRecord: null,
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Ledger bank account created',
      });
      expect(client).toBe(prisma);
    });

    it('answers a unique violation as the duplicate account number', async () => {
      prisma.accLedgerBankAccount.create.mockRejectedValueOnce(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      await expect(bodyOf(service.save(saveDto()))).resolves.toEqual({
        success: false,
        message: 'Ledger bank account already exists',
        errors: [
          {
            field: 'lbaAccountNo',
            message: 'Duplicate lbaAccountNo is not allowed',
            code: LedgerBankErrorCode.DUPLICATE_ACCOUNT_NO,
          },
        ],
      });
    });

    it('answers a foreign-key violation as LEDGER_BANK_INVALID_REFERENCE', async () => {
      prisma.accLedgerBankAccount.create.mockRejectedValueOnce(
        Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' }),
      );

      const promise = service.save(saveDto());

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Invalid reference value provided',
        errors: [
          {
            field: 'lbaLedgerId',
            message: 'Referenced ledger or company does not exist',
            code: LedgerBankErrorCode.INVALID_REFERENCE,
          },
        ],
      });
    });

    it('lets any other failure through unchanged', async () => {
      const failure = new Error('connection reset');
      prisma.accLedgerBankAccount.create.mockRejectedValueOnce(failure);

      await expect(service.save(saveDto())).rejects.toBe(failure);
    });
  });

  describe('save — update (lbaId sent)', () => {
    beforeEach(() => {
      // The live row by id; the number probe (lbaId: { not }) finds nobody.
      prisma.accLedgerBankAccount.findFirst.mockImplementation(({ where }: FindArgs) =>
        Promise.resolve(where.lbaId === LBA_ID ? makeAccount() : null),
      );
    });

    it('updates the live row and stamps the modifier', async () => {
      const payload = await service.save(
        saveDto({ lbaId: LBA_ID, lbaCompanyId: COMPANY_ID, lbaBranchName: 'Indiranagar' }),
      );

      expect(prisma.accLedgerBankAccount.findFirst.mock.calls[0][0]).toEqual({
        where: { lbaId: LBA_ID, lbaIsDeleted: false },
      });
      const { where, data } = prisma.accLedgerBankAccount.update.mock.calls[0][0];
      expect(where).toEqual({ lbaId: LBA_ID });
      expect(data).toEqual({
        lbaCompanyId: COMPANY_ID,
        lbaLedgerId: LEDGER_ID,
        lbaAccountHolder: 'Acme Industries Pvt Ltd',
        lbaBankName: 'HDFC Bank',
        lbaAccountNo: '50100123456789',
        lbaBranchName: 'Indiranagar',
        lbaModifiedOn: expect.any(Date) as Date,
        lbaModifiedBy: USER_ID,
      });
      expect(payload).toMatchObject({ lbaId: LBA_ID, lbaBranchName: 'Indiranagar' });
      expect(prisma.accLedgerBankAccount.create).not.toHaveBeenCalled();
    });

    it('skips its own row when checking the account number', async () => {
      await service.save(saveDto({ lbaId: LBA_ID, lbaCompanyId: COMPANY_ID }));

      expect(prisma.accLedgerBankAccount.findFirst.mock.calls[1][0]).toEqual({
        where: {
          lbaIsDeleted: false,
          lbaLedgerId: LEDGER_ID,
          lbaAccountNo: { equals: '50100123456789', mode: 'insensitive' },
          lbaId: { not: LBA_ID },
        },
        select: { lbaId: true },
      });
    });

    it('clears the other defaults of the ledger, never its own row', async () => {
      await service.save(saveDto({ lbaId: LBA_ID, lbaCompanyId: COMPANY_ID, lbaIsDefault: true }));

      expect(prisma.accLedgerBankAccount.updateMany.mock.calls[0][0].where).toEqual({
        lbaLedgerId: LEDGER_ID,
        lbaIsDeleted: false,
        lbaIsDefault: true,
        lbaId: { not: LBA_ID },
      });
    });

    // dto-own-undefined trap: through the house ValidationPipe lbaCompanyId is an own
    // property even when left out; the stored company must survive such an update.
    it('keeps the stored company when a piped update leaves it out and the ledger has none', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValueOnce({
        ledId: LEDGER_ID,
        ledCompanyId: null,
      });
      const dto = (await createHouseValidationPipe().transform(
        {
          lbaId: LBA_ID,
          lbaLedgerId: LEDGER_ID,
          lbaAccountHolder: 'Acme Industries Pvt Ltd',
          lbaBankName: 'HDFC Bank',
          lbaAccountNo: '50100123456789',
        },
        { type: 'body', metatype: SaveLedgerBankAccountDto },
      )) as SaveLedgerBankAccountDto;
      expect(Object.prototype.hasOwnProperty.call(dto, 'lbaCompanyId')).toBe(true);

      await service.save(dto);

      expect(prisma.accLedgerBankAccount.update.mock.calls[0][0].data.lbaCompanyId).toBe(COMPANY_ID);
    });

    it('refuses a company other than the ledger company', async () => {
      await expect(
        bodyOf(service.save(saveDto({ lbaId: LBA_ID, lbaCompanyId: OTHER_COMPANY_ID }))),
      ).resolves.toMatchObject({ errors: [{ code: LedgerBankErrorCode.COMPANY_MISMATCH }] });
      expect(prisma.accLedgerBankAccount.update).not.toHaveBeenCalled();
    });

    it('files an update audit row holding the row before and after', async () => {
      const payload = await service.save(
        saveDto({ lbaId: LBA_ID, lbaCompanyId: COMPANY_ID, lbaAccountHolder: 'Acme Ltd' }),
      );

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'update',
        pk: LBA_ID,
        displayName: 'Acme Ltd',
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Ledger bank account updated',
      });
      expect(entry.originalRecord).toMatchObject({ lbaAccountHolder: 'Acme Industries Pvt Ltd' });
      expect(client).toBe(prisma);
    });

    it('refuses an id with no live account', async () => {
      prisma.accLedgerBankAccount.findFirst.mockReset();
      prisma.accLedgerBankAccount.findFirst.mockResolvedValue(null);

      const promise = service.save(saveDto({ lbaId: LBA_ID }));

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Ledger bank account not found',
        errors: [
          {
            field: 'lbaId',
            message: `No active ledger bank account found with id ${LBA_ID}`,
            code: LedgerBankErrorCode.NOT_FOUND,
          },
        ],
      });
      expect(prisma.accLedgerMaster.findFirst).not.toHaveBeenCalled();
    });

    it('refuses an account number another of the ledger accounts holds', async () => {
      prisma.accLedgerBankAccount.findFirst.mockImplementation(({ where }: FindArgs) =>
        Promise.resolve(where.lbaId === LBA_ID ? makeAccount() : { lbaId: OTHER_LBA_ID }),
      );

      await expect(
        bodyOf(service.save(saveDto({ lbaId: LBA_ID, lbaCompanyId: COMPANY_ID }))),
      ).resolves.toMatchObject({ errors: [{ code: LedgerBankErrorCode.DUPLICATE_ACCOUNT_NO }] });
      expect(prisma.accLedgerBankAccount.update).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('reads a live account only', async () => {
      prisma.accLedgerBankAccount.findFirst.mockResolvedValueOnce(
        makeAccount({ lbaSyncDate: new Date('2026-10-03T09:00:00.000Z') }),
      );

      await expect(service.getById(LBA_ID)).resolves.toMatchObject({
        lbaId: LBA_ID,
        lbaLedgerId: LEDGER_ID,
        lbaSyncDate: '2026-10-03T09:00:00.000Z',
        lbaCreatedOn: CREATED_ON.toISOString(),
      });
      expect(prisma.accLedgerBankAccount.findFirst).toHaveBeenCalledWith({
        where: { lbaId: LBA_ID, lbaIsDeleted: false },
      });
    });

    it('refuses an id with no live account', async () => {
      await expect(bodyOf(service.getById(LBA_ID))).resolves.toMatchObject({
        errors: [{ field: 'lbaId', code: LedgerBankErrorCode.NOT_FOUND }],
      });
    });
  });

  describe('softDelete', () => {
    beforeEach(() => {
      prisma.accLedgerBankAccount.findFirst.mockResolvedValue(makeAccount());
    });

    it('marks the live account deleted and inactive and files a cancel audit row', async () => {
      await expect(service.softDelete(LBA_ID)).resolves.toEqual({ lbaId: LBA_ID, deleted: true });

      const [{ where, data }] = prisma.accLedgerBankAccount.updateMany.mock.calls[0];
      expect(where).toEqual({ lbaId: LBA_ID, lbaIsDeleted: false });
      expect(data).toEqual({
        lbaIsDeleted: true,
        lbaIsActive: false,
        lbaModifiedOn: expect.any(Date) as Date,
        lbaModifiedBy: USER_ID,
      });
      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'cancel',
        pk: LBA_ID,
        displayName: 'Acme Industries Pvt Ltd',
        notes: 'Ledger bank account soft deleted',
      });
      expect(entry.originalRecord).toMatchObject({ lbaIsDeleted: false, lbaIsActive: true });
      expect(entry.modifiedRecord).toMatchObject({ lbaIsDeleted: true, lbaIsActive: false });
      expect(client).toBe(prisma);
    });

    it('refuses an id with no live account and writes nothing', async () => {
      prisma.accLedgerBankAccount.findFirst.mockResolvedValue(null);

      await expect(service.softDelete(LBA_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.accLedgerBankAccount.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the write finds the row already gone, without an audit row', async () => {
      prisma.accLedgerBankAccount.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.softDelete(LBA_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });
  });
});
