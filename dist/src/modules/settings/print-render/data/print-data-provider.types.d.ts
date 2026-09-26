import { RenderContext } from '../types/print-render-api.types';
export type PrintRow = Record<string, unknown>;
export interface ProviderRequest {
    readonly context: RenderContext;
    readonly params: Readonly<Record<string, unknown>>;
    readonly lang: string;
    readonly rowLimit: number;
}
export interface PrintDataProvider {
    readonly code: string;
    readonly label: string;
    readonly cardinality: 'one' | 'many';
    resolve(request: ProviderRequest): Promise<PrintRow[] | PrintRow>;
}
