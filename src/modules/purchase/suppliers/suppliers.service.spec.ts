import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { AccLedgerMaster, Prisma, Supplier } from '@prisma/client';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AccountLedgerMastersService } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { SaveSupplierDto } from './dto/save-supplier.dto';
import { SuppliersService } from './suppliers.service';
import { SupplierErrorCode } from './types/supplier-error-codes';

const SUP_ID = '019c6f6c-be87-7a11-8905-36092c46f501';
const OTHER_SUP_ID = '019c6f6c-be87-7a11-8905-36092c46f502';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46f503';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46f504';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46f505';
const LINK_LED_ID = '019c6f6c-be87-7a11-8905-36092c46f506';
const AREA_GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46f507';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46f5ff';
const SUPPLIER_LEDGER_GROUP_ID = '019f081c-98cc-757a-9346-4cfba810c47f';
const CREATED_ON = new Date('2026-10-01T09:00:00.000Z');
const MODIFIED_ON = new Date('2026-10-02T09:00:00.000Z');
const BANK_ACCOUNT = { lbaId: '019c6f6c-be87-7a11-8905-36092c46f5b1', lbaAccountNo: '123' };

const makeSupplier = (overrides: Partial<Supplier> = {}): Supplier => ({
  supId: SUP_ID,
  supCompanyId: COMPANY_ID,
  supBranchId: null,
  supGroupId: GROUP_ID,
  supPurchaseType: 'LOCAL',
  supName: 'Sri Ganesh Mills',
  supShort: null,
  supAddr1: null,
  supAddr2: null,
  supAddr3: null,
  supCity: 'Tiruppur',
  supDistrict: null,
  supStateName: 'Tamil Nadu',
  supCountry: null,
  supPincode: null,
  supTel: null,
  supPhone: null,
  supMailId: null,
  supWhatsappNo: null,
  supWebsiteAddress: null,
  supChequePreName: null,
  supNotes: null,
  supCreditDays: 30,
  supCashDiscPerc: new Prisma.Decimal('1.50'),
  supCollectionDays: [5, 20],
  supGstNo: null,
  supStateCode: '33',
  supPanNo: null,
  supGstType: 'REGULAR',
  supSupCst: null,
  supDrugLiscenceNo: null,
  supRegionName: null,
  supRegionAddr1: null,
  supRegionAddr2: null,
  supRegionAddr3: null,
  supRegionCity: null,
  supRegionDistrict: null,
  supRegionStateName: null,
  supRegionCountry: null,
  supBilledDate: MODIFIED_ON,
  supSortOrder: null,
  supIsActive: true,
  supIsDeleted: false,
  supSyncDate: null,
  supCreatedOn: CREATED_ON,
  supCreatedBy: USER_ID,
  supModifiedOn: MODIFIED_ON,
  supModifiedBy: USER_ID,
  ...overrides,
});

const linkLedger = (overrides: Record<string, unknown> = {}): AccLedgerMaster =>
  ({
    ledId: LINK_LED_ID,
    ledName: 'Lakshmi Traders',
    ledLedgerType: 'PARTY',
    ledGroupId: AREA_GROUP_ID,
    ledStateName: 'Karnataka',
    ledStateCode: '29',
    ledCompanyId: COMPANY_ID,
    ledBranchId: null,
    ledShort: null,
    ledEmail: 'accounts@lakshmi.in',
    ledTel: null,
    ledPhone1: '9876543210',
    ledWhatsappNo: null,
    ledAddr1: '4 Market St',
    ledAddr2: null,
    ledAddr3: null,
    ledCity: 'Mysuru',
    ledDistrict: null,
    ledPin: '570001',
    ledCountry: null,
    ledRegionName: null,
    ledRegionAddr1: null,
    ledRegionAddr2: null,
    ledRegionAddr3: null,
    ledRegionCity: null,
    ledRegionDistrict: null,
    ledRegionStateName: null,
    ledRegionCountry: null,
    ledGstinNo: '29ABCDE1234F1Z5',
    ledPanNo: 'ABCDE1234F',
    ledRemarks: 'customer since 2024',
    ledIsActive: false,
    ...overrides,
  }) as unknown as AccLedgerMaster;

const createDto = (overrides: Partial<SaveSupplierDto> = {}): SaveSupplierDto => ({
  supGroupId: GROUP_ID,
  supPurchaseType: 'LOCAL',
  supName: 'Sri Ganesh Mills',
  supStateName: 'Tamil Nadu',
  supStateCode: '33',
  supGstType: 'REGULAR',
  ...overrides,
});

