import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrintDataProvider } from './print-data-provider.types';

/** The injection token every shipped provider is collected under. */
export const PRINT_DATA_PROVIDERS = Symbol('PRINT_DATA_PROVIDERS');

/**
 * The providers this build knows, by ptd_provider_code.
 *
 * Registration is EXPLICIT — a list in `print-render.module.ts` — rather than a
 * decorator scan. A provider is a named contract that a stored template row
 * points at by string; discovering them by reflection would mean the set of
 * valid provider codes depends on which files happened to be imported, and the
 * failure mode of that is a template that renders on one deployment and 500s on
 * another with no diff to look at.
 */
@Injectable()
export class PrintDataProviderRegistry {
  private readonly logger = new Logger(PrintDataProviderRegistry.name);

  private readonly byCode = new Map<string, PrintDataProvider>();

  constructor(@Inject(PRINT_DATA_PROVIDERS) providers: readonly PrintDataProvider[]) {
    for (const provider of providers) {
      const key = provider.code.toLowerCase();
      const existing = this.byCode.get(key);
      if (existing) {
        // Two providers claiming one code is a build error, and the one that
        // wins would otherwise depend on array order.
        throw new Error(
          `Duplicate print data provider code '${provider.code}': ` +
            `${existing.constructor.name} and ${provider.constructor.name}`,
        );
      }
      this.byCode.set(key, provider);
    }

    this.logger.log(
      `Registered ${this.byCode.size} print data provider(s): ${[...this.byCode.keys()].sort().join(', ')}`,
    );
  }

  has(code: string): boolean {
    return this.byCode.has(code.trim().toLowerCase());
  }

  get(code: string): PrintDataProvider | undefined {
    return this.byCode.get(code.trim().toLowerCase());
  }

  /** Every code, for the error message that names what WAS available. */
  codes(): string[] {
    return [...this.byCode.keys()].sort();
  }

  /** What a designer's dataset picker offers. */
  describe(): Array<{ code: string; label: string; cardinality: 'one' | 'many' }> {
    return [...this.byCode.values()]
      .map((provider) => ({
        code: provider.code,
        label: provider.label,
        cardinality: provider.cardinality,
      }))
      .sort((left, right) => left.code.localeCompare(right.code));
  }
}
