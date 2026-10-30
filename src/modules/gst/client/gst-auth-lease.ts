import { GstProviderAccount, Prisma } from '@prisma/client';
import type { PrismaService } from 'src/database/prisma/prisma.service';

type Client = Prisma.TransactionClient | PrismaService;

/**
 * The single-flight sign-in of gsp_flow §3 / the gst_auth_session model:
 * claim a LEASE in a short transaction, call the portal outside any
 * transaction, write the result in a second short one. Not an advisory lock,
 * because no transaction may be held open across external HTTP.
 *
 * NIC blocks a GSTIN after 5 auth calls in 15 minutes, which is what the lease
 * exists to make impossible: of four tills (or two admins pressing Verify)
 * noticing the same expiry, exactly one signs in.
 */

/**
 * The provider account that applies to a credential: provider × environment,
 * the service-specific row over the "every service" one
 * (ORDER BY gpa_service NULLS LAST LIMIT 1). `activeOnly: false` is Verify's
 * reading — a test may use an account not yet activated, an active one first.
 */
export async function resolveProviderAccount(
  client: Client,
  credential: { gccGpvId: string; gccEnvironment: string; gccService: string | null },
  service: string | null = credential.gccService,
  options: { activeOnly: boolean } = { activeOnly: true },
): Promise<GstProviderAccount | null> {
  return client.gstProviderAccount.findFirst({
    where: {
      gpaGpvId: credential.gccGpvId,
      gpaEnvironment: credential.gccEnvironment,
      gpaIsDeleted: false,
      ...(options.activeOnly ? { gpaIsActive: true } : {}),
      OR: service ? [{ gpaService: service }, { gpaService: null }] : [{ gpaService: null }],
    },
    orderBy: [{ gpaService: { sort: 'asc', nulls: 'last' } }, { gpaIsActive: 'desc' }],
  });
}

export interface GstLease {
  gasId: string;
  tokenVersion: number;
  holder: string;
}

/**
 * Take the lease on the credential's live session row, or null when someone
 * else holds an unexpired one. The first sign-in of a credential has no row to
 * lease, so a PENDING placeholder (empty token, already expired) is inserted
 * first; ux_gas_live lets exactly one such insert in.
 */
export async function claimLease(
  prisma: PrismaService,
  params: {
    gccId: string;
    holder: string;
    leaseSeconds: number;
    keyVersion: number;
    actor: string;
  },
): Promise<GstLease | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO public.gst_auth_session
             (gas_gcc_id, gas_auth_token_enc, gas_token_type, gas_issued_on, gas_expires_on,
              gas_key_version, gas_created_by)
      VALUES (${params.gccId}::uuid, '', 'PENDING', now() - interval '1 second', now(),
              ${params.keyVersion}::smallint, ${params.actor.slice(0, 50)})
      ON CONFLICT (gas_gcc_id) WHERE gas_is_active = true AND gas_is_deleted = false
      DO NOTHING`;
    const [leased] = await tx.$queryRaw<Array<{ gas_id: string; gas_token_version: number }>>`
      UPDATE public.gst_auth_session
         SET gas_lock_by   = ${params.holder}::uuid,
             gas_lock_on   = now(),
             gas_lock_upto = now() + make_interval(secs => ${params.leaseSeconds}::int)
       WHERE gas_gcc_id = ${params.gccId}::uuid
         AND gas_is_active = true
         AND gas_is_deleted = false
         AND (gas_lock_upto IS NULL OR gas_lock_upto < now())
      RETURNING gas_id, gas_token_version`;
    return leased
      ? { gasId: leased.gas_id, tokenVersion: leased.gas_token_version, holder: params.holder }
      : null;
  });
}

/** Give the lease back, untouched, when the sign-in failed. A lease already lost is not ours to clear. */
export async function releaseLease(client: Client, lease: GstLease): Promise<void> {
  await client.gstAuthSession.updateMany({
    where: { gasId: lease.gasId, gasLockBy: lease.holder },
    data: { gasLockBy: null, gasLockOn: null, gasLockUpto: null },
  });
}

export interface GstNewSession {
  authTokenEnc: string;
  sessionKeyEnc: string | null;
  refreshTokenEnc: string | null;
  keyVersion: number;
  issuedOn: Date;
  expiresOn: Date;
  expiryRaw: string | null;
  actor: string;
}

/**
 * Renewal inserts a new row and retires the leased one (the model's
 * write-once rule), bumping gas_token_version so a worker holding the old
 * token in memory knows someone already refreshed it. False when the lease
 * was lost meanwhile — expired and taken, or the row retired by a credential
 * edit — in which case nothing is written: the other holder's row stands.
 */
export async function storeSession(
  tx: Prisma.TransactionClient,
  lease: GstLease,
  gccId: string,
  session: GstNewSession,
): Promise<boolean> {
  const { count } = await tx.gstAuthSession.updateMany({
    where: { gasId: lease.gasId, gasLockBy: lease.holder, gasIsActive: true },
    data: { gasIsActive: false, gasLockBy: null, gasLockOn: null, gasLockUpto: null },
  });
  if (count === 0) {
    return false;
  }
  await tx.gstAuthSession.create({
    data: {
      gasGccId: gccId,
      gasAuthTokenEnc: session.authTokenEnc,
      gasSessionKeyEnc: session.sessionKeyEnc,
      gasRefreshTokenEnc: session.refreshTokenEnc,
      gasKeyVersion: session.keyVersion,
      gasTokenType: 'AuthToken',
      gasIssuedOn: session.issuedOn,
      gasExpiresOn: session.expiresOn,
      gasExpiryRaw: session.expiryRaw?.slice(0, 40) ?? null,
      gasTokenVersion: lease.tokenVersion + 1,
      gasCreatedBy: session.actor.slice(0, 50),
    },
  });
  return true;
}
