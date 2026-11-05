import { FreightChargeOption, NameIdOption } from '../types/master-lookup-api.types';
import { LookupRow } from '../types/master-lookup-internal.types';
export declare function toOption(id: string, name: string | null | undefined, options?: {
    fallbackNameToId?: boolean;
}): NameIdOption;
export declare function sortOptionsById(options: NameIdOption[]): NameIdOption[];
export declare function serializeLookupRow(row: LookupRow): Record<string, unknown>;
export declare function toDateOnly(value: Date | null | undefined): string | null;
export declare function formatBilledDate(billedDate: Date | null): string | null;
export declare function toFreightChargeOption(row: {
    frId: string;
    frFromKm: number | null;
    frToKm: number | null;
    frFreightChrg: unknown;
    frFromWeight: unknown;
    frToWeight: unknown;
}): FreightChargeOption;
