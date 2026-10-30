"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProviderAccount = resolveProviderAccount;
exports.claimLease = claimLease;
exports.releaseLease = releaseLease;
exports.storeSession = storeSession;
async function resolveProviderAccount(client, credential, service = credential.gccService, options = { activeOnly: true }) {
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
async function claimLease(prisma, params) {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw `
      INSERT INTO public.gst_auth_session
             (gas_gcc_id, gas_auth_token_enc, gas_token_type, gas_issued_on, gas_expires_on,
              gas_key_version, gas_created_by)
      VALUES (${params.gccId}::uuid, '', 'PENDING', now() - interval '1 second', now(),
              ${params.keyVersion}::smallint, ${params.actor.slice(0, 50)})
      ON CONFLICT (gas_gcc_id) WHERE gas_is_active = true AND gas_is_deleted = false
      DO NOTHING`;
        const [leased] = await tx.$queryRaw `
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
async function releaseLease(client, lease) {
    await client.gstAuthSession.updateMany({
        where: { gasId: lease.gasId, gasLockBy: lease.holder },
        data: { gasLockBy: null, gasLockOn: null, gasLockUpto: null },
    });
}
async function storeSession(tx, lease, gccId, session) {
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
//# sourceMappingURL=gst-auth-lease.js.map