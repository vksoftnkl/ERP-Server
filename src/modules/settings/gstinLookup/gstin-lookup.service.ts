import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  buildSettingsErrorResponse,
  throwSettingsNotFound,
} from 'src/common/utils/module-service.utils';
import { GST_REG_TYPES, type GstRegType } from '../shared/gst-registration';
import {
  GstinLookupAddress,
  GstinLookupErrorDetail,
  GstinLookupPayload,
} from './types/gstin-lookup.types';

const LOOKUP_TIMEOUT_MS = 10_000;
/** Where the provider may nest the taxpayer record. */
const DATA_KEYS = ['data', 'taxpayer', 'result'] as const;
/** Keys only a taxpayer record carries. */
const TAXPAYER_KEYS = ['lgnm', 'tradeNam', 'tradeName', 'pradr', 'dty'] as const;

type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** The provider's "search taxpayer" call and the ASP login it is made as. */
interface LookupConfig {
  endpoint: URL;
  aspId: string;
  aspPassword: string;
}

/**
 * Notes 72 C6 — GSTIN search on the server, so the Qt client (and React,
 * which until now called the provider from its own Next route with the ASP
 * password compiled in) look a GSTIN up the same way.
 *
 * WHERE and AS WHOM: env only — GST_LOOKUP_ENDPOINT (the provider's full search
 * URL, e.g. https://gstsandbox.charteredinfo.com/commonapi/v1.1/search) and
 * GST_LOOKUP_ASP_ID / GST_LOOKUP_ASP_PASSWORD; a missing one is a 503. The
 * first-draft fixed.gsp_provider_master that used to hold them was dropped
 * (20261002140000); the public.gst_* tables take over once their credential
 * encryption exists.
 * WHICH SOURCE GSTIN (the provider's `Gstin`): the request company's own GSTIN,
 * else env GST_LOOKUP_SOURCE_GSTIN.
 *
 * The provider takes the password in the query string, so the URL is never
 * logged or echoed.
 */
