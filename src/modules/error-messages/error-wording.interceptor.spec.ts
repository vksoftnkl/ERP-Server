import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { setErrorWording, type ErrorWordingRow } from '../../common/error-wording/error-wording';
import { ErrorWordingInterceptor } from './error-wording.interceptor';

const row = (code: string, title: string, lang = 'en'): ErrorWordingRow => ({
  code,
  variant: '',
  lang,
  title,
  line: `${title} line`,
  todo: `${title} todo`,
});

const contextFor = (request: object, type = 'http') => {
  const switchToHttp = jest.fn(() => ({ getRequest: () => request }));
  const context = { getType: () => type, switchToHttp } as unknown as ExecutionContext;
  return { context, switchToHttp };
};

const handlerOf = (body: unknown) => {
  const handler = { handle: jest.fn(() => of(body)) };
  return handler as typeof handler & CallHandler;
};

describe('ErrorWordingInterceptor', () => {
  const interceptor = new ErrorWordingInterceptor();

  beforeEach(() =>
    setErrorWording(
      [row('VALIDATION_MIN', 'Wrong amount'), row('VALIDATION_MIN', 'tamil', 'ta')],
      '2026-10-15.1',
    ),
  );
  afterEach(() => setErrorWording([], null));

  it('words each coded warning and refusal of a success body', async () => {
    const body = {
      success: true,
      data: {
        canPost: false,
        warnings: [{ code: 'VALIDATION_MIN', level: 'WARN', message: 'below minimum' }],
        refusals: [{ code: 'SALES_BILL_POSTED', message: 'Bill is posted' }],
      },
    };
    const { context } = contextFor({ headers: {} });

    const worded = (await lastValueFrom(interceptor.intercept(context, handlerOf(body)))) as {
      data: { warnings: object[]; refusals: object[] };
    };

    expect(worded.data.warnings[0]).toEqual({
      code: 'VALIDATION_MIN',
      level: 'WARN',
      message: 'below minimum',
      user: { title: 'Wrong amount', line: 'Wrong amount line', todo: 'Wrong amount todo' },
    });
    // A code with no row gets no `user` block.
    expect(worded.data.refusals[0]).not.toHaveProperty('user');
    // The handler's own body is never touched.
    expect(body.data.warnings[0]).not.toHaveProperty('user');
  });

  it.each([
    ['the query', { query: { lang: 'ta' }, headers: {} }],
    ['Accept-Language', { headers: { 'accept-language': 'ta-IN,en;q=0.8' } }],
  ])('words in the language %s asks for', async (_label, request) => {
    const body = { success: true, data: { warnings: [{ code: 'VALIDATION_MIN' }] } };
    const { context } = contextFor(request);

    const worded = await lastValueFrom(interceptor.intercept(context, handlerOf(body)));

    expect(worded).toHaveProperty('data.warnings.0.user.title', 'tamil');
  });

  it('hands back a body with no warnings or refusals as it was', async () => {
    const body = { success: true, data: { id: 7 } };
    const { context } = contextFor({ headers: {} });

    await expect(lastValueFrom(interceptor.intercept(context, handlerOf(body)))).resolves.toBe(
      body,
    );
  });

  it('leaves a call that is not HTTP alone', () => {
    const handler = handlerOf({ data: { warnings: [{ code: 'VALIDATION_MIN' }] } });
    const { context, switchToHttp } = contextFor({}, 'rpc');

    const result = interceptor.intercept(context, handler);

    expect(result).toBe(handler.handle.mock.results[0].value);
    expect(switchToHttp).not.toHaveBeenCalled();
  });
});
