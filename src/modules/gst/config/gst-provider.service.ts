import { Injectable } from '@nestjs/common';
import { GstProvider, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { GST_CODES, GST_PROVIDERS_MENU } from './gst-config.constants';
import {
  toAccountPayload,
  toProviderAuditRecord,
  toProviderPayload,
  toServicePayload,
} from './gst-config.mappers';
import { GstConfigSupport, keep } from './gst-config.support';
import { SaveGstProviderDto } from '../dto/save-gst-provider.dto';
import type { GstProviderPayload } from '../types/gst-config.types';

const TABLE = 'gst provider';
const SCREEN = 'GST Provider';

type Client = Prisma.TransactionClient | PrismaService;

/**
 * Notes 79 R1 — the header of gst_provider, and the one read the provider
 * screen opens with: the header, its live services and accounts (secret-free)
 * and the counts of what hangs below. Lists are grids, so there is no /list.
 *
 * A provider is never renamed (gpv_code is a real UNIQUE constraint, deleted
 * rows included) and is soft-deleted only while no live credential names it.
 * Its services, endpoints and maps are left as they are on delete, so a
 * restore brings the whole configuration back.
 */
@Injectable()
export class GstProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: GstConfigSupport,
  ) {}

  /** One provider, deleted or not — the screen's Restore needs the deleted ones. */
  async getById(gpvId: string): Promise<GstProviderPayload> {
    await this.support.requireRight(GST_PROVIDERS_MENU, 'view', 'view GST providers');
    const row = await this.prisma.gstProvider.findUnique({ where: { gpvId } });
    if (!row) {
      this.support.notFound('gpvId', 'GST provider', gpvId);
    }
    return this.load(this.prisma, row);
  }

  /** Create (no gpvId) or update. 409 on a code clash or a code change. */
  async save(dto: SaveGstProviderDto): Promise<GstProviderPayload> {
    const creating = dto.gpvId === undefined;
    await this.support.requireRight(
      GST_PROVIDERS_MENU,
      creating ? 'create' : 'edit',
      creating ? 'create GST providers' : 'edit GST providers',
    );
    const actor = this.support.actor();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = creating
          ? null
          : await tx.gstProvider.findUnique({ where: { gpvId: dto.gpvId } });
        if (!creating && !existing) {
          this.support.notFound('gpvId', 'GST provider', dto.gpvId!);
        }
        if (existing?.gpvIsDeleted) {
          this.support.refuseDeleted('gpvId', 'GST provider', existing.gpvId);
        }
        if (existing && existing.gpvCode !== dto.gpvCode) {
          this.support.conflict(
            'A provider code is never renamed',
            'gpvCode',
            `This provider is ${existing.gpvCode}. Retire it and create ${dto.gpvCode} instead.`,
            GST_CODES.PROVIDER_CODE_FIXED,
          );
        }
        if (creating) {
          await this.assertCodeIsFree(tx, dto.gpvCode);
        }
        const data = {
          gpvName: dto.gpvName,
          gpvPortalUrl: keep(dto.gpvPortalUrl, existing?.gpvPortalUrl, null),
          gpvSupportEmail: keep(dto.gpvSupportEmail, existing?.gpvSupportEmail, null),
          gpvSupportPhone: keep(dto.gpvSupportPhone, existing?.gpvSupportPhone, null),
          gpvTimeoutMs: keep(dto.gpvTimeoutMs, existing?.gpvTimeoutMs, 30000),
          gpvMaxRetries: keep(dto.gpvMaxRetries, existing?.gpvMaxRetries, 2),
          gpvRateLimitPerMin: keep(dto.gpvRateLimitPerMin, existing?.gpvRateLimitPerMin, null),
          gpvRemarks: keep(dto.gpvRemarks, existing?.gpvRemarks, null),
          gpvIsActive: keep(dto.gpvIsActive, existing?.gpvIsActive, true),
        };
        const saved = existing
          ? await tx.gstProvider.update({
              where: { gpvId: existing.gpvId },
              data: { ...data, gpvModifiedOn: new Date(), gpvModifiedBy: actor },
            })
          : await tx.gstProvider.create({
              data: { ...data, gpvCode: dto.gpvCode, gpvCreatedBy: actor },
            });
        await this.support.audit(tx, {
          action: existing ? 'update' : 'New',
          table: TABLE,
          screen: SCREEN,
          pk: saved.gpvId,
          displayName: saved.gpvCode,
          before: existing ? toProviderAuditRecord(existing) : null,
          after: toProviderAuditRecord(saved),
          notes: existing ? 'GST provider updated' : 'GST provider created',
        });
        return this.load(tx, saved);
      });
    } catch (error: unknown) {
      this.support.translateWriteError(error, [
        {
          match: ['gpv_code'],
          field: 'gpvCode',
          message: `Provider code ${dto.gpvCode} is taken (by a deleted provider, perhaps).`,
          code: GST_CODES.PROVIDER_CODE_DUPLICATE,
        },
      ]);
      throw error;
    }
  }

  /** Soft delete. 409 when already deleted or while a live credential names the provider. */
  async softDelete(gpvId: string): Promise<{ gpvId: string; deleted: boolean }> {
    await this.support.requireRight(GST_PROVIDERS_MENU, 'delete', 'delete GST providers');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gstProvider.findUnique({ where: { gpvId } });
      if (!existing) {
        this.support.notFound('gpvId', 'GST provider', gpvId);
      }
      if (existing.gpvIsDeleted) {
        this.support.conflict(
          'GST provider is already deleted',
          'gpvId',
          'Nothing to delete. POST /gst/providers/restore brings it back.',
          GST_CODES.ALREADY_DELETED,
        );
      }
      const credentials = await this.credentialCount(tx, gpvId);
      if (credentials > 0) {
        this.support.conflict(
          'GST provider is in use',
          'gpvId',
          `${credentials} live company credential${credentials === 1 ? '' : 's'} sign${credentials === 1 ? 's' : ''} in through ${existing.gpvCode}. Delete or repoint ${credentials === 1 ? 'it' : 'them'} first.`,
          GST_CODES.PROVIDER_IN_USE,
        );
      }
      await this.setDeleted(tx, existing, true);
      return { gpvId, deleted: true };
    });
  }

  /** Undo a delete. 409 when it is not deleted. */
  async restore(gpvId: string): Promise<{ gpvId: string; deleted: boolean }> {
    await this.support.requireRight(GST_PROVIDERS_MENU, 'edit', 'restore GST providers');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gstProvider.findUnique({ where: { gpvId } });
      if (!existing) {
        this.support.notFound('gpvId', 'GST provider', gpvId);
      }
      if (!existing.gpvIsDeleted) {
        this.support.conflict(
          'GST provider is not deleted',
          'gpvId',
          'Nothing to restore.',
          GST_CODES.NOT_DELETED,
        );
      }
      await this.setDeleted(tx, existing, false);
      return { gpvId, deleted: false };
    });
  }

  private async setDeleted(
    tx: Prisma.TransactionClient,
    existing: GstProvider,
    deleted: boolean,
  ): Promise<void> {
    const updated = await tx.gstProvider.update({
      where: { gpvId: existing.gpvId },
      data: {
        gpvIsDeleted: deleted,
        gpvModifiedOn: new Date(),
        gpvModifiedBy: this.support.actor(),
      },
    });
    await this.support.audit(tx, {
      action: deleted ? 'cancel' : 'update',
      table: TABLE,
      screen: SCREEN,
      pk: existing.gpvId,
      displayName: existing.gpvCode,
      before: toProviderAuditRecord(existing),
      after: toProviderAuditRecord(updated),
      notes: deleted ? 'GST provider soft deleted' : 'GST provider restored',
    });
  }

  /** gpv_code is UNIQUE over every row, so a deleted provider's code is taken too. */
  private async assertCodeIsFree(tx: Prisma.TransactionClient, gpvCode: string): Promise<void> {
    const clash = await tx.gstProvider.findUnique({
      where: { gpvCode },
      select: { gpvId: true, gpvIsDeleted: true },
    });
    if (clash) {
      this.support.conflict(
        'GST provider code already exists',
        'gpvCode',
        clash.gpvIsDeleted
          ? `${gpvCode} belongs to deleted provider ${clash.gpvId}. Restore it instead.`
          : `${gpvCode} is provider ${clash.gpvId}.`,
        GST_CODES.PROVIDER_CODE_DUPLICATE,
      );
    }
  }

  private credentialCount(client: Client, gpvId: string): Promise<number> {
    return client.gstCompanyCredential.count({
      where: { gccGpvId: gpvId, gccIsDeleted: false },
    });
  }

  /** The header with its live services and accounts, and the counts below it. */
  private async load(client: Client, row: GstProvider): Promise<GstProviderPayload> {
    const [services, accounts, errorMapCount, credentialCount] = await Promise.all([
      client.gstProviderService.findMany({
        where: { gpsGpvId: row.gpvId, gpsIsDeleted: false },
        orderBy: [{ gpsService: 'asc' }, { gpsEnvironment: 'asc' }],
      }),
      client.gstProviderAccount.findMany({
        where: { gpaGpvId: row.gpvId, gpaIsDeleted: false },
        orderBy: [{ gpaEnvironment: 'asc' }, { gpaService: { sort: 'asc', nulls: 'first' } }],
      }),
      client.gstProviderErrorMap.count({ where: { gemGpvId: row.gpvId, gemIsDeleted: false } }),
      this.credentialCount(client, row.gpvId),
    ]);
    const endpointCounts = services.length
      ? await client.gstProviderEndpoint.groupBy({
          by: ['gpeGpsId'],
          where: { gpeGpsId: { in: services.map((s) => s.gpsId) }, gpeIsDeleted: false },
          _count: { _all: true },
        })
      : [];
    const endpointsOf = new Map(endpointCounts.map((c) => [c.gpeGpsId, c._count._all]));
    return toProviderPayload(row, {
      services: services.map((s) => toServicePayload(s, endpointsOf.get(s.gpsId) ?? 0)),
      accounts: accounts.map((a) => toAccountPayload(a, row.gpvCode)),
      endpointCount: [...endpointsOf.values()].reduce((sum, n) => sum + n, 0),
      errorMapCount,
      credentialCount,
    });
  }
}
