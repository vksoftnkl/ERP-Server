import { TillPrintService } from '../../../../till/services/till-print.service';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
export declare class TillSessionHeaderProvider implements PrintDataProvider {
    private readonly till;
    readonly code = "till.session.header";
    readonly label = "Till session \u2014 header (Z / X)";
    readonly cardinality: "one";
    constructor(till: TillPrintService);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
export declare class TillSessionTendersProvider implements PrintDataProvider {
    private readonly till;
    readonly code = "till.session.tenders";
    readonly label = "Till session \u2014 tenders";
    readonly cardinality: "many";
    constructor(till: TillPrintService);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare class TillSessionMovementsProvider implements PrintDataProvider {
    private readonly till;
    readonly code = "till.session.movements";
    readonly label = "Till session \u2014 movements";
    readonly cardinality: "many";
    constructor(till: TillPrintService);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare class TillDayHeaderProvider implements PrintDataProvider {
    private readonly till;
    readonly code = "till.day.header";
    readonly label = "Business day \u2014 header (day X / store Z)";
    readonly cardinality: "one";
    constructor(till: TillPrintService);
    resolve(request: ProviderRequest): Promise<PrintRow>;
}
export declare class TillDaySessionsProvider implements PrintDataProvider {
    private readonly till;
    readonly code = "till.day.sessions";
    readonly label = "Business day \u2014 sessions";
    readonly cardinality: "many";
    constructor(till: TillPrintService);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare class TillDayTendersProvider implements PrintDataProvider {
    private readonly till;
    readonly code = "till.day.tenders";
    readonly label = "Business day \u2014 tenders";
    readonly cardinality: "many";
    constructor(till: TillPrintService);
    resolve(request: ProviderRequest): Promise<PrintRow[]>;
}
export declare const TILL_PRINT_PROVIDERS: readonly [typeof TillSessionHeaderProvider, typeof TillSessionTendersProvider, typeof TillSessionMovementsProvider, typeof TillDayHeaderProvider, typeof TillDaySessionsProvider, typeof TillDayTendersProvider];
