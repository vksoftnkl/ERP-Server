import { FreightType, LoadingType, LookupModuleKey } from './types/master-lookup-api.types';
export declare const LOADING_TYPES: readonly LoadingType[];
export declare const DEFAULT_LOADING_TYPE: LoadingType;
export declare const FREIGHT_TYPES: readonly FreightType[];
export declare const DEFAULT_FREIGHT_TYPE: FreightType;
export declare const LOOKUP_NAME_NOISE_TOKENS: Set<string>;
export declare const ID_ORDERED_LOOKUP_MODULES: ReadonlySet<LookupModuleKey>;
export declare const CONFIGURED_SQL_TABLE_REPLACEMENTS: Array<[RegExp, string]>;
export declare const MODULE_DROPDOWN_NAME_ALIASES: Record<LookupModuleKey, string[]>;
