import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { throwUnprocessable } from 'src/common/utils/module-service.utils';
import { GST_CODES, GST_CREDENTIALS_MENU } from './gst-config.constants';
import { istToday, toCredentialPayload, type GstCredentialContext } from './gst-config.mappers';
import {
  decimalOrNull,
  GstConfigSupport,
  isoOrNull,
  keep,
  toDateOnly,
  type GstSecretSpec,
} from './gst-config.support';
import { SaveGstCompanyCredentialDto } from '../dto/save-gst-company-credential.dto';
import { resolveProviderAccount } from '../client/gst-auth-lease';
import { GstAuthService } from '../client/gst-auth.service';
import type {
  GstCompanyCredentialPayload,
  GstCredentialStatus,
  GstCredentialVerifyResult,
  GstErrorDetail,
} from '../types/gst-config.types';

const TABLE = 'gst company credential';
const SCREEN = 'GST Company Credential';

const SECRETS: readonly GstSecretSpec[] = [
  { key: 'password', column: 'gccPasswordEnc' },
  { key: 'clientId', column: 'gccClientIdEnc' },
  { key: 'clientSecret', column: 'gccClientSecretEnc' },
  { key: 'appKey', column: 'gccAppKeyEnc' },
];

type Tx = Prisma.TransactionClient;
type Client = Tx | PrismaService;

const CONTEXT_INCLUDE = {
  company: { select: { compName: true, compGstinNo: true } },
  branch: { select: { brName: true, brGstinNo: true } },
  provider: { select: { gpvCode: true, gpvName: true } },
} satisfies Prisma.GstCompanyCredentialInclude;

type CredentialWithContext = Prisma.GstCompanyCredentialGetPayload<{
  include: typeof CONTEXT_INCLUDE;
}>;

/** (company, branch, service, environment) — the key ux_gcc_primary / ux_gcc_order share. */
interface CredentialKey {
  gccCompanyId: string;
  gccBranchId: string | null;
  gccService: string | null;
  gccEnvironment: string;
}

/**
 * Notes 79 R7 + R9 — the taxpayer's portal login per company (or branch with
 * its own registration) × service × environment, and its session status.
 *
 * The GSTIN is never a field: it is COALESCE(branch GSTIN, company GSTIN),
 * resolved the way public.vw_gst_credential resolves it, and a credential
 * with nothing to resolve is refused (422 GST_NO_GSTIN) — it could sign in as
 * nobody. Secrets follow notes 79 §3 (write-only, has* flags back).
 *
 * The live session (gst_auth_session) belongs to the identity that signed in.
 * A save that changes who signs in — branch, provider, service, environment,
 * login, any secret or the public key — and a delete both retire it, so the
 * next call authenticates as the credential now says.
 */
