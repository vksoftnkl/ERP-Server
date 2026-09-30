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

  it('has the 33 v1 keys', () => {
    expect(APP_THEME_TOKEN_KEYS).toHaveLength(33);
    expect(APP_THEME_TOKEN_KEYS).toContain('table.txn.selected');
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
  };
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
    expect(res.setHeader).toHaveBeenCalledWith('ETag', '"3:2026-09-30T13:20:00.000Z:COMPANY"');
  });

  it('answers a bare 304 when the client already has that version', async () => {
    const { controller, res } = make();
    const answer = await controller.effective(
      { companyId: 'c' },
      '"3:2026-09-30T13:20:00.000Z:COMPANY"',
      res as never,
    );
    expect(answer).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(304);
  });
});
