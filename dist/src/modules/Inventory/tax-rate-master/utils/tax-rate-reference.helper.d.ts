import { Prisma } from '@prisma/client';
import { ModuleErrorDetail } from "../../../../common/utils/module-service.utils";
export interface TaxRateRef {
    taxId: string;
    field: string;
}
type TaxRateRefClient = Pick<Prisma.TransactionClient, 'taxRateMaster'>;
export declare function assertTaxRateRefs(client: TaxRateRefClient, refs: readonly TaxRateRef[], message?: string): Promise<void>;
export declare function collectTaxRateRefErrors(client: TaxRateRefClient, refs: readonly TaxRateRef[]): Promise<ModuleErrorDetail[]>;
export declare function collectTaxRateRefs<TLine>(lines: readonly TLine[], taxIdOf: (line: TLine) => string | null | undefined, fieldOf: (index: number) => string): TaxRateRef[];
export {};
