import { SetMetadata } from '@nestjs/common';

/**
 * Marks a class as a report data provider under a dataset token.
 *
 * Registration is by discovery rather than a hand-maintained array: a provider
 * that exists but was forgotten in a registry list is a dataset that silently
 * does not appear in the designer, and that failure is invisible until a
 * customer asks why a field is missing.
 */

export const REPORT_DATA_PROVIDER_METADATA = 'reporting:data-provider';

export interface ReportDataProviderOptions {
  /** Human label for the designer. Defaults to the token. */
  readonly label?: string;
  readonly cardinality?: 'one' | 'many';
  /** Document types this provider serves. Empty/absent = any. */
  readonly docTypes?: readonly string[];
}

export interface ReportDataProviderMetadata extends ReportDataProviderOptions {
  readonly token: string;
}

export const ReportDataProvider = (token: string, options: ReportDataProviderOptions = {}) =>
  SetMetadata<string, ReportDataProviderMetadata>(REPORT_DATA_PROVIDER_METADATA, {
    token,
    ...options,
  });
