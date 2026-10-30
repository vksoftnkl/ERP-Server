import type { ErrorWordingRow } from '../../common/error-wording/error-wording';

/** GET /error-messages (notes 120). */
export interface ErrorMessageCataloguePayload {
  /** fixed.error_message_catalogue.emc_version; null before the first load. */
  version: string | null;
  /** The language served: the one asked for, or English when it has no rows yet. */
  lang: string;
  /** `since` was this version: nothing to download. */
  unchanged: boolean;
  rows: ErrorWordingRow[];
}
