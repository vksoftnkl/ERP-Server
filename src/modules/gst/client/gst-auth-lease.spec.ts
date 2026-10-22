import type { PrismaService } from 'src/database/prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import {
  claimLease,
  releaseLease,
  resolveProviderAccount,
  storeSession,
  type GstLease,
  type GstNewSession,
} from './gst-auth-lease';

const GCC_ID = '019c6f6c-be87-7a11-8905-36092c46f701';
const GPV_ID = '019c6f6c-be87-7a11-8905-36092c46f702';
const GAS_ID = '019c6f6c-be87-7a11-8905-36092c46f703';
const HOLDER = '019c6f6c-be87-7a11-8905-36092c46f704';

type ClientMock = {
  gstProviderAccount: { findFirst: jest.Mock };
  gstAuthSession: { updateMany: jest.Mock; create: jest.Mock };
  $executeRaw: jest.Mock;
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
};

/** A tagged-template call as the mock saw it: the SQL text and the bound values. */
const sqlOf = (mock: jest.Mock, call = 0) => {
  const [strings, ...values] = mock.mock.calls[call] as [TemplateStringsArray, ...unknown[]];
  return { text: strings.join('?').replace(/\s+/g, ' '), values };
};

describe('gst-auth-lease', () => {
  let client: ClientMock;

  beforeEach(() => {
    client = {
      gstProviderAccount: { findFirst: jest.fn().mockResolvedValue(null) },
      gstAuthSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (callback: (tx: ClientMock) => unknown) => callback(client)),
    };
  });

  const asPrisma = () => client as unknown as PrismaService;
  const asTx = () => client as unknown as Prisma.TransactionClient;

  // ── resolveProviderAccount ────────────────────────────────────────────────
  describe('resolveProviderAccount', () => {
    const credential = { gccGpvId: GPV_ID, gccEnvironment: 'SANDBOX', gccService: 'EINVOICE' };

    it('prefers the live service account over the every-service one, active only', async () => {
      const account = { gpaId: 'a1' };
      client.gstProviderAccount.findFirst.mockResolvedValue(account);

      await expect(resolveProviderAccount(asPrisma(), credential)).resolves.toBe(account);

      expect(client.gstProviderAccount.findFirst).toHaveBeenCalledWith({
        where: {
          gpaGpvId: GPV_ID,
          gpaEnvironment: 'SANDBOX',
          gpaIsDeleted: false,
          gpaIsActive: true,
          OR: [{ gpaService: 'EINVOICE' }, { gpaService: null }],
        },
        orderBy: [{ gpaService: { sort: 'asc', nulls: 'last' } }, { gpaIsActive: 'desc' }],
      });
    });

    it('takes a service named by the caller over the credential’s own', async () => {
      await resolveProviderAccount(asPrisma(), credential, 'GSTIN_VERIFY');

      expect(client.gstProviderAccount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ gpaService: 'GSTIN_VERIFY' }, { gpaService: null }],
          }) as object,
        }),
      );
    });

    it('looks only at the every-service account when there is no service', async () => {
      await resolveProviderAccount(asPrisma(), { ...credential, gccService: null });

      expect(client.gstProviderAccount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: [{ gpaService: null }] }) as object,
        }),
      );
    });

    it('lets an inactive account in when asked, still never a deleted one', async () => {
      await resolveProviderAccount(asPrisma(), credential, 'EINVOICE', { activeOnly: false });

      const { where } = client.gstProviderAccount.findFirst.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(where).not.toHaveProperty('gpaIsActive');
      expect(where).toMatchObject({ gpaIsDeleted: false });
    });

    it('answers null when the provider has no such account', async () => {
      await expect(resolveProviderAccount(asPrisma(), credential)).resolves.toBeNull();
    });
  });

  // ── claimLease ────────────────────────────────────────────────────────────
  describe('claimLease', () => {
    const params = {
      gccId: GCC_ID,
      holder: HOLDER,
      leaseSeconds: 90,
      keyVersion: 2,
      actor: 'admin',
    };

    it('places a PENDING row for a first sign-in, then leases the live row in one transaction', async () => {
      client.$queryRaw.mockResolvedValue([{ gas_id: GAS_ID, gas_token_version: 4 }]);

      await expect(claimLease(asPrisma(), params)).resolves.toEqual({
        gasId: GAS_ID,
        tokenVersion: 4,
        holder: HOLDER,
      });

      expect(client.$transaction).toHaveBeenCalledTimes(1);
      const insert = sqlOf(client.$executeRaw);
      expect(insert.text).toContain('INSERT INTO public.gst_auth_session');
      expect(insert.text).toContain("'PENDING'");
      // ux_gas_live lets exactly one placeholder in; a second claimer's insert is a no-op.
      expect(insert.text).toContain(
        'ON CONFLICT (gas_gcc_id) WHERE gas_is_active = true AND gas_is_deleted = false DO NOTHING',
      );
      expect(insert.values).toEqual([GCC_ID, 2, 'admin']);
      expect(client.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        client.$queryRaw.mock.invocationCallOrder[0],
      );
    });

    it('takes only a lease nobody holds, or one that has run out', async () => {
      client.$queryRaw.mockResolvedValue([{ gas_id: GAS_ID, gas_token_version: 1 }]);

      await claimLease(asPrisma(), params);

      const update = sqlOf(client.$queryRaw);
      expect(update.text).toContain('UPDATE public.gst_auth_session');
      expect(update.text).toContain('AND (gas_lock_upto IS NULL OR gas_lock_upto < now())');
      expect(update.text).toContain('AND gas_is_active = true AND gas_is_deleted = false');
      expect(update.text).toContain('RETURNING gas_id, gas_token_version');
      expect(update.values).toEqual([HOLDER, 90, GCC_ID]);
    });

    it('answers null while someone else holds an unexpired lease', async () => {
      client.$queryRaw.mockResolvedValue([]);

      await expect(claimLease(asPrisma(), params)).resolves.toBeNull();
    });

    it('cuts the actor to the 50 characters gas_created_by holds', async () => {
      await claimLease(asPrisma(), { ...params, actor: 'x'.repeat(80) });

      expect(sqlOf(client.$executeRaw).values[2]).toBe('x'.repeat(50));
    });
  });

  // ── releaseLease ──────────────────────────────────────────────────────────
  describe('releaseLease', () => {
    it('clears the lease only while this holder still has it', async () => {
      const lease: GstLease = { gasId: GAS_ID, tokenVersion: 3, holder: HOLDER };

      await releaseLease(asTx(), lease);

      expect(client.gstAuthSession.updateMany).toHaveBeenCalledWith({
        where: { gasId: GAS_ID, gasLockBy: HOLDER },
        data: { gasLockBy: null, gasLockOn: null, gasLockUpto: null },
      });
    });
  });

  // ── storeSession ──────────────────────────────────────────────────────────
  describe('storeSession', () => {
    const lease: GstLease = { gasId: GAS_ID, tokenVersion: 3, holder: HOLDER };
    const session: GstNewSession = {
      authTokenEnc: 'gcm:v1:token',
      sessionKeyEnc: 'gcm:v1:sek',
      refreshTokenEnc: null,
      keyVersion: 1,
      issuedOn: new Date('2026-10-21T04:00:00.000Z'),
      expiresOn: new Date('2026-10-21T10:00:00.000Z'),
      expiryRaw: '2026-10-21 15:30:00',
      actor: 'admin',
    };

    it('retires the leased row, then writes the new session one token version up', async () => {
      await expect(storeSession(asTx(), lease, GCC_ID, session)).resolves.toBe(true);

      expect(client.gstAuthSession.updateMany).toHaveBeenCalledWith({
        where: { gasId: GAS_ID, gasLockBy: HOLDER, gasIsActive: true },
        data: { gasIsActive: false, gasLockBy: null, gasLockOn: null, gasLockUpto: null },
      });
      expect(client.gstAuthSession.create).toHaveBeenCalledWith({
        data: {
          gasGccId: GCC_ID,
          gasAuthTokenEnc: 'gcm:v1:token',
          gasSessionKeyEnc: 'gcm:v1:sek',
          gasRefreshTokenEnc: null,
          gasKeyVersion: 1,
          gasTokenType: 'AuthToken',
          gasIssuedOn: session.issuedOn,
          gasExpiresOn: session.expiresOn,
          gasExpiryRaw: '2026-10-21 15:30:00',
          gasTokenVersion: 4,
          gasCreatedBy: 'admin',
        },
      });
      expect(client.gstAuthSession.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
        client.gstAuthSession.create.mock.invocationCallOrder[0],
      );
    });

    it('writes nothing and answers false when the lease was lost meanwhile', async () => {
      client.gstAuthSession.updateMany.mockResolvedValue({ count: 0 });

      await expect(storeSession(asTx(), lease, GCC_ID, session)).resolves.toBe(false);

      expect(client.gstAuthSession.create).not.toHaveBeenCalled();
    });

    it('cuts the raw expiry to 40 characters and the actor to 50, and keeps a missing expiry null', async () => {
      await storeSession(asTx(), lease, GCC_ID, {
        ...session,
        expiryRaw: 'e'.repeat(60),
        actor: 'a'.repeat(70),
      });
      await storeSession(asTx(), lease, GCC_ID, { ...session, expiryRaw: null });

      const [long, missing] = client.gstAuthSession.create.mock.calls.map(
        ([args]: [{ data: Record<string, unknown> }]) => args.data,
      );
      expect(long).toMatchObject({ gasExpiryRaw: 'e'.repeat(40), gasCreatedBy: 'a'.repeat(50) });
      expect(missing.gasExpiryRaw).toBeNull();
    });
  });
});
