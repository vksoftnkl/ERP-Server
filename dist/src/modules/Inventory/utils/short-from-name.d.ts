import type { ModuleWriteClient } from "../../../common/utils/module-shared.utils";
import { type CodeSeries } from "../../settings/shared/code-series-lock";
export declare function isEmptyShortName(value: string | null | undefined): boolean;
export declare function shortNameFromName(tx: ModuleWriteClient, series: CodeSeries, name: string, takenStartingWith: (base: string) => Promise<ReadonlyArray<string | null>>): Promise<string | null>;
