import type { Request } from 'express';
import type { ErrorWordingRow } from '../../common/error-wording/error-wording';
import { ErrorMessagesController } from './error-messages.controller';
import { ErrorMessageService } from './error-messages.service';
import type { ErrorMessageCataloguePayload } from './error-messages.types';

const VERSION = '2026-10-15.1';

const row = (code: string): ErrorWordingRow => ({
  code,
  variant: '',
  lang: 'en',
  title: code,
  line: `${code} line`,
  todo: `${code} todo`,
});

const payload = (
  overrides: Partial<ErrorMessageCataloguePayload> = {},
): ErrorMessageCataloguePayload => ({
  version: VERSION,
  lang: 'en',
  unchanged: false,
  rows: [row('HOLD_NOT_FOUND'), row('TILL_SESSION_NOT_OPEN'), row('VALIDATION_*')],
  ...overrides,
});

const requestWith = (headers: Record<string, string> = {}) => ({ headers }) as unknown as Request;

describe('ErrorMessagesController', () => {
  let service: { catalogue: jest.Mock };
  let controller: ErrorMessagesController;

  beforeEach(() => {
    service = { catalogue: jest.fn().mockResolvedValue(payload()) };
    controller = new ErrorMessagesController(service as unknown as ErrorMessageService);
  });

  describe('the language it asks for', () => {
    it('takes the query language over Accept-Language, and passes since on', async () => {
      await controller.catalogue(
        { lang: 'ta', since: VERSION },
        requestWith({ 'accept-language': 'en-GB' }),
      );

      expect(service.catalogue).toHaveBeenCalledWith('ta', VERSION);
    });

    it('takes the first Accept-Language tag when the query names none', async () => {
      await controller.catalogue({}, requestWith({ 'accept-language': 'ta-IN,en;q=0.8' }));

      expect(service.catalogue).toHaveBeenCalledWith('ta', null);
    });

    it('treats a null lang and since as not sent', async () => {
      await controller.catalogue(
        { lang: null, since: null },
        requestWith({ 'accept-language': 'ta' }),
      );

      expect(service.catalogue).toHaveBeenCalledWith('ta', null);
    });

    it.each([
      ['nothing names a language', {}],
      ['the query language is not a two-letter tag', { lang: 'english' }],
    ])('asks for English when %s', async (_label, query) => {
      await controller.catalogue(query, requestWith());

      expect(service.catalogue).toHaveBeenCalledWith('en', null);
    });
  });

  describe('the answer', () => {
    it('wraps the catalogue and counts the rows it serves', async () => {
      await expect(controller.catalogue({}, requestWith())).resolves.toEqual({
        success: true,
        message: `3 error message(s), version ${VERSION}`,
        data: payload(),
      });
    });

    it('says unchanged when the app already holds the version', async () => {
      service.catalogue.mockResolvedValue(payload({ unchanged: true, rows: [] }));

      await expect(controller.catalogue({ since: VERSION }, requestWith())).resolves.toMatchObject({
        success: true,
        message: `Error messages ${VERSION} unchanged`,
      });
    });

    it('says none before the first catalogue load', async () => {
      service.catalogue.mockResolvedValue(payload({ version: null, rows: [] }));

      await expect(controller.catalogue({}, requestWith())).resolves.toMatchObject({
        message: '0 error message(s), version none',
      });
    });
  });
});
