import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import {
  DEFAULT_ACTOR,
  isUniqueConstraintError,
  throwSettingsBadRequest,
  throwSettingsConflict,
  throwSettingsNotFound,
  toNullableNumber,
  violatedCheckOf,
  violatedConstraintOf,
} from 'src/common/utils/module-service.utils';
import { GST_CODES, type GstMenu } from './gst-config.constants';
import { GstCryptoService } from './gst-crypto.service';
import type { GstErrorDetail } from '../types/gst-config.types';

/** The field each gst_* CHECK guards, for a 400 that names it. */
const CHECK_FIELDS: Record<string, string> = {
  ck_gpv_code_shape: 'gpvCode',
  ck_gpv_timeout: 'gpvTimeoutMs',
  ck_gpv_retries: 'gpvMaxRetries',
  ck_gpv_rate_limit: 'gpvRateLimitPerMin',
  ck_gps_service: 'gpsService',
  ck_gps_environment: 'gpsEnvironment',
  ck_gps_auth_scheme: 'gpsAuthScheme',
  ck_gps_payload_encryption: 'gpsPayloadEncryption',
  ck_gps_base_url: 'gpsBaseUrl',
  ck_gps_ttl: 'gpsTokenTtlMinutes',
  ck_gps_margin: 'gpsRefreshMarginMinutes',
  ck_gps_timeout: 'gpsTimeoutMs',
  ck_gps_retries: 'gpsMaxRetries',
  ck_gpa_environment: 'gpaEnvironment',
  ck_gpa_service: 'gpaService',
  ck_gpa_key_ver: 'keyVersion',
  ck_gpa_validity: 'gpaValidUpto',
  ck_gpa_balance: 'gpaCreditBalance',
  ck_gpe_action: 'gpeAction',
  ck_gpe_http_method: 'gpeHttpMethod',
  ck_gpe_path: 'gpePathTemplate',
  ck_gpe_headers: 'gpeHeaders',
  ck_gpe_redact: 'gpeRedactPaths',
  ck_gpe_timeout: 'gpeTimeoutMs',
  ck_gpe_retries: 'gpeMaxRetries',
  ck_gpe_success_pair: 'gpeSuccessValue',
  ck_gfm_direction: 'gfmDirection',
  ck_gfm_data_type: 'gfmDataType',
  ck_gfm_transform: 'gfmTransform',
  ck_gfm_path: 'gfmTheirPath',
  ck_gfm_required_default: 'gfmDefaultValue',
  ck_gem_service: 'gemService',
  ck_gem_our_code: 'gemOurCode',
  ck_gem_severity: 'gemSeverity',
  ck_gem_treat_as: 'gemTreatAs',
  ck_gem_recovery_action: 'gemRecoveryAction',
  ck_gem_extract_pair: 'gemExtractPath',
  ck_gem_extract_path: 'gemExtractPath',
  ck_gem_retry_after: 'gemRetryAfterSeconds',
  ck_gcc_service: 'gccService',
  ck_gcc_environment: 'gccEnvironment',
  ck_gcc_client_pair: 'clientSecret',
  ck_gcc_priority: 'gccPriority',
  ck_gcc_key_ver: 'keyVersion',
  ck_gcc_validity: 'gccValidUpto',
};

/** One write-only secret: the body key the client sends and the `_enc` column behind it. */
export interface GstSecretSpec {
  key: string;
  column: string;
}

export interface GstSecretWrite {
  /** `_enc` column → ciphertext or null; only the columns that change. */
  data: Record<string, string | null>;
  /** The row's key version after the write. */
  keyVersion: number;
  /** Body keys given a new value (not cleared, not kept). */
  written: string[];
}

/**
 * What every gst_* config service shares: the menu rights (notes 79 §2), the
 * actor, the audit row, the refusals and the write-only secret contract (§3).
 */
