import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { GST_CODES, GST_PROVIDERS_MENU } from './gst-config.constants';
import { toAccountPayload } from './gst-config.mappers';
import { GstConfigSupport, keep, toDateOnly, type GstSecretSpec } from './gst-config.support';
import { SaveGstProviderAccountDto } from '../dto/save-gst-provider-account.dto';
import type { GstProviderAccountPayload } from '../types/gst-config.types';

const TABLE = 'gst provider account';
const SCREEN = 'GST Provider Account';

/** Body key → `_enc` column. The auth envelope reads clientId as {aspId} too. */
const SECRETS: readonly GstSecretSpec[] = [
  { key: 'clientId', column: 'gpaClientIdEnc' },
  { key: 'clientSecret', column: 'gpaClientSecretEnc' },
  { key: 'apiKey', column: 'gpaApiKeyEnc' },
];

/**
 * Notes 79 R6 — the GSP's own account (this installation → their gateway),
 * per provider × environment, with gpaService NULL covering every service and
 * a set one overriding it for that service alone.
 *
 * Its secrets follow notes 79 §3 exactly: written plain once, stored
 * encrypted, read back only as hasClientId / hasClientSecret / hasApiKey and
 * keyVersion — in /get, in the create response and in the audit row alike.
 */
@Injectable()
export class GstProviderAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: GstConfigSupport,
  ) {}

  async getById(gpaId: string): Promise<GstProviderAccountPayload> {
    await this.support.requireRight(GST_PROVIDERS_MENU, 'view', 'view GST provider accounts');
    const row = await this.prisma.gstProviderAccount.findUnique({
      where: { gpaId },
      include: { provider: { select: { gpvCode: true } } },
    });
    if (!row) {
      this.support.notFound('gpaId', 'GST provider account', gpaId);
    }
    return toAccountPayload(row, row.provider.gpvCode);
  }

  async save(dto: SaveGstProviderAccountDto): Promise<GstProviderAccountPayload> {
    const creating = dto.gpaId === undefined;
    await this.support.requireRight(
      GST_PROVIDERS_MENU,
      creating ? 'create' : 'edit',
      creating ? 'create GST provider accounts' : 'edit GST provider accounts',
    );
    const actor = this.support.actor();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = creating
          ? null
          : await tx.gstProviderAccount.findUnique({ where: { gpaId: dto.gpaId } });
        if (!creating && !existing) {
          this.support.notFound('gpaId', 'GST provider account', dto.gpaId!);
        }
        if (existing?.gpaIsDeleted) {
          this.support.refuseDeleted('gpaId', 'GST provider account', existing.gpaId);
        }
        if (existing && existing.gpaGpvId !== dto.gpaGpvId) {
          this.support.refuseParentChange('gpaGpvId', `provider ${existing.gpaGpvId}`);
        }
        const provider = await tx.gstProvider.findUnique({
          where: { gpvId: dto.gpaGpvId },
          select: { gpvCode: true, gpvIsDeleted: true },
        });
        if (!provider) {
          this.support.notFound('gpaGpvId', 'GST provider', dto.gpaGpvId);
        }
        if (provider.gpvIsDeleted) {
          this.support.refuseDeleted('gpaGpvId', 'GST provider', dto.gpaGpvId);
        }
        const service = keep(dto.gpaService, existing?.gpaService, null);
        const validFrom = keep(toDateOnly(dto.gpaValidFrom), existing?.gpaValidFrom, null);
        const validUpto = keep(toDateOnly(dto.gpaValidUpto), existing?.gpaValidUpto, null);
        if (validFrom && validUpto && validFrom > validUpto) {
          this.support.badRequest([
            { field: 'gpaValidUpto', message: 'must not be before gpaValidFrom' },
          ]);
        }
        const clash = await tx.gstProviderAccount.findFirst({
          where: {
            gpaGpvId: dto.gpaGpvId,
            gpaEnvironment: dto.gpaEnvironment,
            gpaService: service,
            gpaIsDeleted: false,
            ...(existing ? { gpaId: { not: existing.gpaId } } : {}),
          },
          select: { gpaId: true },
        });
        if (clash) {
          this.duplicate(dto.gpaEnvironment, service, clash.gpaId);
        }
        const secrets = this.support.writeSecrets({
          specs: SECRETS,
          input: dto as unknown as Record<string, unknown>,
          clear: dto.clear,
          stored: existing
            ? {
                gpaClientIdEnc: existing.gpaClientIdEnc,
                gpaClientSecretEnc: existing.gpaClientSecretEnc,
                gpaApiKeyEnc: existing.gpaApiKeyEnc,
              }
            : null,
          storedVersion: existing?.gpaKeyVersion ?? null,
        });
        const data = {
          gpaEnvironment: dto.gpaEnvironment,
          gpaService: service,
          gpaAccountRef: dto.gpaAccountRef,
          ...secrets.data,
          gpaKeyVersion: secrets.keyVersion,
          gpaValidFrom: validFrom,
          gpaValidUpto: validUpto,
          gpaRemarks: keep(dto.gpaRemarks, existing?.gpaRemarks, null),
          gpaIsActive: keep(dto.gpaIsActive, existing?.gpaIsActive, true),
        };
        const saved = existing
          ? await tx.gstProviderAccount.update({
              where: { gpaId: existing.gpaId },
              data: { ...data, gpaModifiedOn: new Date(), gpaModifiedBy: actor },
            })
          : await tx.gstProviderAccount.create({
              data: { ...data, gpaGpvId: dto.gpaGpvId, gpaCreatedBy: actor },
            });
        const cleared = (dto.clear ?? []).filter((key) => !secrets.written.includes(key));
        await this.support.audit(tx, {
          action: existing ? 'update' : 'New',
          table: TABLE,
          screen: SCREEN,
          pk: saved.gpaId,
          displayName: `${provider.gpvCode} ${saved.gpaEnvironment} ${saved.gpaService ?? 'ALL'}`,
          before: existing ? toAccountPayload(existing, provider.gpvCode) : null,
          after: toAccountPayload(saved, provider.gpvCode),
          notes:
            (existing ? 'GST provider account updated' : 'GST provider account created') +
            (secrets.written.length ? `; secrets written: ${secrets.written.join(', ')}` : '') +
            (cleared.length ? `; secrets cleared: ${cleared.join(', ')}` : ''),
        });
        return toAccountPayload(saved, provider.gpvCode);
      });
    } catch (error: unknown) {
      this.support.translateWriteError(error, [
        {
          match: ['ux_gpa_provider_env_service', 'gpa_environment'],
          field: 'gpaEnvironment',
          message: 'The provider already has a live account for that environment and service.',
          code: GST_CODES.ACCOUNT_DUPLICATE,
        },
      ]);
      throw error;
    }
  }

  async softDelete(gpaId: string): Promise<{ gpaId: string; deleted: boolean }> {
    await this.support.requireRight(GST_PROVIDERS_MENU, 'delete', 'delete GST provider accounts');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gstProviderAccount.findUnique({
        where: { gpaId },
        include: { provider: { select: { gpvCode: true } } },
      });
      if (!existing) {
        this.support.notFound('gpaId', 'GST provider account', gpaId);
      }
      if (existing.gpaIsDeleted) {
        this.support.conflict(
          'GST provider account is already deleted',
          'gpaId',
          'Nothing to delete.',
          GST_CODES.ALREADY_DELETED,
        );
      }
      const updated = await tx.gstProviderAccount.update({
        where: { gpaId },
        data: {
          gpaIsDeleted: true,
          gpaModifiedOn: new Date(),
          gpaModifiedBy: this.support.actor(),
        },
      });
      const code = existing.provider.gpvCode;
      await this.support.audit(tx, {
        action: 'cancel',
        table: TABLE,
        screen: SCREEN,
        pk: gpaId,
        displayName: `${code} ${existing.gpaEnvironment} ${existing.gpaService ?? 'ALL'}`,
        before: toAccountPayload(existing, code),
        after: toAccountPayload(updated, code),
        notes: 'GST provider account soft deleted',
      });
      return { gpaId, deleted: true };
    });
  }

  private duplicate(environment: string, service: string | null, clashId: string): never {
    this.support.conflict(
      'Duplicate',
      'gpaEnvironment',
      `The provider already has a live ${environment} account for ${service ?? 'every service'} (${clashId}).`,
      GST_CODES.ACCOUNT_DUPLICATE,
    );
  }
}
