import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import {
  REPORT_DATA_PROVIDER_METADATA,
  ReportDataProviderMetadata,
} from './report-data-provider.decorator';
import { DynamicDatasetSource } from './dynamic/dynamic-dataset.source';
import {
  IReportDataProvider,
  ProviderDescriptor,
  ReportContext,
  ReportRow,
} from './report-data-provider.types';

/**
 * The dataset token -> provider index.
 *
 * Built by discovery at module init, so a provider that exists is a provider the
 * designer can see. The alternative — a hand-maintained array — fails silently:
 * a forgotten entry is a dataset that simply never appears, and nobody notices
 * until a customer asks where a field went.
 *
 * ── Two kinds of provider, one lookup ───────────────────────────────────────
 * COMPILED providers are the decorated classes under impl/. RUNTIME providers
 * are rows of reports.report_dataset, served by DynamicDatasetSource. They meet
 * here and nowhere else: everything downstream — the render service, the
 * templates service, the designer catalogue — asks this registry for a token
 * and cannot tell the two apart.
 *
 * Compiled wins on collision, but a collision cannot actually happen: a runtime
 * token must be namespaced `custom.*` and a compiled one must not be. The
 * precedence below is a belt on top of those braces, not the real defence.
 */
@Injectable()
export class ReportDataProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(ReportDataProviderRegistry.name);

  private readonly providers = new Map<string, IReportDataProvider>();

  private readonly descriptors = new Map<string, ProviderDescriptor>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly dynamic: DynamicDatasetSource,
  ) {}

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance as unknown;
      const metatype = wrapper.metatype;

      if (!instance || typeof instance !== 'object' || !metatype) {
        continue;
      }

      const metadata = this.reflector.get<ReportDataProviderMetadata | undefined>(
        REPORT_DATA_PROVIDER_METADATA,
        metatype,
      );

      if (!metadata) {
        continue;
      }

      const candidate = instance as Partial<IReportDataProvider>;
      if (
        typeof candidate.resolve !== 'function' ||
        typeof candidate.sampleData !== 'function' ||
        typeof candidate.fields !== 'function'
      ) {
        // A decorated class that does not implement the interface is a bug that
        // would otherwise surface as a 500 the first time a template used it.
        this.logger.error(
          `Provider '${metadata.token}' (${metatype.name}) is decorated but does not implement IReportDataProvider`,
        );
        continue;
      }

      if (this.providers.has(metadata.token)) {
        this.logger.error(
          `Duplicate report dataset token '${metadata.token}' — ${metatype.name} is shadowing an earlier provider`,
        );
        continue;
      }

      const provider = instance as IReportDataProvider;
      this.providers.set(metadata.token, provider);
      this.descriptors.set(metadata.token, {
        token: metadata.token,
        label: metadata.label ?? metadata.token,
        cardinality: metadata.cardinality ?? 'many',
        docTypes: metadata.docTypes ?? [],
        fields: provider.fields(),
      });
    }

    this.logger.log(`Registered ${this.providers.size} report data provider(s)`);
  }

  has(token: string): boolean {
    return this.providers.has(token) || this.dynamic.has(token);
  }

  /** Resolve a provider or fail loudly — a missing token is a template bug. */
  get(token: string): IReportDataProvider {
    const provider = this.providers.get(token) ?? this.dynamic.get(token);
    if (!provider) {
      throw new NotFoundException(
        `Unknown report dataset provider '${token}'. Registered: ${this.listTokens().join(', ')}`,
      );
    }
    return provider;
  }

  /** Descriptors for the designer's dataset picker. */
  list(docType?: string): ProviderDescriptor[] {
    const all = [...this.descriptors.values(), ...this.dynamic.list()];
    const filtered =
      docType === undefined
        ? all
        : all.filter(
            (descriptor) =>
              descriptor.docTypes.length === 0 || descriptor.docTypes.includes(docType),
          );
    return filtered.sort((left, right) => left.token.localeCompare(right.token));
  }

  listTokens(): string[] {
    return [...this.providers.keys(), ...this.dynamic.listTokens()].sort();
  }

  /** Live rows for a token. */
  async resolve(token: string, context: ReportContext): Promise<ReportRow[] | ReportRow> {
    return this.get(token).resolve(context);
  }

  /** Sample rows for a token — no database access, powers designer preview. */
  sample(token: string): ReportRow[] | ReportRow {
    return this.get(token).sampleData();
  }
}
