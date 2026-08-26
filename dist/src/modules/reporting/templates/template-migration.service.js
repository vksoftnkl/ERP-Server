"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TemplateMigrationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateMigrationService = void 0;
const common_1 = require("@nestjs/common");
const template_definition_schema_1 = require("./dto/template-definition.schema");
const MIGRATIONS = {};
let TemplateMigrationService = TemplateMigrationService_1 = class TemplateMigrationService {
    logger = new common_1.Logger(TemplateMigrationService_1.name);
    migrateDefinition(raw) {
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
            throw new Error('Template definition is not an object');
        }
        let working = { ...raw };
        const fromVersion = this.readVersion(working);
        working.schemaVersion = fromVersion;
        if (fromVersion > template_definition_schema_1.SCHEMA_VERSION) {
            throw new Error(`Template definition is at schemaVersion ${fromVersion} but this build understands ` +
                `at most ${template_definition_schema_1.SCHEMA_VERSION}. It was written by a newer release; roll forward rather ` +
                'than opening it here.');
        }
        let current = fromVersion;
        while (current < template_definition_schema_1.SCHEMA_VERSION) {
            const migration = MIGRATIONS[current];
            if (!migration) {
                throw new Error(`No migration registered from template schemaVersion ${current} to ${current + 1}`);
            }
            working = migration(working);
            const next = this.readVersion(working);
            if (next <= current) {
                throw new Error(`Migration from schemaVersion ${current} did not advance the version (got ${next})`);
            }
            current = next;
        }
        const parsed = template_definition_schema_1.templateDefinitionSchema.safeParse(working);
        if (!parsed.success) {
            const issues = parsed.error.issues
                .slice(0, 5)
                .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
                .join('; ');
            throw new Error(`Template definition failed validation after migration from v${fromVersion}: ${issues}`);
        }
        const migrated = fromVersion !== template_definition_schema_1.SCHEMA_VERSION;
        if (migrated) {
            this.logger.log(`Migrated template definition v${fromVersion} -> v${template_definition_schema_1.SCHEMA_VERSION}`);
        }
        return {
            definition: parsed.data,
            migrated,
            fromVersion,
            toVersion: template_definition_schema_1.SCHEMA_VERSION,
        };
    }
    validate(raw) {
        const parsed = template_definition_schema_1.templateDefinitionSchema.safeParse(raw);
        if (!parsed.success) {
            const issues = parsed.error.issues
                .slice(0, 10)
                .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
                .join('; ');
            throw new Error(`Invalid template definition: ${issues}`);
        }
        return parsed.data;
    }
    get currentVersion() {
        return template_definition_schema_1.SCHEMA_VERSION;
    }
    readVersion(definition) {
        const raw = definition.schemaVersion;
        const version = typeof raw === 'number' ? raw : Number(raw);
        return Number.isInteger(version) && version >= 1 ? version : 1;
    }
};
exports.TemplateMigrationService = TemplateMigrationService;
exports.TemplateMigrationService = TemplateMigrationService = TemplateMigrationService_1 = __decorate([
    (0, common_1.Injectable)()
], TemplateMigrationService);
//# sourceMappingURL=template-migration.service.js.map