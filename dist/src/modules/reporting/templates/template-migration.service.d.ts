import { TemplateDefinition } from './dto/template-definition.schema';
export interface MigrationOutcome {
    readonly definition: TemplateDefinition;
    readonly migrated: boolean;
    readonly fromVersion: number;
    readonly toVersion: number;
}
export declare class TemplateMigrationService {
    private readonly logger;
    migrateDefinition(raw: unknown): MigrationOutcome;
    validate(raw: unknown): TemplateDefinition;
    get currentVersion(): number;
    private readVersion;
}