type Args = { where: Record<string, unknown>; data?: Record<string, unknown>; select?: unknown };
type AuditEntry = Record<string, unknown>;

type PrismaMock = {
  supplier: {
    findFirst: jest.Mock<Promise<Supplier | { supId: string } | null>, [Args]>;
    findUnique: jest.Mock<Promise<Supplier | null>, [Args]>;
    create: jest.Mock<Promise<Supplier>, [Args]>;
    update: jest.Mock<Promise<Supplier>, [Args]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Args]>;
  };
  supplierGroup: {
    findFirst: jest.Mock<Promise<{ spgId?: string; spgName?: string } | null>, [Args]>;
  };
  customer: { findFirst: jest.Mock<Promise<{ cusIsActive: boolean } | null>, [Args]> };
  accLedgerMaster: {
    findFirst: jest.Mock<Promise<unknown>, [Args]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, [Args]>;
  };
  company: { findFirst: jest.Mock<Promise<{ compName: string } | null>, [Args]> };
  branchMaster: { findFirst: jest.Mock<Promise<{ brName: string } | null>, [Args]> };
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

describe('SuppliersService', () => {
  let service: SuppliersService;
  let prisma: PrismaMock;
  let ledgers: {
    createLedgerWithinTx: jest.Mock;
    updateLedgerWithinTx: jest.Mock;
    listBankAccountPayloads: jest.Mock;
  };
  let auditLogService: { logEntityChange: jest.Mock<Promise<void>, [AuditEntry, unknown]> };
  let userId: string | undefined;

  beforeEach(() => {
    userId = USER_ID;
    prisma = {
      supplier: {
        // Default: no live supplier by id, and no name clash.
        findFirst: jest.fn<Promise<Supplier | { supId: string } | null>, [Args]>(() =>
          Promise.resolve(null),
        ),
        findUnique: jest.fn<Promise<Supplier | null>, [Args]>(() => Promise.resolve(null)),
        create: jest.fn<Promise<Supplier>, [Args]>(({ data }) =>
          Promise.resolve(makeSupplier({ ...(data as Partial<Supplier>) })),
        ),
        update: jest.fn<Promise<Supplier>, [Args]>(({ where, data }) =>
          Promise.resolve(
            makeSupplier({
              ...Object.fromEntries(Object.entries(data!).filter(([, v]) => v !== undefined)),
              supId: where.supId as string,
            }),
          ),
        ),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [Args]>(() =>
          Promise.resolve({ count: 1 }),
        ),
      },
      supplierGroup: {
        findFirst: jest.fn<Promise<{ spgId?: string; spgName?: string } | null>, [Args]>(() =>
          Promise.resolve({ spgId: GROUP_ID, spgName: 'Fabric Mills' }),
        ),
      },
      customer: {
        findFirst: jest.fn<Promise<{ cusIsActive: boolean } | null>, [Args]>(() =>
          Promise.resolve(null),
        ),
      },
      accLedgerMaster: {
        findFirst: jest.fn<Promise<unknown>, [Args]>(() =>
          Promise.resolve({ ledId: SUP_ID, ledGroupId: SUPPLIER_LEDGER_GROUP_ID }),
        ),
        updateMany: jest.fn<Promise<Prisma.BatchPayload>, [Args]>(() =>
          Promise.resolve({ count: 1 }),
        ),
      },
      company: {
        findFirst: jest.fn<Promise<{ compName: string } | null>, [Args]>(() =>
          Promise.resolve({ compName: 'Acme Textiles' }),
        ),
      },
      branchMaster: {
        findFirst: jest.fn<Promise<{ brName: string } | null>, [Args]>(() =>
          Promise.resolve({ brName: 'Head Office' }),
        ),
      },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    ledgers = {
      createLedgerWithinTx: jest
        .fn()
        .mockResolvedValue({ ledId: SUP_ID, ledgerBankAccount: [BANK_ACCOUNT] }),
      updateLedgerWithinTx: jest
        .fn()
        .mockResolvedValue({ ledId: SUP_ID, ledgerBankAccount: [BANK_ACCOUNT] }),
      listBankAccountPayloads: jest.fn().mockResolvedValue([BANK_ACCOUNT]),
    };
    auditLogService = {
      logEntityChange: jest.fn<Promise<void>, [AuditEntry, unknown]>(() => Promise.resolve()),
    };
    service = new SuppliersService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => userId } as unknown as RequestContextService,
      ledgers as unknown as AccountLedgerMastersService,
    );
  });

  describe('save — create (no supId)', () => {
    it('provisions the linked ledger first and takes its id as the supplier id', async () => {
      const payload = await service.save(createDto({ supName: '  Sri Ganesh Mills ' }));

      expect(ledgers.createLedgerWithinTx).toHaveBeenCalledWith(
        {
          ledGroupId: SUPPLIER_LEDGER_GROUP_ID,
          ledName: 'Sri Ganesh Mills',
          ledStateName: 'Tamil Nadu',
          ledStateCode: '33',
          ledIsBillByBill: true,
        },
        prisma,
      );
      expect(prisma.supplier.create.mock.calls[0][0].data).toEqual({
        supId: SUP_ID,
        supGroupId: GROUP_ID,
        supPurchaseType: 'LOCAL',
        supName: 'Sri Ganesh Mills',
        supStateName: 'Tamil Nadu',
        supStateCode: '33',
        supGstType: 'REGULAR',
        supBilledDate: expect.any(Date) as Date,
        supCreatedOn: expect.any(Date) as Date,
        supCreatedBy: USER_ID,
      });
      expect(payload).toMatchObject({
        supId: SUP_ID,
        supCashDiscPerc: 1.5,
        supCollectionDays: [5, 20],
        ledgerBankAccount: [BANK_ACCOUNT],
      });
    });

    it('copies the shared supplier fields onto the ledger under their ledger names', async () => {
      await service.save(
        createDto({
          supCompanyId: COMPANY_ID,
          supBranchId: BRANCH_ID,
          supMailId: 'sales@ganesh.in',
          supPhone: '9000000001',
          supPincode: '641601',
          supGstNo: '33ABCDE1234F1Z5',
          supNotes: 'net 30',
          supIsActive: false,
          ledgerBankAccount: [],
        }),
      );

      expect(ledgers.createLedgerWithinTx.mock.calls[0][0]).toMatchObject({
        ledCompanyId: COMPANY_ID,
        ledBranchId: BRANCH_ID,
        ledEmail: 'sales@ganesh.in',
        ledPhone1: '9000000001',
        ledPin: '641601',
        ledGstinNo: '33ABCDE1234F1Z5',
        ledRemarks: 'net 30',
        ledIsActive: false,
        ledgerBankAccount: [],
      });
    });

    it('upper-cases the state code and refuses one that is not 2 characters', async () => {
      await service.save(createDto({ supStateCode: ' tn ' }));
      expect(prisma.supplier.create.mock.calls[0][0].data!.supStateCode).toBe('TN');

      await expect(bodyOf(service.save(createDto({ supStateCode: 'TAM' })))).resolves.toEqual({
        success: false,
        message: 'Validation failed',
        errors: [
          {
            field: 'supStateCode',
            message: 'supStateCode must be exactly 2 characters',
            code: SupplierErrorCode.STATE_CODE_INVALID,
          },
        ],
      });
    });

    it.each([
      ['supName', SupplierErrorCode.NAME_REQUIRED],
      ['supPurchaseType', SupplierErrorCode.PURCHASE_TYPE_REQUIRED],
      ['supStateName', SupplierErrorCode.STATE_NAME_REQUIRED],
      ['supGstType', SupplierErrorCode.GST_TYPE_REQUIRED],
    ] as const)('refuses a blank %s with its own code', async (field, code) => {
      const promise = service.save(createDto({ [field]: '   ' }));

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(bodyOf(promise)).resolves.toMatchObject({ errors: [{ field, code }] });
      expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
    });

    it('refuses a supplier group with no live row', async () => {
      prisma.supplierGroup.findFirst.mockResolvedValueOnce(null);

      await expect(bodyOf(service.save(createDto()))).resolves.toEqual({
        success: false,
        message: 'Supplier group does not exist',
        errors: [
          {
            field: 'supGroupId',
            message: `No active supplier group found with id ${GROUP_ID}`,
            code: SupplierErrorCode.UNKNOWN_GROUP,
          },
        ],
      });
      expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
    });

    it('checks the name among the company live suppliers in any case', async () => {
      await service.save(createDto({ supCompanyId: COMPANY_ID, supName: 'sri ganesh mills' }));

      expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
        where: {
          supIsDeleted: false,
          supCompanyId: COMPANY_ID,
          supName: { equals: 'sri ganesh mills', mode: 'insensitive' },
        },
        select: { supId: true },
      });
    });

    it('refuses a name another live supplier of the company holds', async () => {
      prisma.supplier.findFirst.mockResolvedValueOnce({ supId: OTHER_SUP_ID });

      const promise = service.save(createDto());

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Supplier name already exists for this company',
        errors: [
          {
            field: 'supName',
            message: 'Duplicate supplier name is not allowed for this company',
            code: SupplierErrorCode.NAME_EXISTS,
          },
        ],
      });
      expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
    });

    it('answers a unique violation as the name clash', async () => {
      prisma.supplier.create.mockRejectedValueOnce(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      await expect(bodyOf(service.save(createDto()))).resolves.toMatchObject({
        message: 'Supplier already exists',
        errors: [{ field: 'supName', code: SupplierErrorCode.NAME_EXISTS }],
      });
    });

    it('stores a null collection-days list as empty', async () => {
      await service.save(createDto({ supCollectionDays: null as unknown as number[] }));

      expect(prisma.supplier.create.mock.calls[0][0].data!.supCollectionDays).toEqual([]);
    });

    it.each([
      ['the body actor over the request user', { supCreatedBy: 'importer' }, USER_ID, 'importer'],
      ['the default actor when there is neither', {}, undefined, DEFAULT_ACTOR],
    ])('stamps %s', async (_label, extra, contextUser, expected) => {
      userId = contextUser;

      await service.save(createDto(extra));

      expect(prisma.supplier.create.mock.calls[0][0].data!.supCreatedBy).toBe(expected);
      expect(auditLogService.logEntityChange.mock.calls[0][0].userId).toBe(expected);
    });

    it('files a New audit row inside the same transaction', async () => {
      const payload = await service.save(createDto());

      const [entry, client] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toEqual({
        action: 'New',
        tableName: 'suppliers',
        screenName: 'Supplier Master',
        screenType: 'master',
        pk: SUP_ID,
        displayName: 'Sri Ganesh Mills',
        originalRecord: null,
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Supplier created',
      });
      expect(client).toBe(prisma);
    });
  });

  // Notes 81 — a party we sell to and buy from keeps one ledger and one balance.
  describe('save — create on an existing ledger (supLinkLedId)', () => {
    beforeEach(() => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue(linkLedger());
    });

    it('joins the ledger without writing it, taking the ledger id', async () => {
      await service.save(createDto({ supLinkLedId: LINK_LED_ID }));

      expect(prisma.accLedgerMaster.findFirst).toHaveBeenCalledWith({
        where: { ledId: LINK_LED_ID, ledIsDeleted: false },
      });
      expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
      expect(ledgers.updateLedgerWithinTx).not.toHaveBeenCalled();
      expect(prisma.supplier.create.mock.calls[0][0].data).toMatchObject({ supId: LINK_LED_ID });
      expect(ledgers.listBankAccountPayloads).toHaveBeenCalledWith(LINK_LED_ID);
      expect(auditLogService.logEntityChange.mock.calls[0][0]).toMatchObject({
        action: 'New',
        notes: 'Supplier created on an existing ledger',
      });
    });

    it('fills the blank name, state, contact and tax fields from the ledger', async () => {
      await service.save(
        createDto({
          supLinkLedId: LINK_LED_ID,
          supName: undefined as unknown as string,
          supStateName: '',
          supStateCode: undefined as unknown as string,
          supCity: null,
        }),
      );

      expect(prisma.supplier.create.mock.calls[0][0].data).toMatchObject({
        supName: 'Lakshmi Traders',
        supStateName: 'Karnataka',
        supStateCode: '29',
        supCity: 'Mysuru',
        supMailId: 'accounts@lakshmi.in',
        supPhone: '9876543210',
        supPincode: '570001',
        supGstNo: '29ABCDE1234F1Z5',
        supPanNo: 'ABCDE1234F',
        supCompanyId: COMPANY_ID,
      });
    });

    it('keeps what the body sent over the ledger values', async () => {
      await service.save(createDto({ supLinkLedId: LINK_LED_ID, supCity: 'Tiruppur' }));

      expect(prisma.supplier.create.mock.calls[0][0].data).toMatchObject({
        supName: 'Sri Ganesh Mills',
        supCity: 'Tiruppur',
      });
    });

    // The active flag and the notes belong to the role, not the party.
    it('takes neither the active flag nor the notes from the ledger', async () => {
      await service.save(createDto({ supLinkLedId: LINK_LED_ID }));

      const { data } = prisma.supplier.create.mock.calls[0][0];
      expect(data).not.toHaveProperty('supIsActive');
      expect(data).not.toHaveProperty('supNotes');
    });

    it('leaves out a ledger email too wide for the supplier column', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue(
        linkLedger({ ledEmail: `${'a'.repeat(115)}@x.com` }),
      );

      await service.save(createDto({ supLinkLedId: LINK_LED_ID }));

      expect(prisma.supplier.create.mock.calls[0][0].data).not.toHaveProperty('supMailId');
    });

    it('skips its own ledger when checking the name', async () => {
      await service.save(createDto({ supLinkLedId: LINK_LED_ID }));

      expect(prisma.supplier.findFirst.mock.calls[0][0].where).toMatchObject({
        supId: { not: LINK_LED_ID },
      });
    });

    it('refuses a ledger with no live row', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue(null);

      await expect(bodyOf(service.save(createDto({ supLinkLedId: LINK_LED_ID })))).resolves.toEqual(
        {
          success: false,
          message: 'Ledger does not exist',
          errors: [
            {
              field: 'supLinkLedId',
              message: `No active account ledger found with id ${LINK_LED_ID}`,
              code: SupplierErrorCode.LINK_LEDGER_NOT_FOUND,
            },
          ],
        },
      );
    });

    it('refuses a ledger that is not a party ledger', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue(linkLedger({ ledLedgerType: 'BANK' }));

      await expect(
        bodyOf(service.save(createDto({ supLinkLedId: LINK_LED_ID }))),
      ).resolves.toMatchObject({
        message: 'Ledger is not a party ledger',
        errors: [
          {
            field: 'supLinkLedId',
            message:
              'Ledger "Lakshmi Traders" is a BANK ledger; only a PARTY ledger can be a supplier',
            code: SupplierErrorCode.LINK_LEDGER_NOT_PARTY,
          },
        ],
      });
    });

    // June-2026 customers were provisioned before createLedgerWithinTx stamped PARTY.
    it('accepts an untyped ledger that a live customer already owns', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValue(linkLedger({ ledLedgerType: null }));
      prisma.customer.findFirst.mockResolvedValue({ cusIsActive: true });

      await service.save(createDto({ supLinkLedId: LINK_LED_ID }));

      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { cusId: LINK_LED_ID, cusIsDeleted: false },
        select: { cusIsActive: true },
      });
      expect(prisma.supplier.create).toHaveBeenCalledTimes(1);
    });

    it('refuses bank accounts sent with the link', async () => {
      await expect(
        bodyOf(
          service.save(
            createDto({
              supLinkLedId: LINK_LED_ID,
              ledgerBankAccount: [{ lbaAccountNo: '1' }] as SaveSupplierDto['ledgerBankAccount'],
            }),
          ),
        ),
      ).resolves.toMatchObject({
        errors: [{ field: 'ledgerBankAccount', code: SupplierErrorCode.BANK_WITH_LINK_LEDGER }],
      });
      expect(prisma.supplier.create).not.toHaveBeenCalled();
    });

    it('refuses a ledger that is already a live supplier', async () => {
      prisma.supplier.findUnique.mockResolvedValue(makeSupplier({ supId: LINK_LED_ID }));

      const promise = service.save(createDto({ supLinkLedId: LINK_LED_ID }));

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(bodyOf(promise)).resolves.toMatchObject({
        errors: [
          {
            field: 'supLinkLedId',
            message: 'Ledger "Lakshmi Traders" is already a supplier',
            code: SupplierErrorCode.LINK_LEDGER_ALREADY_SUPPLIER,
          },
        ],
      });
    });

    // sup_id is the PK: a deleted supplier row on the ledger is brought back, not duplicated.
    it('revives a deleted supplier row on the ledger, keeping its creation stamp', async () => {
      prisma.supplier.findUnique.mockResolvedValue(
        makeSupplier({ supId: LINK_LED_ID, supIsDeleted: true, supIsActive: false }),
      );

      await service.save(createDto({ supLinkLedId: LINK_LED_ID }));

      expect(prisma.supplier.create).not.toHaveBeenCalled();
      const { where, data } = prisma.supplier.update.mock.calls[0][0];
      expect(where).toEqual({ supId: LINK_LED_ID });
      expect(data).toMatchObject({
        supIsDeleted: false,
        supIsActive: true,
        supModifiedOn: expect.any(Date) as Date,
        supModifiedBy: USER_ID,
      });
      expect(data).not.toHaveProperty('supCreatedOn');
      expect(data).not.toHaveProperty('supCreatedBy');
      expect(auditLogService.logEntityChange.mock.calls[0][0]).toMatchObject({
        action: 'update',
        notes: 'Supplier restored on its existing ledger',
      });
    });
  });

  describe('save — update (supId sent)', () => {
    beforeEach(() => {
      prisma.supplier.findFirst.mockImplementation(({ where }) =>
        Promise.resolve(where.supId === SUP_ID ? makeSupplier() : null),
      );
    });

    it('updates the supplier and syncs its linked ledger by the same id', async () => {
      const payload = await service.save(
        createDto({ supId: SUP_ID, supName: 'Ganesh Mills', supMailId: 'a@b.in' }),
      );

      expect(prisma.supplier.update.mock.calls[0][0]).toMatchObject({
        where: { supId: SUP_ID },
        data: {
          supName: 'Ganesh Mills',
          supMailId: 'a@b.in',
          supModifiedBy: USER_ID,
          supModifiedOn: expect.any(Date) as Date,
        },
      });
      expect(ledgers.updateLedgerWithinTx).toHaveBeenCalledWith(
        expect.objectContaining({
          ledId: SUP_ID,
          ledGroupId: SUPPLIER_LEDGER_GROUP_ID,
          ledName: 'Ganesh Mills',
          ledEmail: 'a@b.in',
          ledIsBillByBill: true,
        }),
        prisma,
      );
      expect(payload).toMatchObject({ supName: 'Ganesh Mills', ledgerBankAccount: [BANK_ACCOUNT] });
    });

    it('accepts the supplier own id echoed as supLinkLedId', async () => {
      await service.save(createDto({ supId: SUP_ID, supLinkLedId: SUP_ID }));

      expect(prisma.supplier.update).toHaveBeenCalledTimes(1);
    });

    it('refuses a different supLinkLedId on an update', async () => {
      await expect(
        bodyOf(service.save(createDto({ supId: SUP_ID, supLinkLedId: LINK_LED_ID }))),
      ).resolves.toEqual({
        success: false,
        message: 'Validation failed',
        errors: [
          {
            field: 'supLinkLedId',
            message: 'supLinkLedId applies to a create only',
            code: SupplierErrorCode.LINK_LEDGER_ON_UPDATE,
          },
        ],
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('leaves a legacy supplier with no linked ledger unsynced', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValueOnce(null);

      const payload = await service.save(createDto({ supId: SUP_ID }));

      expect(ledgers.updateLedgerWithinTx).not.toHaveBeenCalled();
      expect(payload.ledgerBankAccount).toEqual([]);
    });

    // A shared ledger is one party with one group: a supplier edit must not move it.
    it('keeps a shared ledger in its group and active while either role is', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValueOnce({
        ledId: SUP_ID,
        ledGroupId: AREA_GROUP_ID,
      });
      prisma.customer.findFirst.mockResolvedValue({ cusIsActive: true });

      await service.save(createDto({ supId: SUP_ID, supIsActive: false }));

      expect(ledgers.updateLedgerWithinTx.mock.calls[0][0]).toMatchObject({
        ledGroupId: AREA_GROUP_ID,
        ledIsActive: true,
      });
    });

    it('checks the name in the supplier stored company when the body does not name one', async () => {
      await service.save(createDto({ supId: SUP_ID }));

      expect(prisma.supplier.findFirst.mock.calls[1][0].where).toEqual({
        supIsDeleted: false,
        supCompanyId: COMPANY_ID,
        supName: { equals: 'Sri Ganesh Mills', mode: 'insensitive' },
        supId: { not: SUP_ID },
      });
    });

    it('files an update audit row holding the row before and after', async () => {
      const payload = await service.save(createDto({ supId: SUP_ID, supName: 'Ganesh Mills' }));

      const [entry] = auditLogService.logEntityChange.mock.calls[0];
      expect(entry).toMatchObject({
        action: 'update',
        pk: SUP_ID,
        displayName: 'Ganesh Mills',
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'Supplier updated',
      });
      expect(entry.originalRecord).toMatchObject({ supName: 'Sri Ganesh Mills' });
    });

    it('refuses an id with no live supplier', async () => {
      const promise = service.save(createDto({ supId: OTHER_SUP_ID }));

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(bodyOf(promise)).resolves.toEqual({
        success: false,
        message: 'Supplier not found',
        errors: [
          {
            field: 'supId',
            message: `No active supplier found with id ${OTHER_SUP_ID}`,
            code: SupplierErrorCode.NOT_FOUND,
          },
        ],
      });
    });
  });

  describe('getById', () => {
    it('returns the supplier with its company, branch and group names and bank accounts', async () => {
      prisma.supplier.findFirst.mockResolvedValueOnce(makeSupplier({ supBranchId: BRANCH_ID }));

      await expect(service.getById(SUP_ID)).resolves.toMatchObject({
        supId: SUP_ID,
        supCompanyName: 'Acme Textiles',
        supBranchName: 'Head Office',
        supGroupName: 'Fabric Mills',
        supCreatedOn: CREATED_ON.toISOString(),
        supBilledDate: MODIFIED_ON.toISOString(),
        ledgerBankAccount: [BANK_ACCOUNT],
      });
      expect(ledgers.listBankAccountPayloads).toHaveBeenCalledWith(SUP_ID);
    });

    it('names no company or branch when the supplier has none', async () => {
      prisma.supplier.findFirst.mockResolvedValueOnce(makeSupplier({ supCompanyId: null }));

      await expect(service.getById(SUP_ID)).resolves.toMatchObject({
        supCompanyName: null,
        supBranchName: null,
      });
      expect(prisma.company.findFirst).not.toHaveBeenCalled();
      expect(prisma.branchMaster.findFirst).not.toHaveBeenCalled();
    });

    it('refuses an id with no live supplier', async () => {
      await expect(bodyOf(service.getById(SUP_ID))).resolves.toMatchObject({
        errors: [{ field: 'supId', code: SupplierErrorCode.NOT_FOUND }],
      });
    });
  });

  describe('softDelete', () => {
    beforeEach(() => {
      prisma.supplier.findFirst.mockResolvedValue(makeSupplier());
    });

    it('deletes the supplier and its own ledger', async () => {
      await expect(service.softDelete(SUP_ID)).resolves.toEqual({ supId: SUP_ID, deleted: true });

      expect(prisma.supplier.updateMany.mock.calls[0][0]).toEqual({
        where: { supId: SUP_ID, supIsDeleted: false },
        data: {
          supIsDeleted: true,
          supIsActive: false,
          supModifiedOn: expect.any(Date) as Date,
          supModifiedBy: USER_ID,
        },
      });
      expect(prisma.accLedgerMaster.updateMany.mock.calls[0][0]).toEqual({
        where: { ledId: SUP_ID, ledIsDeleted: false },
        data: {
          ledIsDeleted: true,
          ledIsActive: false,
          ledModifiedOn: expect.any(Date) as Date,
          ledModifiedBy: USER_ID,
        },
      });
      expect(auditLogService.logEntityChange.mock.calls[0][0]).toMatchObject({
        action: 'cancel',
        notes: 'Supplier soft deleted',
      });
    });

    it('leaves a shared ledger live, with the customer active flag', async () => {
      prisma.customer.findFirst.mockResolvedValue({ cusIsActive: false });

      await service.softDelete(SUP_ID);

      expect(prisma.accLedgerMaster.updateMany.mock.calls[0][0].data).toEqual({
        ledIsActive: false,
        ledModifiedOn: expect.any(Date) as Date,
        ledModifiedBy: USER_ID,
      });
      expect(auditLogService.logEntityChange.mock.calls[0][0].notes).toBe(
        'Supplier soft deleted; its ledger stays with the customer',
      );
    });

    it('refuses an id with no live supplier and writes nothing', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(service.softDelete(SUP_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.supplier.updateMany).not.toHaveBeenCalled();
      expect(prisma.accLedgerMaster.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the write finds the row already gone, without touching the ledger', async () => {
      prisma.supplier.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.softDelete(SUP_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.accLedgerMaster.updateMany).not.toHaveBeenCalled();
      expect(auditLogService.logEntityChange).not.toHaveBeenCalled();
    });
  });
});
