import { readFileSync } from 'fs';
import { join } from 'path';
import { AppThemeController } from './app-theme.controller';
import { AppThemeService } from './app-theme.service';
import { APP_THEME_TOKEN_KEYS } from './types/app-theme.types';

describe('AppThemeService.validateTokens', () => {
  const service = new AppThemeService(null as never, null as never, null as never);
  const refusal = (tokens: Record<string, unknown>) => {
    try {
      service.validateTokens(tokens);
    } catch (error) {
      return (error as { response: { errors: Array<{ field: string; message: string }> } }).response
        .errors;
    }
    throw new Error('expected a 400');
  };

  it('has the 33 v1 keys and the 5 v2 brand tints', () => {
    expect(APP_THEME_TOKEN_KEYS).toHaveLength(38);
    expect(APP_THEME_TOKEN_KEYS).toContain('table.txn.selected');
    expect(APP_THEME_TOKEN_KEYS).toEqual(
      expect.arrayContaining([
        'primary.soft',
        'primary.softer',
        'primary.soft.border',
        'primary.pressed.bg',
        'primary.pressed.border',
      ]),
    );
  });

  it('accepts #rrggbb and #rrggbbaa, upper-cases them, and allows keys to be omitted', () => {
    expect(service.validateTokens({ primary: '#7b1113', 'table.selected': '#0078D7CC' })).toEqual({
      primary: '#7B1113',
      'table.selected': '#0078D7CC',
    });
    expect(service.validateTokens({})).toEqual({});
  });

  it('names every unknown key and every non-colour value at once', () => {
    expect(
      refusal({ primary: 'red', 'button.bg': '#FFFFFF', text: null, focus: '#12345' }),
    ).toEqual([
      { field: 'tokens.primary', message: 'not a colour: #rrggbb or #rrggbbaa' },
      { field: 'tokens.button.bg', message: 'unknown token' },
      { field: 'tokens.text', message: 'not a colour: #rrggbb or #rrggbbaa' },
      { field: 'tokens.focus', message: 'not a colour: #rrggbb or #rrggbbaa' },
    ]);
  });
});

describe('AppThemeController /effective — the ETag round trip (plan §3.3)', () => {
  const payload = {
    thmId: 3,
    thmName: 'BLUE',
    thmBase: 'LIGHT',
    thmIsDefault: false,
    thmIsActive: true,
    thmIsDeleted: false,
    thmRemarks: null,
    tokens: { primary: '#1D4ED8' },
    usedByCount: 3,
    thmModifiedOn: '2026-09-30T13:20:00.000Z',
    resolvedFrom: 'COMPANY' as const,
    template: {
      tplId: 1,
      tplQss: 'QDialog { color: {{text}}; }',
      tplModifiedOn: '2026-10-01T08:00:00.000Z',
    },
  };
  const ETAG = '"3:2026-09-30T13:20:00.000Z:COMPANY:1:2026-10-01T08:00:00.000Z"';
  const make = () => {
    const service = { effective: jest.fn().mockResolvedValue(payload) };
    const res = { setHeader: jest.fn(), status: jest.fn() };
    return { controller: new AppThemeController(service as never), res };
  };

  it('answers the theme with an ETag and no-store-without-revalidation caching', async () => {
    const { controller, res } = make();
    const answer = await controller.effective({ companyId: 'c' }, undefined, res as never);
    expect(answer?.data).toEqual(payload);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=0');
    expect(res.setHeader).toHaveBeenCalledWith('ETag', ETAG);
  });

  it('answers a bare 304 when the client already has that version', async () => {
    const { controller, res } = make();
    const answer = await controller.effective({ companyId: 'c' }, ETAG, res as never);
    expect(answer).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(304);
  });

  it('a saved template is a new version: the old ETag no longer matches', async () => {
    const { controller, res } = make();
    const answer = await controller.effective(
      { companyId: 'c' },
      '"3:2026-09-30T13:20:00.000Z:COMPANY:1:2026-09-30T00:00:00.000Z"',
      res as never,
    );
    expect(answer?.data.template?.tplId).toBe(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('AppThemeController /bootstrap — no token, tokens + template only', () => {
  it('answers with an ETag of the two versions, and 304 on a match', async () => {
    const data = {
      tokens: { primary: '#7B1113' },
      thmModifiedOn: '2026-09-30T13:20:00.000Z',
      template: { tplId: 1, tplQss: 'x', tplModifiedOn: '2026-10-01T08:00:00.000Z' },
    };
    const service = { bootstrap: jest.fn().mockResolvedValue(data) };
    const controller = new AppThemeController(service as never);
    const res = { setHeader: jest.fn(), status: jest.fn() };
    expect((await controller.bootstrap(undefined, res as never))?.data).toEqual(data);
    const etag = '"2026-09-30T13:20:00.000Z:1:2026-10-01T08:00:00.000Z"';
    expect(res.setHeader).toHaveBeenCalledWith('ETag', etag);
    expect(await controller.bootstrap(etag, res as never)).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(304);
  });
});

describe('AppThemeService.validateTemplate — plan-app-theme-template.md §4.2', () => {
  const service = new AppThemeService(null as never, null as never, null as never);
  const errors = (qss: string) => {
    try {
      service.validateTemplate(qss);
    } catch (error) {
      return (
        error as { response: { errors: Array<{ field: string; message: string }> } }
      ).response.errors.map((e) => e.message);
    }
    return [];
  };

  it('passes the seed the migration stores (theme/seed-template-v1.qss)', () => {
    const migration = readFileSync(
      join(
        __dirname,
        '../../../../prisma/migrations/20261001140000_app_theme_template/migration.sql',
      ),
      'utf8',
    );
    const seed = migration.split('$qss$')[1];
    expect(seed.length).toBeGreaterThan(10_000);
    expect(errors(seed)).toEqual([]);
  });

  it('names each unknown placeholder once, and takes the size keys', () => {
    expect(
      errors(
        'A { color: {{primry}}; font-size: {{size.font}}px; }\nB { color: {{ primary }}; border: {{primry}}; }',
      ),
    ).toEqual(['unknown placeholder {{primry}}', 'unknown placeholder {{ primary }}']);
  });

  it('finds an unbalanced brace by line, ignoring braces in comments, strings and placeholders', () => {
    expect(errors('/* { */\nA { content: "}"; color: {{text}}; }\nB { color: red;\n')).toEqual([
      'the { on line 3 is never closed',
    ]);
    expect(errors('A { color: red; }\n}\n')).toEqual(['the } on line 2 closes nothing']);
    expect(errors('A { color: red; } /* never closed')).toEqual([
      'the comment opened on line 1 is never closed',
    ]);
  });

  it('allows url() only to :/ resources, quoted or not, and ignores one in a comment', () => {
    expect(
      errors(
        'A { image: url(:/icons/a.svg); }\nB { image: url(":/icons/b.svg"); }\n/* url(http://x) */',
      ),
    ).toEqual([]);
    expect(errors('A { image: url(https://cdn.example/x.png); }')).toEqual([
      'url(https://cdn.example/x.png) on line 1 is not a :/ resource',
    ]);
  });

  it('refuses more than 512 KB', () => {
    expect(errors('/*' + 'x'.repeat(512 * 1024) + '*/')).toEqual([
      'at most 512 KB; this one is 513 KB',
    ]);
  });
});