@Injectable()
export class GstinLookupService {
  private readonly logger = new Logger(GstinLookupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async search(gstin: string): Promise<GstinLookupPayload> {
    const config = this.resolveConfig();
    const sourceGstin = await this.resolveSourceGstin();
    const url = this.buildUrl(config, sourceGstin, gstin);
    const host = config.endpoint.host;

    let ok: boolean;
    let status: number;
    let body: unknown;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
        headers: { Accept: 'application/json, text/plain, */*' },
      });
      ok = response.ok;
      status = response.status;
      body = this.parseBody(await response.text());
    } catch (error) {
      this.logger.warn(
        `GSTIN search via ${host} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.throwUpstream('Unable to reach the GST service right now');
    }
    if (!ok) {
      this.logger.warn(`GSTIN search via ${host} answered HTTP ${status}`);
      this.throwUpstream(this.messageOf(body, `The GST service answered HTTP ${status}`));
    }
    const data = this.extractTaxpayer(body);
    if (!data) {
      throwSettingsNotFound<GstinLookupErrorDetail>(
        'GST details not found',
        'gstin',
        this.messageOf(body, `The GST service has no details for GSTIN ${gstin}`),
      );
    }
    return this.toPayload(gstin, data);
  }

  private resolveConfig(): LookupConfig {
    const endpoint = text(process.env.GST_LOOKUP_ENDPOINT);
    const aspId = text(process.env.GST_LOOKUP_ASP_ID);
    const aspPassword = process.env.GST_LOOKUP_ASP_PASSWORD || null;
    if (!endpoint || !aspId || !aspPassword) {
      const missing = Object.entries({
        GST_LOOKUP_ENDPOINT: endpoint,
        GST_LOOKUP_ASP_ID: aspId,
        GST_LOOKUP_ASP_PASSWORD: aspPassword,
      })
        .filter(([, value]) => !value)
        .map(([name]) => name);
      this.throwUnavailable(`Set ${missing.join(', ')} in the server environment`);
    }
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      this.throwUnavailable('GST_LOOKUP_ENDPOINT is not a valid URL');
    }
    return { endpoint: url, aspId, aspPassword };
  }

  private async resolveSourceGstin(): Promise<string> {
    const companyId = this.requestContextService.getCompanyId();
    const company = companyId
      ? await this.prisma.company.findFirst({
          where: { compId: companyId },
          select: { compGstinNo: true },
        })
      : null;
    const gstin = text(company?.compGstinNo) ?? text(process.env.GST_LOOKUP_SOURCE_GSTIN);
    if (!gstin) {
      this.throwUnavailable(
        'The company has no GSTIN to search as: set it in Company Master, or set GST_LOOKUP_SOURCE_GSTIN',
      );
    }
    return gstin;
  }

  private buildUrl(config: LookupConfig, sourceGstin: string, gstin: string): string {
    const url = new URL(config.endpoint);
    url.searchParams.set('aspid', config.aspId);
    url.searchParams.set('password', config.aspPassword);
    url.searchParams.set('Action', 'TP');
    url.searchParams.set('Gstin', sourceGstin);
    url.searchParams.set('SearchGstin', gstin);
    return url.toString();
  }

  private parseBody(body: string): unknown {
    const trimmed = body.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return trimmed;
    }
  }

  private extractTaxpayer(body: unknown): JsonRecord | null {
    if (!isRecord(body)) {
      return null;
    }
    const looksLikeTaxpayer = (record: JsonRecord) => TAXPAYER_KEYS.some((key) => key in record);
    for (const key of DATA_KEYS) {
      const nested = body[key];
      if (isRecord(nested) && looksLikeTaxpayer(nested)) {
        return nested;
      }
    }
    return looksLikeTaxpayer(body) ? body : null;
  }

  private messageOf(body: unknown, fallback: string): string {
    if (typeof body === 'string') {
      return text(body)?.slice(0, 300) ?? fallback;
    }
    if (isRecord(body)) {
      for (const key of ['message', 'error', 'detail', 'status_desc', 'statusDesc']) {
        const value = text(body[key]);
        if (value) {
          return value.slice(0, 300);
        }
      }
    }
    return fallback;
  }

  private toPayload(gstin: string, data: JsonRecord): GstinLookupPayload {
    const registrationType = text(data.dty);
    return {
      gstin,
      legalName: text(data.lgnm),
      tradeName: text(data.tradeNam) ?? text(data.tradeName),
      status: text(data.sts),
      registrationType,
      gstRegType: this.toGstRegType(registrationType),
      stateCode: gstin.slice(0, 2),
      panNo: gstin.slice(2, 12),
      registeredOn: text(data.rgdt),
      address: this.toAddress(data.pradr),
      raw: data,
    };
  }

  private toAddress(pradr: unknown): GstinLookupAddress | null {
    const addr = isRecord(pradr) && isRecord(pradr.addr) ? pradr.addr : null;
    if (!addr) {
      return null;
    }
    const building = [text(addr.flno), text(addr.bno), text(addr.bnm)].filter(Boolean).join(', ');
    return {
      building: building || null,
      street: text(addr.st),
      locality: text(addr.locality) ?? text(addr.loc),
      city: text(addr.loc) ?? text(addr.dst),
      district: text(addr.dst),
      state: text(addr.stcd),
      pin: text(addr.pncd),
    };
  }

  /** "Regular", "Composition", "SEZ Unit" … onto GST_REG_TYPES; anything else is null. */
  private toGstRegType(registrationType: string | null): GstRegType | null {
    const upper = registrationType?.toUpperCase() ?? '';
    if (upper.includes('COMPOSITION')) return 'COMPOSITION';
    if (upper.includes('SEZ')) return 'SEZ';
    if (upper.includes('UNREG')) return 'UNREGISTERED';
    if (upper.includes('REGULAR')) return 'REGULAR';
    return (GST_REG_TYPES as readonly string[]).includes(upper) ? (upper as GstRegType) : null;
  }

  private throwUpstream(message: string): never {
    throw new HttpException(
      buildSettingsErrorResponse<GstinLookupErrorDetail>('GST service error', [
        { field: 'gstin', message },
      ]),
      HttpStatus.BAD_GATEWAY,
    );
  }

  private throwUnavailable(message: string): never {
    throw new HttpException(
      buildSettingsErrorResponse<GstinLookupErrorDetail>('GSTIN search is not configured', [
        { field: 'gstin', message },
      ]),
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