@Injectable()
export class GstConfigSupport {
  private readonly menuIds = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly auditLogService: AuditLogService,
    private readonly crypto: GstCryptoService,
  ) {}

  /** 403 GST_RIGHT_<RIGHT> unless the caller holds `right` on the menu. */
  async requireRight(menu: GstMenu, right: MenuRight, action: string): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: await this.menuIdOf(menu),
      right,
      codePrefix: 'GST',
      action,
    });
  }

  actor(): string {
    return this.requestContext.getUserId() ?? DEFAULT_ACTOR;
  }

  async audit(
    tx: Prisma.TransactionClient,
    entry: {
      action: 'New' | 'update' | 'cancel';
      table: string;
      screen: string;
      pk: string;
      displayName: string;
      before: object | null;
      after: object;
      notes: string;
    },
  ): Promise<void> {
    await this.auditLogService.logEntityChange(
      {
        action: entry.action,
        tableName: entry.table,
        screenName: entry.screen,
        screenType: 'master',
        pk: entry.pk,
        displayName: entry.displayName,
        // Payload projections only: they carry has* flags, never a secret.
        originalRecord: entry.before,
        modifiedRecord: entry.after,
        userId: this.actor(),
        notes: entry.notes,
      },
      tx,
    );
  }

  notFound(field: string, what: string, id: string): never {
    throwSettingsNotFound<GstErrorDetail>(
      `${what} not found`,
      field,
      `No ${what.toLowerCase()} found with id ${id}`,
    );
  }

  conflict(message: string, field: string, detail: string, code: string): never {
    throwSettingsConflict<GstErrorDetail>(message, [{ field, message: detail, code }]);
  }

  badRequest(errors: GstErrorDetail[]): never {
    throwSettingsBadRequest<GstErrorDetail>('Validation failed', errors);
  }

  /** 409 on a write to a deleted row: restore first (only the two roots have /restore). */
  refuseDeleted(field: string, what: string, id: string): never {
    this.conflict(
      `${what} is deleted`,
      field,
      `${what} ${id} is deleted. It cannot be edited or used as a parent.`,
      GST_CODES.ALREADY_DELETED,
    );
  }

  /** A child row keeps its parent: moving it would carry its own children along unseen. */
  refuseParentChange(field: string, stored: string): never {
    this.conflict(
      'The parent cannot change',
      field,
      `This row belongs to ${stored}. Create a new row under the other parent instead.`,
      GST_CODES.PARENT_FIXED,
    );
  }

  /**
   * A write the database refused, as the refusal the client can act on: a
   * partial unique index (the race behind an app-side duplicate check) as its
   * 409, a CHECK as a 400 on the field it guards. Anything else returns and the
   * caller rethrows.
   */
  translateWriteError(
    error: unknown,
    uniques: ReadonlyArray<{
      match: readonly string[];
      field: string;
      message: string;
      code: string;
    }>,
  ): void {
    if (isUniqueConstraintError(error)) {
      // An index name, or (Prisma 6 on a partial index) its columns joined by ','.
      const constraint = violatedConstraintOf(error) ?? '';
      const hit =
        uniques.find((u) => u.match.some((m) => constraint.includes(m))) ??
        (uniques.length === 1 ? uniques[0] : undefined);
      if (hit) {
        this.conflict('Duplicate', hit.field, hit.message, hit.code);
      }
      this.conflict(
        'Duplicate',
        'id',
        `Refused by ${constraint || 'a unique index'}.`,
        'GST_DUPLICATE',
      );
    }
    const check = violatedCheckOf(error);
    if (check) {
      this.badRequest([
        { field: CHECK_FIELDS[check] ?? check, message: `refused by ${check}`, code: 'GST_CHECK' },
      ]);
    }
  }

  /**
   * Notes 79 §3, in: each secret key is optional plain text. Absent or "" keeps
   * what is stored; a value is encrypted under the current key; a key named in
   * `clear` becomes NULL. When anything is written, the row's other stored
   * secrets are re-wrapped under the same key, so `*_key_version` stays true for
   * every `_enc` column of the row.
   */
  writeSecrets(params: {
    specs: readonly GstSecretSpec[];
    input: Record<string, unknown>;
    clear: readonly string[] | undefined;
    stored: Record<string, string | null> | null;
    storedVersion: number | null;
  }): GstSecretWrite {
    const clear = new Set(params.clear ?? []);
    const errors: GstErrorDetail[] = [];
    for (const spec of params.specs) {
      const value = params.input[spec.key];
      if (clear.has(spec.key) && typeof value === 'string' && value !== '') {
        errors.push({
          field: spec.key,
          message: `${spec.key} is both given and in clear; send one`,
        });
      }
    }
    if (errors.length) {
      this.badRequest(errors);
    }
    const data: Record<string, string | null> = {};
    const written: string[] = [];
    for (const spec of params.specs) {
      const value = params.input[spec.key];
      if (typeof value === 'string' && value !== '') {
        data[spec.column] = this.crypto.encrypt(value);
        written.push(spec.key);
      } else if (clear.has(spec.key)) {
        data[spec.column] = null;
      }
    }
    const current = this.crypto.currentVersion();
    if (!written.length) {
      return { data, keyVersion: params.storedVersion ?? current, written };
    }
    for (const spec of params.specs) {
      const kept = params.stored?.[spec.column];
      if (spec.column in data || !kept || this.crypto.versionOf(kept) === current) {
        continue;
      }
      data[spec.column] = this.crypto.encrypt(this.crypto.decrypt(kept));
    }
    return { data, keyVersion: current, written };
  }

  private async menuIdOf(menu: GstMenu): Promise<number> {
    const cached = this.menuIds.get(menu.name);
    if (cached !== undefined) {
      return cached;
    }
    const row = await this.prisma.menu.findFirst({
      where: { menuParentId: menu.parent, menuName: menu.name },
      select: { menuId: true },
    });
    if (!row) {
      // No menu row, nobody can hold the right: 0 matches no grant. Not cached,
      // so the row is found once 20261002150000_gst_menus has run.
      return 0;
    }
    this.menuIds.set(menu.name, row.menuId);
    return row.menuId;
  }
}

/** 'YYYY-MM-DD' → the Date Prisma writes into a DATE column as that same day. */
export function toDateOnly(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

/** A DATE column back to 'YYYY-MM-DD'. */
export function fromDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function isoOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function decimalOrNull(value: Prisma.Decimal | null): number | null {
  return toNullableNumber(value);
}

/** The value to write: the DTO's when it was sent, else what is stored, else the default. */
export function keep<T>(sent: T | undefined, stored: T | undefined, fallback: T): T {
  if (sent !== undefined) {
    return sent;
  }
  return stored !== undefined ? stored : fallback;
}
