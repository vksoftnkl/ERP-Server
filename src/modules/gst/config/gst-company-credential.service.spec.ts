import { HttpException } from '@nestjs/common';
import { GstCompanyCredential, Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { randomBytes } from 'node:crypto';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { SaveGstCompanyCredentialDto } from '../dto/save-gst-company-credential.dto';
import { GstCompanyCredentialService } from './gst-company-credential.service';
import { GST_CODES } from './gst-config.constants';
import { GstConfigSupport } from './gst-config.support';
import { GstCryptoService } from './gst-crypto.service';

const ENV_KEYS = ['GST_CRED_KEY', 'GST_CRED_KEY_VERSION', 'GST_CRED_KEY_V1'] as const;

const GCC_ID = '019c6f6c-be87-7a11-8905-36092c46e001';
const OTHER_GCC_ID = '019c6f6c-be87-7a11-8905-36092c46e002';
const NEW_GCC_ID = '019c6f6c-be87-7a11-8905-36092c46e003';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e004';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e005';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e006';
const GPV_ID = '019c6f6c-be87-7a11-8905-36092c46e007';
const OTHER_GPV_ID = '019c6f6c-be87-7a11-8905-36092c46e008';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e009';
const MENU_ID = 270;
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');
const COMPANY_GSTIN = '33AAAAA0000A1Z5';
const BRANCH_GSTIN = '33BBBBB1111B1Z5';

/** Plain texts no payload, audit row or note may ever carry. */
const STORED_PASSWORD = 'Stored-Pass 01';
const NEW_PASSWORD = 'S3cret-Pass ';
const CLIENT_ID = 'CID-7781';
const CLIENT_SECRET = 'CSEC-9921';
const APP_KEY = 'APPKEY-4410';

const ALL_RIGHTS = ['view', 'create', 'edit', 'delete', 'post'];
const RIGHT_NAMES = [
  'view',
  'create',
  'edit',
  'delete',
  'print',
  'export',
  'post',
  'cancel',
  'amend',
  'override',
  'retender',
];

type CredentialRow = GstCompanyCredential & {
  company: { compName: string; compGstinNo: string | null };
  branch: { brName: string; brGstinNo: string | null } | null;
  provider: { gpvCode: string; gpvName: string };
};

const BRANCH_CONTEXT = { brName: 'Madurai', brGstinNo: BRANCH_GSTIN };

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

/** What the ValidationPipe hands the service: a class instance, every declared field own. */
const dtoOf = (plain: Record<string, unknown>) =>
  plainToInstance(SaveGstCompanyCredentialDto, plain);

const createBody = (extra: Record<string, unknown> = {}) =>
  dtoOf({
    gccCompanyId: COMPANY_ID,
    gccGpvId: GPV_ID,
    gccService: 'einvoice',
    gccEnvironment: 'sandbox',
    gccLoginId: 'api_user',
    password: NEW_PASSWORD,
    gccValidFrom: '2026-04-01',
    ...extra,
  });

/** An update that re-sends what is stored and nothing else. */
const updateBody = (extra: Record<string, unknown> = {}) =>
  dtoOf({
    gccId: GCC_ID,
    gccCompanyId: COMPANY_ID,
    gccGpvId: GPV_ID,
    gccEnvironment: 'SANDBOX',
    gccLoginId: 'api_user',
    gccValidFrom: '2026-04-01',
    ...extra,
  });

/** Never a secret: no plain text and no stored ciphertext anywhere in it. */
const expectNoSecret = (value: unknown) => {
  const text = JSON.stringify(value);
  expect(text).not.toMatch(/gcm:v\d+:/);
  for (const secret of [STORED_PASSWORD, NEW_PASSWORD, CLIENT_ID, CLIENT_SECRET, APP_KEY]) {
    expect(text).not.toContain(secret);
  }
};

type PrismaMock = {
  menu: { findFirst: jest.Mock };
  company: { findUnique: jest.Mock };
  branchMaster: { findUnique: jest.Mock };
  gstProvider: { findUnique: jest.Mock };
  gstProviderAccount: { findFirst: jest.Mock };
  gstAuthSession: { updateMany: jest.Mock };
  gstCompanyCredential: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
};

describe('GstCompanyCredentialService', () => {
  const savedEnv: Record<string, string | undefined> = {};
  const keyHex = randomBytes(32).toString('hex');
  const crypto = new GstCryptoService();

  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let auth: { signIn: jest.Mock };
  let context: { getUserId: jest.Mock };
  let granted: Set<string>;
  let sessionRows: unknown[];
  let stored: CredentialRow | null;
  let service: GstCompanyCredentialService;

  const credentialRow = (overrides: Partial<CredentialRow> = {}): CredentialRow => ({
    gccId: GCC_ID,
    gccCompanyId: COMPANY_ID,
    gccBranchId: null,
    gccGpvId: GPV_ID,
    gccService: 'EINVOICE',
    gccEnvironment: 'SANDBOX',
    gccPriority: 1,
    gccLoginId: 'api_user',
    gccPasswordEnc: crypto.encrypt(STORED_PASSWORD),
    gccClientIdEnc: null,
    gccClientSecretEnc: null,
    gccAppKeyEnc: null,
    gccPublicKeyRef: null,
    gccKeyVersion: 1,
    gccWhitelistedIps: [],
    gccValidFrom: new Date('2026-04-01T00:00:00.000Z'),
    gccValidUpto: null,
    gccPasswordChangedOn: null,
    gccLastVerifiedOn: null,
    gccLastErrorMessage: null,
    gccRemarks: null,
    gccIsActive: true,
    gccIsDeleted: false,
    gccSyncDate: null,
    gccCreatedOn: CREATED_ON,
    gccCreatedBy: USER_ID,
    gccModifiedOn: null,
    gccModifiedBy: null,
    company: { compName: 'Zeta Traders', compGstinNo: COMPANY_GSTIN },
    branch: null,
    provider: { gpvCode: 'NIC', gpvName: 'NIC IRP' },
    ...overrides,
  });

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    process.env.GST_CRED_KEY = keyHex;

    granted = new Set(ALL_RIGHTS);
    sessionRows = [];
    stored = credentialRow();
    prisma = {
      menu: { findFirst: jest.fn().mockResolvedValue({ menuId: MENU_ID }) },
      company: {
        findUnique: jest.fn().mockResolvedValue({
          compIsDeleted: false,
          compGstinNo: COMPANY_GSTIN,
          compName: 'Zeta Traders',
        }),
      },
      branchMaster: {
        findUnique: jest.fn().mockResolvedValue({
          brCompId: COMPANY_ID,
          brIsDeleted: false,
          brGstinNo: BRANCH_GSTIN,
        }),
      },
      gstProvider: { findUnique: jest.fn().mockResolvedValue({ gpvIsDeleted: false }) },
      gstProviderAccount: { findFirst: jest.fn().mockResolvedValue(null) },
      gstAuthSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      gstCompanyCredential: {
        findUnique: jest.fn(async () => stored),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Partial<CredentialRow> }) =>
          credentialRow({
            ...data,
            gccId: NEW_GCC_ID,
            branch: data.gccBranchId ? BRANCH_CONTEXT : null,
          }),
        ),
        update: jest.fn(async ({ data }: { data: Partial<CredentialRow> }) => {
          const merged = { ...stored!, ...data };
          return { ...merged, branch: merged.gccBranchId ? BRANCH_CONTEXT : null };
        }),
      },
      $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('user_menus')) {
          return [Object.fromEntries(RIGHT_NAMES.map((r) => [`um_can_${r}`, granted.has(r)]))];
        }
        if (sql.includes('gst_auth_session')) {
          return sessionRows;
        }
        throw new Error(`unexpected raw query: ${sql}`);
      }),
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    auth = { signIn: jest.fn() };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    const support = new GstConfigSupport(
      prisma as unknown as PrismaService,
      context as never,
      audit as never,
      crypto,
    );
    service = new GstCompanyCredentialService(
      prisma as unknown as PrismaService,
      support,
      auth as never,
    );
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  const createdData = () =>
    (prisma.gstCompanyCredential.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const updatedData = () =>
    (prisma.gstCompanyCredential.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  // ── rights (notes 79 §2) ──────────────────────────────────────────────────
  describe('rights on the GST Credentials menu', () => {
    it.each([
      ['getById', 'view', () => service.getById(GCC_ID)],
      ['save without gccId', 'create', () => service.save(createBody())],
      ['save with gccId', 'edit', () => service.save(updateBody())],
      ['softDelete', 'delete', () => service.softDelete(GCC_ID)],
      ['restore', 'edit', () => service.restore(GCC_ID)],
      ['verify', 'post', () => service.verify(GCC_ID)],
      ['status', 'view', () => service.status(GCC_ID)],
    ])('%s needs %s, and reads nothing without it', async (_label, right, call) => {
      granted.delete(right);

      const refusal = await refusalOf(call());

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ field: 'userId', code: `GST_RIGHT_${right.toUpperCase()}` }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.gstCompanyCredential.findUnique).not.toHaveBeenCalled();
      expect(auth.signIn).not.toHaveBeenCalled();
    });

    it('finds the menu by its parent and name, never by id', async () => {
      await service.getById(GCC_ID);

      expect(prisma.menu.findFirst).toHaveBeenCalledWith({
        where: { menuParentId: 60, menuName: 'GST Credentials' },
        select: { menuId: true },
      });
      const [, userId, menuId] = prisma.$queryRaw.mock.calls[0] as unknown[];
      expect([userId, menuId]).toEqual([USER_ID, MENU_ID]);
    });

    it('refuses a call with nobody logged in, whatever the grants', async () => {
      context.getUserId.mockReturnValue(null);

      const refusal = await refusalOf(service.getById(GCC_ID));

      expect(refusal).toMatchObject({
        status: 403,
        body: { errors: [{ code: 'GST_RIGHT_VIEW' }] },
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('answers with has* flags and the resolved GSTIN, never a secret', async () => {
      stored = credentialRow({
        gccClientIdEnc: crypto.encrypt(CLIENT_ID),
        gccClientSecretEnc: crypto.encrypt(CLIENT_SECRET),
        gccValidUpto: new Date('2020-03-31T00:00:00.000Z'),
      });

      const payload = await service.getById(GCC_ID);

      expect(payload).toMatchObject({
        gccId: GCC_ID,
        compName: 'Zeta Traders',
        gstin: COMPANY_GSTIN,
        gpvCode: 'NIC',
        isPrimary: true,
        hasPassword: true,
        hasClientId: true,
        hasClientSecret: true,
        hasAppKey: false,
        keyVersion: 1,
        gccValidFrom: '2026-04-01',
        gccValidUpto: '2020-03-31',
        isExpired: true,
      });
      expectNoSecret(payload);
    });

    it("shows the branch's GSTIN over the company's", async () => {
      stored = credentialRow({ gccBranchId: BRANCH_ID, branch: BRANCH_CONTEXT });

      await expect(service.getById(GCC_ID)).resolves.toMatchObject({
        brName: 'Madurai',
        gstin: BRANCH_GSTIN,
      });
    });

    it('returns a deleted credential too, for Restore', async () => {
      stored = credentialRow({ gccIsDeleted: true });

      await expect(service.getById(GCC_ID)).resolves.toMatchObject({ gccIsDeleted: true });
    });

    it('answers 404 for an id that names no credential', async () => {
      stored = null;

      const refusal = await refusalOf(service.getById(GCC_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gccId', code: GST_CODES.NOT_FOUND }] },
      });
    });
  });

  // ── save: create ──────────────────────────────────────────────────────────
  describe('save — create (no gccId)', () => {
    it('writes the row with its defaults, encrypts the password and audits it as New', async () => {
      const payload = await service.save(createBody());

      const data = createdData();
      expect(data).toMatchObject({
        gccCompanyId: COMPANY_ID,
        gccBranchId: null,
        gccGpvId: GPV_ID,
        gccService: 'EINVOICE',
        gccEnvironment: 'SANDBOX',
        gccPriority: 1,
        gccLoginId: 'api_user',
        gccKeyVersion: 1,
        gccPublicKeyRef: null,
        gccWhitelistedIps: [],
        gccValidFrom: new Date('2026-04-01T00:00:00.000Z'),
        gccValidUpto: null,
        gccPasswordChangedOn: expect.any(Date),
        gccRemarks: null,
        gccIsActive: true,
        gccCreatedBy: USER_ID,
      });
      // Never trimmed: a password may well end in a space.
      expect(crypto.decrypt(data.gccPasswordEnc as string)).toBe(NEW_PASSWORD);
      expect(data).not.toHaveProperty('gccClientIdEnc');
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'gst company credential',
        screenName: 'GST Company Credential',
        pk: NEW_GCC_ID,
        displayName: 'Zeta Traders EINVOICE SANDBOX #1',
        originalRecord: null,
        modifiedRecord: payload,
        userId: USER_ID,
        notes: 'GST credential created; secrets written: password',
      });
      expect(payload).toMatchObject({ gccId: NEW_GCC_ID, hasPassword: true });
      expectNoSecret(payload);
      expectNoSecret(auditEntry());
      // A new credential has no session to retire.
      expect(prisma.gstAuthSession.updateMany).not.toHaveBeenCalled();
    });

    it.each([null, ''])('treats a gccId sent as %p as a create', async (gccId) => {
      granted.delete('edit');

      await service.save(createBody({ gccId }));

      expect(prisma.gstCompanyCredential.create).toHaveBeenCalled();
      expect(prisma.gstCompanyCredential.findUnique).not.toHaveBeenCalled();
    });

    it('checks the slot for a create without excluding any row', async () => {
      await service.save(createBody());

      expect(prisma.gstCompanyCredential.findFirst).toHaveBeenCalledWith({
        where: {
          gccCompanyId: COMPANY_ID,
          gccBranchId: null,
          gccService: 'EINVOICE',
          gccEnvironment: 'SANDBOX',
          gccPriority: 1,
          gccIsDeleted: false,
        },
        select: { gccId: true, gccIsActive: true },
      });
    });

    it('encrypts every secret sent and audits their names only', async () => {
      await service.save(
        createBody({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, appKey: APP_KEY }),
      );

      const data = createdData();
      expect(crypto.decrypt(data.gccClientIdEnc as string)).toBe(CLIENT_ID);
      expect(crypto.decrypt(data.gccClientSecretEnc as string)).toBe(CLIENT_SECRET);
      expect(crypto.decrypt(data.gccAppKeyEnc as string)).toBe(APP_KEY);
      expect(auditEntry().notes).toBe(
        'GST credential created; secrets written: password, clientId, clientSecret, appKey',
      );
      expectNoSecret(auditEntry());
    });

    it.each([
      ['left out', {}],
      ['sent as ""', { password: '' }],
    ])('refuses a credential whose password is %s', async (_label, extra) => {
      const body = createBody(extra);
      if (!('password' in extra)) body.password = undefined;

      const refusal = await refusalOf(service.save(body));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'password', code: GST_CODES.PASSWORD_REQUIRED }] },
      });
      expect(prisma.gstCompanyCredential.create).not.toHaveBeenCalled();
    });

    it('reports a bad validity and a missing password in one 400', async () => {
      const refusal = await refusalOf(
        service.save(
          createBody({
            password: undefined,
            gccValidFrom: '2026-04-01',
            gccValidUpto: '2026-03-31',
          }),
        ),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'gccValidUpto', code: GST_CODES.VALID_UPTO_BEFORE_FROM },
            { field: 'password', code: GST_CODES.PASSWORD_REQUIRED },
          ],
        },
      });
    });

    it('answers 503 GST_CRED_KEY_MISSING when a secret arrives and the server has no key', async () => {
      delete process.env.GST_CRED_KEY;

      const refusal = await refusalOf(service.save(createBody()));

      expect(refusal).toMatchObject({
        status: 503,
        body: { errors: [{ field: 'GST_CRED_KEY', code: GST_CODES.CRED_KEY_MISSING }] },
      });
      expect(prisma.gstCompanyCredential.create).not.toHaveBeenCalled();
    });

    it.each([
      ['clientId alone', { clientId: CLIENT_ID }, 'clientSecret'],
      ['clientSecret alone', { clientSecret: CLIENT_SECRET }, 'clientId'],
    ])('refuses %s, naming the half that is missing', async (_label, extra, field) => {
      const refusal = await refusalOf(service.save(createBody(extra)));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field, code: GST_CODES.PAIR_INCOMPLETE }] },
      });
      expect(prisma.gstCompanyCredential.create).not.toHaveBeenCalled();
    });

    it('refuses a secret both given and cleared', async () => {
      const refusal = await refusalOf(
        service.save(createBody({ appKey: APP_KEY, clear: ['appKey'] })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'appKey', code: GST_CODES.SECRET_GIVEN_AND_CLEARED }] },
      });
    });

    it('stores a branch credential under the branch, and answers with its GSTIN', async () => {
      const payload = await service.save(createBody({ gccBranchId: BRANCH_ID }));

      expect(prisma.branchMaster.findUnique).toHaveBeenCalledWith({
        where: { brId: BRANCH_ID },
        select: { brCompId: true, brIsDeleted: true, brGstinNo: true },
      });
      expect(createdData().gccBranchId).toBe(BRANCH_ID);
      expect(payload.gstin).toBe(BRANCH_GSTIN);
    });
  });

  // ── the GSTIN, the company, the branch and the provider ───────────────────
  describe('what a credential signs in as', () => {
    it.each([
      ['does not exist', null],
      ['is deleted', { compIsDeleted: true, compGstinNo: COMPANY_GSTIN, compName: 'Zeta' }],
    ])('answers 404 when the company %s', async (_label, company) => {
      prisma.company.findUnique.mockResolvedValue(company);

      const refusal = await refusalOf(service.save(createBody()));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gccCompanyId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it.each([
      ['does not exist', null],
      ['is deleted', { brCompId: COMPANY_ID, brIsDeleted: true, brGstinNo: BRANCH_GSTIN }],
    ])('answers 404 when the branch %s', async (_label, branch) => {
      prisma.branchMaster.findUnique.mockResolvedValue(branch);

      const refusal = await refusalOf(service.save(createBody({ gccBranchId: BRANCH_ID })));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gccBranchId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it("refuses another company's branch", async () => {
      prisma.branchMaster.findUnique.mockResolvedValue({
        brCompId: OTHER_COMPANY_ID,
        brIsDeleted: false,
        brGstinNo: BRANCH_GSTIN,
      });

      const refusal = await refusalOf(service.save(createBody({ gccBranchId: BRANCH_ID })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'gccBranchId', code: GST_CODES.BRANCH_OTHER_COMPANY }] },
      });
    });

    it('answers 422 GST_NO_GSTIN when the company has none to sign in as', async () => {
      prisma.company.findUnique.mockResolvedValue({
        compIsDeleted: false,
        compGstinNo: '   ',
        compName: 'Zeta Traders',
      });

      const refusal = await refusalOf(service.save(createBody()));

      expect(refusal).toEqual({
        status: 422,
        body: {
          success: false,
          message: 'No GSTIN to sign in as',
          errors: [
            {
              field: 'gccCompanyId',
              message:
                'Zeta Traders has no GSTIN. Set it in Company Master (or Branch Master) first.',
              code: GST_CODES.NO_GSTIN,
            },
          ],
        },
      });
      expect(prisma.gstCompanyCredential.create).not.toHaveBeenCalled();
    });

    it('names the branch when neither it nor the company has a GSTIN', async () => {
      prisma.company.findUnique.mockResolvedValue({
        compIsDeleted: false,
        compGstinNo: null,
        compName: 'Zeta Traders',
      });
      prisma.branchMaster.findUnique.mockResolvedValue({
        brCompId: COMPANY_ID,
        brIsDeleted: false,
        brGstinNo: ' ',
      });

      const refusal = await refusalOf(service.save(createBody({ gccBranchId: BRANCH_ID })));

      expect(refusal).toMatchObject({
        status: 422,
        body: {
          errors: [
            {
              field: 'gccBranchId',
              message: expect.stringContaining(', and neither does the branch'),
              code: GST_CODES.NO_GSTIN,
            },
          ],
        },
      });
    });

    it('signs a branch in under its own GSTIN when the company has none', async () => {
      prisma.company.findUnique.mockResolvedValue({
        compIsDeleted: false,
        compGstinNo: null,
        compName: 'Zeta Traders',
      });

      await expect(service.save(createBody({ gccBranchId: BRANCH_ID }))).resolves.toMatchObject({
        gccBranchId: BRANCH_ID,
      });
    });

    it('answers 404 for a provider that does not exist', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue(null);

      const refusal = await refusalOf(service.save(createBody()));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gccGpvId', code: GST_CODES.NOT_FOUND }] },
      });
    });

    it('refuses a deleted provider with a 409', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue({ gpvIsDeleted: true });

      const refusal = await refusalOf(service.save(createBody()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gccGpvId', code: GST_CODES.ALREADY_DELETED }] },
      });
    });
  });

  // ── the slot: ux_gcc_primary / ux_gcc_order ───────────────────────────────
  describe('the priority slot', () => {
    it('refuses a second live, active primary, naming the one in the way', async () => {
      prisma.gstCompanyCredential.findFirst.mockResolvedValue({
        gccId: OTHER_GCC_ID,
        gccIsActive: true,
      });

      const refusal = await refusalOf(service.save(createBody()));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [
            {
              field: 'gccPriority',
              message: expect.stringContaining(
                `Credential ${OTHER_GCC_ID} is the primary for EINVOICE SANDBOX.`,
              ),
              code: GST_CODES.CREDENTIAL_PRIMARY_EXISTS,
            },
          ],
        },
      });
      expect(prisma.gstCompanyCredential.create).not.toHaveBeenCalled();
    });

    it.each([
      ['the row in the way is inactive', {}, false],
      ['this one is inactive', { gccIsActive: false }, true],
      ['the priority is a failover', { gccPriority: 2 }, true],
    ])('calls it priority taken when %s', async (_label, extra, clashActive) => {
      prisma.gstCompanyCredential.findFirst.mockResolvedValue({
        gccId: OTHER_GCC_ID,
        gccIsActive: clashActive,
      });

      const refusal = await refusalOf(service.save(createBody(extra)));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: GST_CODES.CREDENTIAL_PRIORITY_TAKEN }] },
      });
    });

    it('describes an every-service branch slot in words', async () => {
      prisma.gstCompanyCredential.findFirst.mockResolvedValue({
        gccId: OTHER_GCC_ID,
        gccIsActive: true,
      });

      const refusal = await refusalOf(
        service.save(createBody({ gccService: null, gccBranchId: BRANCH_ID, gccPriority: 3 })),
      );

      expect(refusal).toMatchObject({
        body: {
          errors: [
            {
              message: `Credential ${OTHER_GCC_ID} already holds priority 3 for every service SANDBOX for branch ${BRANCH_ID}.`,
            },
          ],
        },
      });
    });

    it.each([
      ['ux_gcc_order (by name)', { target: 'ux_gcc_order' }, GST_CODES.CREDENTIAL_PRIORITY_TAKEN],
      [
        'ux_gcc_order (by its columns)',
        { target: ['gcc_company_id', 'gcc_branch_id', 'gcc_priority'] },
        GST_CODES.CREDENTIAL_PRIORITY_TAKEN,
      ],
      [
        'ux_gcc_primary (by its columns)',
        { target: ['gcc_company_id', 'gcc_branch_id', 'gcc_service'] },
        GST_CODES.CREDENTIAL_PRIMARY_EXISTS,
      ],
    ])('answers the race on %s with its 409', async (_label, meta, code) => {
      prisma.gstCompanyCredential.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta }),
      );

      const refusal = await refusalOf(service.save(createBody()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gccPriority', code }] },
      });
    });

    it('answers an unknown unique index with a plain GST_DUPLICATE', async () => {
      prisma.gstCompanyCredential.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
          meta: { target: 'ux_something_else' },
        }),
      );

      const refusal = await refusalOf(service.save(createBody()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'id', code: GST_CODES.DUPLICATE }] },
      });
    });

    it('answers a CHECK the database raised as a 400 on the field it guards', async () => {
      prisma.gstCompanyCredential.create.mockRejectedValue(
        Object.assign(new Error('Raw query failed'), {
          code: 'P2010',
          meta: {
            code: '23514',
            message:
              'new row for relation "gst_company_credential" violates check constraint "ck_gcc_validity"',
          },
        }),
      );

      const refusal = await refusalOf(service.save(createBody()));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'gccValidUpto', code: GST_CODES.CHECK }] },
      });
    });

    it('rethrows any other database failure untouched', async () => {
      const failure = new Error('connection reset');
      prisma.gstCompanyCredential.create.mockRejectedValue(failure);

      await expect(service.save(createBody())).rejects.toBe(failure);
    });
  });

  // ── save: update ──────────────────────────────────────────────────────────
  describe('save — update (gccId present)', () => {
    it('keeps every stored value the body left out', async () => {
      stored = credentialRow({
        gccBranchId: BRANCH_ID,
        branch: BRANCH_CONTEXT,
        gccPriority: 2,
        gccIsActive: false,
        gccPublicKeyRef: 'nic-einv-sandbox',
        gccWhitelistedIps: ['203.0.113.10'],
        gccValidUpto: new Date('2027-03-31T00:00:00.000Z'),
        gccRemarks: 'kept',
      });

      await service.save(updateBody());

      expect(updatedData()).toMatchObject({
        gccBranchId: BRANCH_ID,
        gccService: 'EINVOICE',
        gccPriority: 2,
        gccIsActive: false,
        gccPublicKeyRef: 'nic-einv-sandbox',
        gccWhitelistedIps: ['203.0.113.10'],
        gccValidUpto: new Date('2027-03-31T00:00:00.000Z'),
        gccRemarks: 'kept',
        gccModifiedOn: expect.any(Date),
        gccModifiedBy: USER_ID,
      });
      expect(prisma.gstCompanyCredential.create).not.toHaveBeenCalled();
    });

    it('clears what the body sends as null', async () => {
      stored = credentialRow({
        gccBranchId: BRANCH_ID,
        gccService: 'EINVOICE',
        gccPublicKeyRef: 'nic-einv-sandbox',
        gccValidUpto: new Date('2027-03-31T00:00:00.000Z'),
        gccRemarks: 'old',
        gccWhitelistedIps: ['203.0.113.10'],
      });

      await service.save(
        updateBody({
          gccBranchId: null,
          gccService: null,
          gccPublicKeyRef: null,
          gccValidUpto: null,
          gccRemarks: null,
          gccWhitelistedIps: null,
        }),
      );

      expect(updatedData()).toMatchObject({
        gccBranchId: null,
        gccService: null,
        gccPublicKeyRef: null,
        gccValidUpto: null,
        gccRemarks: null,
        gccWhitelistedIps: [],
      });
    });

    it('keeps every secret when none is sent, or one is sent as ""', async () => {
      stored = credentialRow({ gccAppKeyEnc: crypto.encrypt(APP_KEY), gccKeyVersion: 1 });

      const payload = await service.save(updateBody({ password: '', appKey: '' }));

      const data = updatedData();
      for (const column of [
        'gccPasswordEnc',
        'gccClientIdEnc',
        'gccClientSecretEnc',
        'gccAppKeyEnc',
        'gccPasswordChangedOn',
      ]) {
        expect(data).not.toHaveProperty(column);
      }
      expect(data.gccKeyVersion).toBe(1);
      expect(payload).toMatchObject({ hasPassword: true, hasAppKey: true });
      expect(auditEntry().notes).toBe('GST credential updated');
    });

    it('replaces the password, stamps when it changed, and audits before and after without it', async () => {
      const payload = await service.save(updateBody({ password: NEW_PASSWORD }));

      const data = updatedData();
      expect(crypto.decrypt(data.gccPasswordEnc as string)).toBe(NEW_PASSWORD);
      expect(data.gccPasswordChangedOn).toEqual(expect.any(Date));
      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: GCC_ID,
        originalRecord: expect.objectContaining({ gccId: GCC_ID, hasPassword: true }),
        modifiedRecord: payload,
        notes: 'GST credential updated; secrets written: password; live session retired',
      });
      expectNoSecret(auditEntry());
      expectNoSecret(payload);
    });

    it('clears the client pair together, and says so in the audit', async () => {
      stored = credentialRow({
        gccClientIdEnc: crypto.encrypt(CLIENT_ID),
        gccClientSecretEnc: crypto.encrypt(CLIENT_SECRET),
      });

      const payload = await service.save(updateBody({ clear: ['clientId', 'clientSecret'] }));

      expect(updatedData()).toMatchObject({ gccClientIdEnc: null, gccClientSecretEnc: null });
      expect(payload).toMatchObject({ hasClientId: false, hasClientSecret: false });
      expect(auditEntry().notes).toBe(
        'GST credential updated; secrets cleared: clientId, clientSecret; live session retired',
      );
    });

    it.each([
      ['clearing clientSecret while clientId stays', { clear: ['clientSecret'] }, 'clientSecret'],
      ['clearing clientId while clientSecret stays', { clear: ['clientId'] }, 'clientId'],
    ])('refuses %s', async (_label, extra, field) => {
      stored = credentialRow({
        gccClientIdEnc: crypto.encrypt(CLIENT_ID),
        gccClientSecretEnc: crypto.encrypt(CLIENT_SECRET),
      });

      const refusal = await refusalOf(service.save(updateBody(extra)));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field, code: GST_CODES.PAIR_INCOMPLETE }] },
      });
      expect(prisma.gstCompanyCredential.update).not.toHaveBeenCalled();
    });

    it('refuses half a pair added to a credential that has none', async () => {
      const refusal = await refusalOf(service.save(updateBody({ clientSecret: CLIENT_SECRET })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'clientId', code: GST_CODES.PAIR_INCOMPLETE }] },
      });
    });

    it('re-wraps the stored secrets under the current key when one is written', async () => {
      stored = credentialRow();
      const underV1 = stored.gccPasswordEnc;
      process.env.GST_CRED_KEY_V1 = keyHex;
      process.env.GST_CRED_KEY = randomBytes(32).toString('hex');
      process.env.GST_CRED_KEY_VERSION = '2';

      await service.save(updateBody({ appKey: APP_KEY }));

      const data = updatedData();
      expect(data.gccKeyVersion).toBe(2);
      expect(crypto.versionOf(data.gccPasswordEnc as string)).toBe(2);
      expect(crypto.decrypt(data.gccPasswordEnc as string)).toBe(STORED_PASSWORD);
      expect(data.gccPasswordEnc).not.toBe(underV1);
      // Re-wrapping is not a new password.
      expect(data).not.toHaveProperty('gccPasswordChangedOn');
    });

    it('saves a change with no secret on a server without a key', async () => {
      delete process.env.GST_CRED_KEY;

      await expect(service.save(updateBody({ gccRemarks: 'no key here' }))).resolves.toMatchObject({
        gccRemarks: 'no key here',
      });
    });

    it('answers 503 when a secret arrives on a server without a key', async () => {
      delete process.env.GST_CRED_KEY;

      const refusal = await refusalOf(service.save(updateBody({ password: NEW_PASSWORD })));

      expect(refusal).toMatchObject({
        status: 503,
        body: { errors: [{ code: GST_CODES.CRED_KEY_MISSING }] },
      });
      expect(prisma.gstCompanyCredential.update).not.toHaveBeenCalled();
    });

    it('answers 404 for an id that names no credential', async () => {
      stored = null;

      const refusal = await refusalOf(service.save(updateBody()));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'gccId', code: GST_CODES.NOT_FOUND }] },
      });
      expect(prisma.gstCompanyCredential.update).not.toHaveBeenCalled();
    });

    it('refuses to edit a deleted credential: restore it first', async () => {
      stored = credentialRow({ gccIsDeleted: true });

      const refusal = await refusalOf(service.save(updateBody()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gccId', code: GST_CODES.ALREADY_DELETED }] },
      });
    });

    it('refuses to move a credential to another company', async () => {
      const refusal = await refusalOf(service.save(updateBody({ gccCompanyId: OTHER_COMPANY_ID })));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gccCompanyId', code: GST_CODES.PARENT_FIXED }] },
      });
      expect(prisma.company.findUnique).not.toHaveBeenCalled();
    });

    it('checks a new validity start against the stored end', async () => {
      stored = credentialRow({ gccValidUpto: new Date('2026-12-31T00:00:00.000Z') });

      const refusal = await refusalOf(service.save(updateBody({ gccValidFrom: '2027-01-01' })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'gccValidUpto', code: GST_CODES.VALID_UPTO_BEFORE_FROM }] },
      });
    });

    it('does not ask for the password again on an update', async () => {
      await expect(service.save(updateBody())).resolves.toMatchObject({ gccId: GCC_ID });
    });

    it('checks the slot against every credential but itself', async () => {
      await service.save(updateBody());

      expect(prisma.gstCompanyCredential.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ gccId: { not: GCC_ID } }) as object,
        }),
      );
    });

    it('answers the slot race on an update with its 409', async () => {
      prisma.gstCompanyCredential.update.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
          meta: { target: 'ux_gcc_primary' },
        }),
      );

      const refusal = await refusalOf(service.save(updateBody()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: GST_CODES.CREDENTIAL_PRIMARY_EXISTS }] },
      });
    });

    // ── the live session belongs to who signed in ──────────────────────────
    describe('the live session', () => {
      const RETIRE = {
        where: { gasGccId: GCC_ID, gasIsActive: true, gasIsDeleted: false },
        data: { gasIsActive: false, gasLockBy: null, gasLockOn: null, gasLockUpto: null },
      };

      it.each([
        ['the branch', { gccBranchId: BRANCH_ID }],
        ['the provider', { gccGpvId: OTHER_GPV_ID }],
        ['the service', { gccService: 'EWAYBILL' }],
        ['the environment', { gccEnvironment: 'PRODUCTION' }],
        ['the login', { gccLoginId: 'other_user' }],
        ['the public key', { gccPublicKeyRef: 'nic-einv-sandbox' }],
        ['the password', { password: NEW_PASSWORD }],
        ['the client pair', { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }],
        ['the AppKey', { appKey: APP_KEY }],
      ])('is retired by a change of %s', async (_label, extra) => {
        await service.save(updateBody(extra));

        expect(prisma.gstAuthSession.updateMany).toHaveBeenCalledWith(RETIRE);
        expect(auditEntry().notes).toMatch(/; live session retired$/);
      });

      it('is retired when a stored secret is cleared', async () => {
        stored = credentialRow({ gccAppKeyEnc: crypto.encrypt(APP_KEY) });

        await service.save(updateBody({ clear: ['appKey'] }));

        expect(prisma.gstAuthSession.updateMany).toHaveBeenCalledWith(RETIRE);
      });

      it.each([
        ['remarks', { gccRemarks: 'called the GSP' }],
        ['the whitelist', { gccWhitelistedIps: ['203.0.113.10'] }],
        ['the validity', { gccValidUpto: '2027-03-31' }],
        ['the active flag', { gccIsActive: false }],
        ['the priority', { gccPriority: 2 }],
        ['the same values re-sent', { gccService: 'EINVOICE', gccLoginId: 'api_user' }],
      ])('is left alone by a change of %s', async (_label, extra) => {
        await service.save(updateBody(extra));

        expect(prisma.gstAuthSession.updateMany).not.toHaveBeenCalled();
        expect(auditEntry().notes).toBe('GST credential updated');
      });

      it('says nothing about a session when there was none to retire', async () => {
        prisma.gstAuthSession.updateMany.mockResolvedValue({ count: 0 });

        await service.save(updateBody({ gccLoginId: 'other_user' }));

        expect(prisma.gstAuthSession.updateMany).toHaveBeenCalled();
        expect(auditEntry().notes).toBe('GST credential updated');
      });
    });
  });

  // ── softDelete ────────────────────────────────────────────────────────────
  describe('softDelete', () => {
    it('marks the credential deleted, retires its session and audits it as a cancel', async () => {
      await expect(service.softDelete(GCC_ID)).resolves.toEqual({ gccId: GCC_ID, deleted: true });

      expect(prisma.gstCompanyCredential.update).toHaveBeenCalledWith({
        where: { gccId: GCC_ID },
        data: { gccIsDeleted: true, gccModifiedOn: expect.any(Date), gccModifiedBy: USER_ID },
        include: expect.any(Object),
      });
      expect(prisma.gstAuthSession.updateMany).toHaveBeenCalledWith({
        where: { gasGccId: GCC_ID, gasIsActive: true, gasIsDeleted: false },
        data: { gasIsActive: false, gasLockBy: null, gasLockOn: null, gasLockUpto: null },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        pk: GCC_ID,
        displayName: 'Zeta Traders EINVOICE SANDBOX #1',
        originalRecord: expect.objectContaining({ gccIsDeleted: false }),
        modifiedRecord: expect.objectContaining({ gccIsDeleted: true }),
        notes: 'GST credential soft deleted; live session retired',
      });
      expectNoSecret(auditEntry());
    });

    it('names an every-service credential ALL', async () => {
      stored = credentialRow({ gccService: null, gccPriority: 2 });

      await service.softDelete(GCC_ID);

      expect(auditEntry().displayName).toBe('Zeta Traders ALL SANDBOX #2');
    });

    it('answers 404 for an id that names no credential', async () => {
      stored = null;

      const refusal = await refusalOf(service.softDelete(GCC_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.gstCompanyCredential.update).not.toHaveBeenCalled();
    });

    it('refuses a credential that is already deleted', async () => {
      stored = credentialRow({ gccIsDeleted: true });

      const refusal = await refusalOf(service.softDelete(GCC_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gccId', code: GST_CODES.ALREADY_DELETED }] },
      });
      expect(prisma.gstAuthSession.updateMany).not.toHaveBeenCalled();
    });
  });

  // ── restore ───────────────────────────────────────────────────────────────
  describe('restore', () => {
    beforeEach(() => {
      stored = credentialRow({ gccIsDeleted: true, gccPriority: 2, gccIsActive: false });
    });

    it('brings the credential back and audits it as an update', async () => {
      await expect(service.restore(GCC_ID)).resolves.toEqual({ gccId: GCC_ID, deleted: false });

      expect(prisma.gstCompanyCredential.update).toHaveBeenCalledWith({
        where: { gccId: GCC_ID },
        data: { gccIsDeleted: false, gccModifiedOn: expect.any(Date), gccModifiedBy: USER_ID },
        include: expect.any(Object),
      });
      expect(auditEntry()).toMatchObject({
        action: 'update',
        notes: 'GST credential restored',
        originalRecord: expect.objectContaining({ gccIsDeleted: true }),
        modifiedRecord: expect.objectContaining({ gccIsDeleted: false }),
      });
    });

    it('checks its own stored slot, excluding itself', async () => {
      await service.restore(GCC_ID);

      expect(prisma.gstCompanyCredential.findFirst).toHaveBeenCalledWith({
        where: {
          gccCompanyId: COMPANY_ID,
          gccBranchId: null,
          gccService: 'EINVOICE',
          gccEnvironment: 'SANDBOX',
          gccPriority: 2,
          gccIsDeleted: false,
          gccId: { not: GCC_ID },
        },
        select: { gccId: true, gccIsActive: true },
      });
    });

    it('refuses a credential that is not deleted', async () => {
      stored = credentialRow();

      const refusal = await refusalOf(service.restore(GCC_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gccId', code: GST_CODES.NOT_DELETED }] },
      });
    });

    it('refuses while its provider is deleted', async () => {
      prisma.gstProvider.findUnique.mockResolvedValue({ gpvIsDeleted: true });

      const refusal = await refusalOf(service.restore(GCC_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'gccGpvId', code: GST_CODES.ALREADY_DELETED }] },
      });
      expect(prisma.gstCompanyCredential.update).not.toHaveBeenCalled();
    });

    it('refuses when its slot was filled meanwhile', async () => {
      stored = credentialRow({ gccIsDeleted: true });
      prisma.gstCompanyCredential.findFirst.mockResolvedValue({
        gccId: OTHER_GCC_ID,
        gccIsActive: true,
      });

      const refusal = await refusalOf(service.restore(GCC_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: GST_CODES.CREDENTIAL_PRIMARY_EXISTS }] },
      });
    });

    it('answers the slot race with its 409', async () => {
      prisma.gstCompanyCredential.update.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
          meta: { target: 'ux_gcc_order' },
        }),
      );

      const refusal = await refusalOf(service.restore(GCC_ID));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: GST_CODES.CREDENTIAL_PRIORITY_TAKEN }] },
      });
    });

    it('answers 404 for an id that names no credential', async () => {
      stored = null;

      await expect(refusalOf(service.restore(GCC_ID))).resolves.toMatchObject({ status: 404 });
    });
  });

  // ── verify (R8) ───────────────────────────────────────────────────────────
  describe('verify', () => {
    it('signs in once through GstAuthService as the request user', async () => {
      auth.signIn.mockResolvedValue({
        ok: true,
        message: 'Signed in',
        tokenValidUntil: '2026-10-21T12:00:00.000Z',
        creditBalance: 120.5,
      });

      await expect(service.verify(GCC_ID)).resolves.toEqual({
        ok: true,
        message: 'Signed in',
        tokenValidUntil: '2026-10-21T12:00:00.000Z',
        creditBalance: 120.5,
      });
      expect(auth.signIn).toHaveBeenCalledWith(GCC_ID, USER_ID);
    });

    it('answers a refusal by the portal as data, with its code', async () => {
      auth.signIn.mockResolvedValue({
        ok: false,
        message: 'Invalid password',
        errorCode: 'GSP_AUTH_FAILED',
        creditBalance: null,
      });

      await expect(service.verify(GCC_ID)).resolves.toEqual({
        ok: false,
        message: 'Invalid password',
        errorCode: 'GSP_AUTH_FAILED',
        creditBalance: null,
      });
    });

    it('lets a refusal raised before the portal (busy, rate limit …) through as it was', async () => {
      const busy = new HttpException({ success: false, message: 'busy', errors: [] }, 409);
      auth.signIn.mockRejectedValue(busy);

      await expect(service.verify(GCC_ID)).rejects.toBe(busy);
    });
  });

  // ── status (R9) ───────────────────────────────────────────────────────────
  describe('status', () => {
    const future = () => new Date(Date.now() + 3_600_000);
    const issued = new Date('2026-10-21T04:00:00.000Z');

    it('reports a live token, its lease and the credit balance', async () => {
      const expires = future();
      sessionRows = [
        { has_token: true, expires_on: expires, issued_on: issued, lease_free: false },
      ];
      stored = credentialRow({
        gccLastVerifiedOn: new Date('2026-10-21T04:00:01.000Z'),
        gccLastErrorMessage: null,
      });
      prisma.gstProviderAccount.findFirst.mockResolvedValue({
        gpaCreditBalance: new Prisma.Decimal('1520.75'),
      });

      await expect(service.status(GCC_ID)).resolves.toEqual({
        gccId: GCC_ID,
        hasLiveToken: true,
        tokenExpiresOn: expires.toISOString(),
        issuedOn: issued.toISOString(),
        leaseFree: false,
        lastVerifiedOn: '2026-10-21T04:00:01.000Z',
        lastErrorMessage: null,
        creditBalance: 1520.75,
      });
    });

    it("reads the provider account the credential's sign-in would use", async () => {
      await service.status(GCC_ID);

      expect(prisma.gstProviderAccount.findFirst).toHaveBeenCalledWith({
        where: {
          gpaGpvId: GPV_ID,
          gpaEnvironment: 'SANDBOX',
          gpaIsDeleted: false,
          gpaIsActive: true,
          OR: [{ gpaService: 'EINVOICE' }, { gpaService: null }],
        },
        orderBy: [{ gpaService: { sort: 'asc', nulls: 'last' } }, { gpaIsActive: 'desc' }],
      });
      const [, sessionGccId] = prisma.$queryRaw.mock.calls.at(-1) as unknown[];
      expect(sessionGccId).toBe(GCC_ID);
    });

    it('reports no token and a free lease when there is no session', async () => {
      stored = credentialRow({ gccLastErrorMessage: 'Invalid password' });

      await expect(service.status(GCC_ID)).resolves.toEqual({
        gccId: GCC_ID,
        hasLiveToken: false,
        tokenExpiresOn: null,
        issuedOn: null,
        leaseFree: true,
        lastVerifiedOn: null,
        lastErrorMessage: 'Invalid password',
        creditBalance: null,
      });
    });

    it('reports an expired token as not live, with when it expired', async () => {
      const expired = new Date(Date.now() - 60_000);
      sessionRows = [{ has_token: true, expires_on: expired, issued_on: issued, lease_free: true }];

      await expect(service.status(GCC_ID)).resolves.toMatchObject({
        hasLiveToken: false,
        tokenExpiresOn: expired.toISOString(),
      });
    });

    it('reports a PENDING placeholder as no token, but its lease as held', async () => {
      sessionRows = [
        { has_token: false, expires_on: future(), issued_on: issued, lease_free: false },
      ];

      await expect(service.status(GCC_ID)).resolves.toMatchObject({
        hasLiveToken: false,
        tokenExpiresOn: null,
        issuedOn: null,
        leaseFree: false,
      });
    });

    it('answers 404 for an id that names no credential', async () => {
      stored = null;

      await expect(refusalOf(service.status(GCC_ID))).resolves.toMatchObject({ status: 404 });
      expect(prisma.gstProviderAccount.findFirst).not.toHaveBeenCalled();
    });
  });
});
