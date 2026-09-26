import { PrintDataProvider } from './print-data-provider.types';
export declare const PRINT_DATA_PROVIDERS: unique symbol;
export declare class PrintDataProviderRegistry {
    private readonly logger;
    private readonly byCode;
    constructor(providers: readonly PrintDataProvider[]);
    has(code: string): boolean;
    get(code: string): PrintDataProvider | undefined;
    codes(): string[];
    describe(): Array<{
        code: string;
        label: string;
        cardinality: 'one' | 'many';
    }>;
}
