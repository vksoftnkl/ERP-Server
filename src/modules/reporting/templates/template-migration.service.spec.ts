import { TemplateMigrationService } from './template-migration.service';
import { SCHEMA_VERSION } from './dto/template-definition.schema';

const validDefinition = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  layoutMode: 'GRAPHIC',
  paper: {
    code: 'A4',
    widthMm: 210,
    heightMm: 297,
    orientation: 'PORTRAIT',
    margins: { top: 10, right: 8, bottom: 12, left: 8 },
  },
  datasets: [{ name: 'items', provider: 'p', cardinality: 'many' }],
  bands: [
    {
      type: 'DETAIL',
      dataset: 'items',
      heightMm: 6,
      elements: [{ id: 'd', kind: 'FIELD', x: 8, y: 0, w: 60, h: 5, value: '{{ row.n }}' }],
    },
  ],
  ...overrides,
});

describe('TemplateMigrationService', () => {
  const service = new TemplateMigrationService();

  it('passes a current-version definition through unchanged', () => {
    const outcome = service.migrateDefinition(validDefinition());
    expect(outcome.migrated).toBe(false);
    expect(outcome.fromVersion).toBe(SCHEMA_VERSION);
    expect(outcome.toVersion).toBe(SCHEMA_VERSION);
    expect(outcome.definition.bands).toHaveLength(1);
  });

  it('treats a definition with no version as v1', () => {
    // A pre-versioning definition can only be v1, because v1 is what existed
    // when versions were not written.
    const { schemaVersion, ...noVersion } = validDefinition();
    void schemaVersion;
    const outcome = service.migrateDefinition(noVersion);
    expect(outcome.fromVersion).toBe(1);
  });

  it('refuses a definition from a newer build', () => {
    // The rollback hazard: a newer schema may have moved a field this build
    // would silently drop. Refusing is safer than guessing.
    expect(() =>
      service.migrateDefinition(validDefinition({ schemaVersion: SCHEMA_VERSION + 5 })),
    ).toThrow(/newer release/);
  });

  it('rejects a non-object', () => {
    expect(() => service.migrateDefinition(null)).toThrow(/not an object/);
    expect(() => service.migrateDefinition([])).toThrow(/not an object/);
    expect(() => service.migrateDefinition('a string')).toThrow(/not an object/);
  });

  it('validates after migrating and reports the path', () => {
    const broken = validDefinition({ bands: [] });
    expect(() => service.migrateDefinition(broken)).toThrow(/failed validation|bands/);
  });

  it('validate() rejects a bad definition with a path-qualified message', () => {
    expect(() => service.validate({ schemaVersion: 1, layoutMode: 'NONSENSE' })).toThrow(
      /Invalid template/,
    );
  });
});
