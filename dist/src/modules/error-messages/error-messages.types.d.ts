import type { ErrorWordingRow } from '../../common/error-wording/error-wording';
export interface ErrorMessageCataloguePayload {
    version: string | null;
    lang: string;
    unchanged: boolean;
    rows: ErrorWordingRow[];
}