@Injectable()
export class GstCompanyCredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: GstConfigSupport,
    private readonly auth: GstAuthService,
  ) {}

  /** One credential, deleted or not — the screen's Restore needs the deleted ones. */
  async getById(gccId: string): Promise<GstCompanyCredentialPayload> {
    await this.support.requireRight(GST_CREDENTIALS_MENU, 'view', 'view GST credentials');
    return this.toPayload(await this.loadOrThrow(this.prisma, gccId));
  }

  async save(dto: SaveGstCompanyCredentialDto): Promise<GstCompanyCredentialPayload> {
    const creating = dto.gccId === undefined;
    await this.support.requireRight(
      GST_CREDENTIALS_MENU,
      creating ? 'create' : 'edit',
      creating ? 'create GST credentials' : 'edit GST credentials',
    );
    const actor = this.support.actor();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = creating ? null : await this.loadOrThrow(tx, dto.gccId!);
        if (existing?.gccIsDeleted) {
          this.support.refuseDeleted('gccId', 'GST credential', existing.gccId);
        }
        if (existing && existing.gccCompanyId !== dto.gccCompanyId) {
          this.support.refuseParentChange('gccCompanyId', `company ${existing.gccCompanyId}`);
        }
        const key: CredentialKey = {
          gccCompanyId: dto.gccCompanyId,
          gccBranchId: keep(dto.gccBranchId, existing?.gccBranchId, null),
          gccService: keep(dto.gccService, existing?.gccService, null),
          gccEnvironment: dto.gccEnvironment,
        };
        await this.assertGstinResolves(tx, key);
        await this.liveProvider(tx, dto.gccGpvId);
        const validFrom = toDateOnly(dto.gccValidFrom)!;
        const validUpto = keep(toDateOnly(dto.gccValidUpto), existing?.gccValidUpto, null);
        const errors: GstErrorDetail[] = [];
        if (validUpto && validFrom > validUpto) {
          errors.push({ field: 'gccValidUpto', message: 'must not be before gccValidFrom' });
        }
        if (creating && !dto.password) {
          errors.push({ field: 'password', message: 'password is required on create' });
        }
        if (errors.length) {
          this.support.badRequest(errors);
        }
        const priority = keep(dto.gccPriority, existing?.gccPriority, 1);
        const isActive = keep(dto.gccIsActive, existing?.gccIsActive, true);
        await this.assertSlotIsFree(tx, key, priority, isActive, existing?.gccId ?? null);
        const secrets = this.support.writeSecrets({
          specs: SECRETS,
          input: dto as unknown as Record<string, unknown>,
          clear: dto.clear,
          stored: existing
            ? {
                gccPasswordEnc: existing.gccPasswordEnc,
                gccClientIdEnc: existing.gccClientIdEnc,
                gccClientSecretEnc: existing.gccClientSecretEnc,
                gccAppKeyEnc: existing.gccAppKeyEnc,
              }
            : null,
          storedVersion: existing?.gccKeyVersion ?? null,
        });
        // ck_gcc_client_pair: half a client pair is a login that cannot reach the gateway.
        const hasClientId =
          'gccClientIdEnc' in secrets.data
            ? secrets.data.gccClientIdEnc !== null
            : Boolean(existing?.gccClientIdEnc);
        const hasClientSecret =
          'gccClientSecretEnc' in secrets.data
            ? secrets.data.gccClientSecretEnc !== null
            : Boolean(existing?.gccClientSecretEnc);
        if (hasClientId !== hasClientSecret) {
          this.support.badRequest([
            {
              field: hasClientId ? 'clientSecret' : 'clientId',
              message: 'clientId and clientSecret are set together, or neither',
            },
          ]);
        }
        const publicKeyRef = keep(dto.gccPublicKeyRef, existing?.gccPublicKeyRef, null);
        const now = new Date();
        const data = {
          gccBranchId: key.gccBranchId,
          gccGpvId: dto.gccGpvId,
          gccService: key.gccService,
          gccEnvironment: key.gccEnvironment,
          gccPriority: priority,
          gccLoginId: dto.gccLoginId,
          ...secrets.data,
          gccKeyVersion: secrets.keyVersion,
          gccPublicKeyRef: publicKeyRef,
          gccWhitelistedIps: keep(dto.gccWhitelistedIps, existing?.gccWhitelistedIps, []),
          gccValidFrom: validFrom,
          gccValidUpto: validUpto,
          ...(secrets.written.includes('password') ? { gccPasswordChangedOn: now } : {}),
          gccRemarks: keep(dto.gccRemarks, existing?.gccRemarks, null),
          gccIsActive: isActive,
        };
        const saved = existing
          ? await tx.gstCompanyCredential.update({
              where: { gccId: existing.gccId },
              data: { ...data, gccModifiedOn: now, gccModifiedBy: actor },
              include: CONTEXT_INCLUDE,
            })
          : await tx.gstCompanyCredential.create({
              data: {
                ...data,
                gccCompanyId: key.gccCompanyId,
                // NOT NULL: the create check above guarantees writeSecrets wrapped one.
                gccPasswordEnc: secrets.data.gccPasswordEnc!,
                gccCreatedBy: actor,
              },
              include: CONTEXT_INCLUDE,
            });
        const identityChanged =
          existing !== null &&
          (existing.gccBranchId !== saved.gccBranchId ||
            existing.gccGpvId !== saved.gccGpvId ||
            existing.gccService !== saved.gccService ||
            existing.gccEnvironment !== saved.gccEnvironment ||
            existing.gccLoginId !== saved.gccLoginId ||
            existing.gccPublicKeyRef !== saved.gccPublicKeyRef ||
            Object.keys(secrets.data).length > 0);
        const retired = identityChanged ? await this.retireSessions(tx, saved.gccId) : 0;
        const cleared = (dto.clear ?? []).filter((k) => !secrets.written.includes(k));
        await this.support.audit(tx, {
          action: existing ? 'update' : 'New',
          table: TABLE,
          screen: SCREEN,
          pk: saved.gccId,
          displayName: this.displayName(saved),
          before: existing ? this.toPayload(existing) : null,
          after: this.toPayload(saved),
          notes:
            (existing ? 'GST credential updated' : 'GST credential created') +
            (secrets.written.length ? `; secrets written: ${secrets.written.join(', ')}` : '') +
            (cleared.length ? `; secrets cleared: ${cleared.join(', ')}` : '') +
            (retired ? '; live session retired' : ''),
        });
        return this.toPayload(saved);
      });
    } catch (error: unknown) {
      this.translateSlotError(error);
      throw error;
    }
  }

  async softDelete(gccId: string): Promise<{ gccId: string; deleted: boolean }> {
    await this.support.requireRight(GST_CREDENTIALS_MENU, 'delete', 'delete GST credentials');
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.loadOrThrow(tx, gccId);
      if (existing.gccIsDeleted) {
        this.support.conflict(
          'GST credential is already deleted',
          'gccId',
          'Nothing to delete. POST /gst/company-credentials/restore brings it back.',
          GST_CODES.ALREADY_DELETED,
        );
      }
      const updated = await tx.gstCompanyCredential.update({
        where: { gccId },
        data: {
          gccIsDeleted: true,
          gccModifiedOn: new Date(),
          gccModifiedBy: this.support.actor(),
        },
        include: CONTEXT_INCLUDE,
      });
      await this.retireSessions(tx, gccId);
      await this.support.audit(tx, {
        action: 'cancel',
        table: TABLE,
        screen: SCREEN,
        pk: gccId,
        displayName: this.displayName(existing),
        before: this.toPayload(existing),
        after: this.toPayload(updated),
        notes: 'GST credential soft deleted; live session retired',
      });
      return { gccId, deleted: true };
    });
  }

  /** Undo a delete. 409 when not deleted, when its slot is now taken, or its provider is deleted. */
  async restore(gccId: string): Promise<{ gccId: string; deleted: boolean }> {
    await this.support.requireRight(GST_CREDENTIALS_MENU, 'edit', 'restore GST credentials');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await this.loadOrThrow(tx, gccId);
        if (!existing.gccIsDeleted) {
          this.support.conflict(
            'GST credential is not deleted',
            'gccId',
            'Nothing to restore.',
            GST_CODES.NOT_DELETED,
          );
        }
        await this.liveProvider(tx, existing.gccGpvId);
        await this.assertSlotIsFree(
          tx,
          existing,
          existing.gccPriority,
          existing.gccIsActive,
          gccId,
        );
        const updated = await tx.gstCompanyCredential.update({
          where: { gccId },
          data: {
            gccIsDeleted: false,
            gccModifiedOn: new Date(),
            gccModifiedBy: this.support.actor(),
          },
          include: CONTEXT_INCLUDE,
        });
        await this.support.audit(tx, {
          action: 'update',
          table: TABLE,
          screen: SCREEN,
          pk: gccId,
          displayName: this.displayName(existing),
          before: this.toPayload(existing),
          after: this.toPayload(updated),
          notes: 'GST credential restored',
        });
        return { gccId, deleted: false };
      });
    } catch (error: unknown) {
      this.translateSlotError(error);
      throw error;
    }
  }

  /**
   * R8 — ONE sign-in through the lease (GstAuthService), gated on um_can_post:
   * it reaches an outside system. A portal refusal is { ok: false } with the
   * mapped message, not an HTTP error; 409 GST_AUTH_BUSY while another sign-in
   * holds the lease and GST_AUTH_RATE_LIMIT once the GSTIN has spent its
   * Verify budget, both without calling the portal.
   */
  async verify(gccId: string): Promise<GstCredentialVerifyResult> {
    await this.support.requireRight(GST_CREDENTIALS_MENU, 'post', 'verify GST credentials');
    const outcome = await this.auth.signIn(gccId, this.support.actor());
    return {
      ok: outcome.ok,
      message: outcome.message,
      ...(outcome.errorCode ? { errorCode: outcome.errorCode } : {}),
      ...(outcome.tokenValidUntil ? { tokenValidUntil: outcome.tokenValidUntil } : {}),
      creditBalance: outcome.creditBalance,
    };
  }

  /** R9 — the session and the last verification, read without a portal call. */
  async status(gccId: string): Promise<GstCredentialStatus> {
    await this.support.requireRight(GST_CREDENTIALS_MENU, 'view', 'view GST credentials');
    const credential = await this.loadOrThrow(this.prisma, gccId);
    const [session] = await this.prisma.$queryRaw<
      Array<{ has_token: boolean; expires_on: Date; issued_on: Date; lease_free: boolean }>
    >`
      SELECT gas_auth_token_enc <> '' AND gas_token_type <> 'PENDING' AS has_token,
             gas_expires_on AS expires_on,
             gas_issued_on  AS issued_on,
             (gas_lock_upto IS NULL OR gas_lock_upto < now()) AS lease_free
        FROM public.gst_auth_session
       WHERE gas_gcc_id = ${gccId}::uuid
         AND gas_is_active = true
         AND gas_is_deleted = false
       LIMIT 1`;
    const live = session?.has_token ? session : null;
    const account = await resolveProviderAccount(this.prisma, credential);
    return {
      gccId,
      hasLiveToken: live !== null && live.expires_on > new Date(),
      tokenExpiresOn: isoOrNull(live?.expires_on ?? null),
      issuedOn: isoOrNull(live?.issued_on ?? null),
      leaseFree: session ? session.lease_free : true,
      lastVerifiedOn: isoOrNull(credential.gccLastVerifiedOn),
      lastErrorMessage: credential.gccLastErrorMessage,
      creditBalance: decimalOrNull(account?.gpaCreditBalance ?? null),
    };
  }

  private async loadOrThrow(client: Client, gccId: string): Promise<CredentialWithContext> {
    const row = await client.gstCompanyCredential.findUnique({
      where: { gccId },
      include: CONTEXT_INCLUDE,
    });
    if (!row) {
      this.support.notFound('gccId', 'GST credential', gccId);
    }
    return row;
  }

  /** The company (and branch, when named) are live, the branch is the company's, and a GSTIN resolves. */
  private async assertGstinResolves(tx: Tx, key: CredentialKey): Promise<void> {
    const company = await tx.company.findUnique({
      where: { compId: key.gccCompanyId },
      select: { compIsDeleted: true, compGstinNo: true, compName: true },
    });
    if (!company || company.compIsDeleted) {
      this.support.notFound('gccCompanyId', 'Company', key.gccCompanyId);
    }
    let branchGstin: string | null = null;
    if (key.gccBranchId) {
      const branch = await tx.branchMaster.findUnique({
        where: { brId: key.gccBranchId },
        select: { brCompId: true, brIsDeleted: true, brGstinNo: true },
      });
      if (!branch || branch.brIsDeleted) {
        this.support.notFound('gccBranchId', 'Branch', key.gccBranchId);
      }
      if (branch.brCompId !== key.gccCompanyId) {
        this.support.badRequest([
          {
            field: 'gccBranchId',
            message: `the branch belongs to company ${branch.brCompId}, not this one`,
          },
        ]);
      }
      branchGstin = branch.brGstinNo?.trim() || null;
    }
    if (!branchGstin && !company.compGstinNo?.trim()) {
      throwNoGstin(key.gccBranchId ? 'gccBranchId' : 'gccCompanyId', company.compName);
    }
  }

  private async liveProvider(tx: Tx, gpvId: string): Promise<void> {
    const provider = await tx.gstProvider.findUnique({
      where: { gpvId },
      select: { gpvIsDeleted: true },
    });
    if (!provider) {
      this.support.notFound('gccGpvId', 'GST provider', gpvId);
    }
    if (provider.gpvIsDeleted) {
      this.support.refuseDeleted('gccGpvId', 'GST provider', gpvId);
    }
  }

  /**
   * ux_gcc_primary — one live, ACTIVE priority-1 row per key; ux_gcc_order —
   * each priority once per key among live rows, active or not. Checked here
   * for a refusal that names the row in the way; the indexes catch the race.
   */
  private async assertSlotIsFree(
    tx: Tx,
    key: CredentialKey,
    priority: number,
    isActive: boolean,
    excludeId: string | null,
  ): Promise<void> {
    const clash = await tx.gstCompanyCredential.findFirst({
      where: {
        gccCompanyId: key.gccCompanyId,
        gccBranchId: key.gccBranchId,
        gccService: key.gccService,
        gccEnvironment: key.gccEnvironment,
        gccPriority: priority,
        gccIsDeleted: false,
        ...(excludeId ? { gccId: { not: excludeId } } : {}),
      },
      select: { gccId: true, gccIsActive: true },
    });
    if (!clash) {
      return;
    }
    const scope =
      `${key.gccService ?? 'every service'} ${key.gccEnvironment}` +
      (key.gccBranchId ? ` for branch ${key.gccBranchId}` : '');
    if (priority === 1 && isActive && clash.gccIsActive) {
      this.support.conflict(
        'A primary credential already exists',
        'gccPriority',
        `Credential ${clash.gccId} is the primary for ${scope}. Give this one priority 2+ (a failover), or deactivate that one first.`,
        GST_CODES.CREDENTIAL_PRIMARY_EXISTS,
      );
    }
    this.support.conflict(
      'Priority already taken',
      'gccPriority',
      `Credential ${clash.gccId} already holds priority ${priority} for ${scope}.`,
      GST_CODES.CREDENTIAL_PRIORITY_TAKEN,
    );
  }

  private translateSlotError(error: unknown): void {
    this.support.translateWriteError(error, [
      {
        match: ['ux_gcc_order', 'gcc_priority'],
        field: 'gccPriority',
        message:
          'Another live credential holds that priority for this company, branch, service and environment.',
        code: GST_CODES.CREDENTIAL_PRIORITY_TAKEN,
      },
      {
        match: ['ux_gcc_primary', 'gcc_company_id'],
        field: 'gccPriority',
        message:
          'Another live, active credential is already the primary for this company, branch, service and environment.',
        code: GST_CODES.CREDENTIAL_PRIMARY_EXISTS,
      },
    ]);
  }

  /** Retire the live session (and release its lease) so the next call signs in afresh. */
  private async retireSessions(tx: Tx, gccId: string): Promise<number> {
    const { count } = await tx.gstAuthSession.updateMany({
      where: { gasGccId: gccId, gasIsActive: true, gasIsDeleted: false },
      data: { gasIsActive: false, gasLockBy: null, gasLockOn: null, gasLockUpto: null },
    });
    return count;
  }

  private displayName(row: CredentialWithContext): string {
    return `${row.company.compName} ${row.gccService ?? 'ALL'} ${row.gccEnvironment} #${row.gccPriority}`;
  }

  private toPayload(row: CredentialWithContext): GstCompanyCredentialPayload {
    const context: GstCredentialContext = {
      compName: row.company.compName,
      compGstinNo: row.company.compGstinNo,
      brName: row.branch?.brName ?? null,
      brGstinNo: row.branch?.brGstinNo ?? null,
      gpvCode: row.provider.gpvCode,
      gpvName: row.provider.gpvName,
    };
    return toCredentialPayload(row, context, istToday());
  }
}

/** 422: the request is well formed, but the company (or branch) has no registration to sign in as. */
function throwNoGstin(field: string, compName: string): never {
  throwUnprocessable<GstErrorDetail>('No GSTIN to sign in as', [
    {
      field,
      message: `${compName} has no GSTIN${field === 'gccBranchId' ? ', and neither does the branch' : ''}. Set it in Company Master (or Branch Master) first.`,
      code: GST_CODES.NO_GSTIN,
    },
  ]);
}
