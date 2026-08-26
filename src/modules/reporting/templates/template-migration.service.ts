import { Injectable, Logger } from '@nestjs/common';
import {
  SCHEMA_VERSION,
  TemplateDefinition,
  templateDefinitionSchema,
} from './dto/template-definition.schema';

/**
 * Forward migration of stored template definitions.
 *
 * Risk R7: a saved template outlives the schema that produced it. A customer's
 * customised invoice is worth more to them than the release that made it, so
 * "just re-create it" is not an option — every read has to migrate.
 *
 * The rule this enforces: a definition is migrated ON READ, never in a
 * batch job. A batch migration has to succeed for every row of every tenant at
 * once or leave the estate half-converted; migrating on read means a template
 * nobody opens costs nothing, and a template that fails to migrate fails
 * loudly for one document rather than silently for a whole deploy.
 *
 * Adding a version:
 *   1. bump SCHEMA_VERSION in the schema file
 *   2. add a MIGRATIONS entry keyed by the version it migrates FROM
 *   3. add a fixture to template-migration.service.spec.ts
 * Never edit an existing migration. It has already run against real data.
 */

/** A migration takes a definition at version N and returns one at N+1. */
type Migration = (definition: Record<string, unknown>) => Record<string, unknown>;

/**
 * Keyed by the version being migrated FROM.
 *
 * Empty at schemaVersion 1, which is correct and not an oversight: there is no
 * earlier version to come from. The machinery exists now so that the FIRST
 * breaking change is a two-line addition rather than a retrofit under pressure.
 */
const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // 1: (definition) => ({ ...definition, schemaVersion: 2, /* ... */ }),
};

export interface MigrationOutcome {
  readonly definition: TemplateDefinition;
  /** True when the stored JSON was at an older version and was upgraded. */
  readonly migrated: boolean;
  readonly fromVersion: number;
  readonly toVersion: number;
}

@Injectable()
export class TemplateMigrationService {
  private readonly logger = new Logger(TemplateMigrationService.name);

  /**
   * Migrate raw stored JSON up to the current version and validate it.
   *
   * Throws on a definition that cannot be migrated or cannot be validated
   * afterwards. The caller decides what that means — for a print request it is
   * a fall back to the system default template; for a designer load it is an
   * error the user must see.
   */
  migrateDefinition(raw: unknown): MigrationOutcome {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Template definition is not an object');
    }

    let working = { ...(raw as Record<string, unknown>) };
    const fromVersion = this.readVersion(working);
    // A pre-versioning definition carries no schemaVersion field at all. Stamp
    // the inferred version so the value is present for validation and for every
    // migration step, which key off it.
    working.schemaVersion = fromVersion;

    if (fromVersion > SCHEMA_VERSION) {
      // A definition written by a NEWER build. This happens on a rollback, and
      // guessing is worse than refusing: the newer schema may have moved a
      // field this build would silently drop.
      throw new Error(
        `Template definition is at schemaVersion ${fromVersion} but this build understands ` +
          `at most ${SCHEMA_VERSION}. It was written by a newer release; roll forward rather ` +
          'than opening it here.',
      );
    }

    let current = fromVersion;
    while (current < SCHEMA_VERSION) {
      const migration = MIGRATIONS[current];
      if (!migration) {
        throw new Error(
          `No migration registered from template schemaVersion ${current} to ${current + 1}`,
        );
      }
      working = migration(working);
      const next = this.readVersion(working);
      if (next <= current) {
        // A migration that does not advance the version would loop forever.
        throw new Error(
          `Migration from schemaVersion ${current} did not advance the version (got ${next})`,
        );
      }
      current = next;
    }

    const parsed = templateDefinitionSchema.safeParse(working);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      throw new Error(
        `Template definition failed validation after migration from v${fromVersion}: ${issues}`,
      );
    }

    const migrated = fromVersion !== SCHEMA_VERSION;
    if (migrated) {
      this.logger.log(`Migrated template definition v${fromVersion} -> v${SCHEMA_VERSION}`);
    }

    return {
      definition: parsed.data,
      migrated,
      fromVersion,
      toVersion: SCHEMA_VERSION,
    };
  }

  /** Validate a definition without migrating. Used on the save path. */
  validate(raw: unknown): TemplateDefinition {
    const parsed = templateDefinitionSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 10)
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      throw new Error(`Invalid template definition: ${issues}`);
    }
    return parsed.data;
  }

  get currentVersion(): number {
    return SCHEMA_VERSION;
  }

  private readVersion(definition: Record<string, unknown>): number {
    const raw = definition.schemaVersion;
    const version = typeof raw === 'number' ? raw : Number(raw);
    // A definition with no version at all predates versioning. Treating it as
    // v1 is the only reading that can be right, since v1 is what existed then.
    return Number.isInteger(version) && version >= 1 ? version : 1;
  }
}
