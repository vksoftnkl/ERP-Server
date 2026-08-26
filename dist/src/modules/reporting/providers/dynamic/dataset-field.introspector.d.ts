import { FieldDef } from 'pg';
import { FieldMeta, FieldType, ReportRow } from '../report-data-provider.types';
export declare const humaniseColumnName: (name: string) => string;
export declare const fieldTypeForOid: (dataTypeId: number) => FieldType;
export declare const introspectFields: (descriptors: readonly FieldDef[], overrides?: readonly FieldMeta[]) => FieldMeta[];
export declare const findDuplicateColumns: (descriptors: readonly FieldDef[]) => string[];
export declare const synthesiseSampleRows: (fields: readonly FieldMeta[], rowCount: number) => ReportRow[];
