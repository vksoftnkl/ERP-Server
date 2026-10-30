import { Logger } from '@nestjs/common';
import {
  errorWordingVersion,
  setErrorWording,
  wordingFor,
} from '../../common/error-wording/error-wording';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ErrorMessageService } from './error-messages.service';

const VERSION = '2026-10-15.1';
const NEXT_VERSION = '2026-10-21.1';
const REFRESH_MS = 60_000;

/** A fixed.error_message row as the select reads it. */
const dbRow = (code: string, lang = 'en', title = `${code} ${lang}`) => ({
  ermCode: code,
  ermVariant: '',
  ermLang: lang,
  ermTitle: title,
  ermLine: `${title} line`,
  ermTodo: `${title} todo`,
});

type PrismaMock = {
  errorMessageCatalogue: { findUnique: jest.Mock };
  errorMessage: { findMany: jest.Mock };
};

describe('ErrorMessageService', () => {
  let prisma: PrismaMock;
  let service: ErrorMessageService;

  beforeEach(() => {
    // The registry is module state: start every test from an empty catalogue.
    setErrorWording([], null);
    prisma = {
      errorMessageCatalogue: {
        findUnique: jest.fn().mockResolvedValue({ emcId: 1, emcVersion: VERSION }),
      },
      errorMessage: { findMany: jest.fn().mockResolvedValue([dbRow('HOLD_NOT_FOUND')]) },
    };
    service = new ErrorMessageService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
    setErrorWording([], null);
  });

  describe('reload', () => {
    it('loads every active row of every language into the registry, with the version', async () => {
      prisma.errorMessage.findMany.mockResolvedValue([
        dbRow('HOLD_NOT_FOUND', 'en', 'Hold not found'),
        dbRow('HOLD_NOT_FOUND', 'ta', 'tamil'),
      ]);

      await service.reload();

      expect(prisma.errorMessageCatalogue.findUnique).toHaveBeenCalledWith({ where: { emcId: 1 } });
      expect(prisma.errorMessage.findMany).toHaveBeenCalledWith({
        where: { ermIsActive: true },
        orderBy: [{ ermCode: 'asc' }, { ermVariant: 'asc' }, { ermLang: 'asc' }],
        select: {
          ermCode: true,
          ermVariant: true,
          ermLang: true,
          ermTitle: true,
          ermLine: true,
          ermTodo: true,
        },
      });
      expect(errorWordingVersion()).toBe(VERSION);
      expect(wordingFor({ code: 'HOLD_NOT_FOUND' })).toEqual({
        title: 'Hold not found',
        line: 'Hold not found line',
        todo: 'Hold not found todo',
      });
      expect(wordingFor({ code: 'HOLD_NOT_FOUND' }, 'ta')?.title).toBe('tamil');
    });

    it('holds a null version when the catalogue row is missing', async () => {
      prisma.errorMessageCatalogue.findUnique.mockResolvedValue(null);

      await service.reload();

      expect(errorWordingVersion()).toBeNull();
      expect(wordingFor({ code: 'HOLD_NOT_FOUND' })).not.toBeNull();
    });

    it('replaces the previous catalogue wholesale', async () => {
      setErrorWording(
        [
          {
            code: 'RETIRED_CODE',
            variant: '',
            lang: 'en',
            title: 'old',
            line: 'old line',
            todo: 'old todo',
          },
        ],
        'old',
      );

      await service.reload();

      expect(wordingFor({ code: 'RETIRED_CODE' })).toBeNull();
      expect(wordingFor({ code: 'HOLD_NOT_FOUND' })).not.toBeNull();
    });
  });

  describe('onModuleInit', () => {
    it('loads the catalogue at boot', async () => {
      await service.onModuleInit();

      expect(errorWordingVersion()).toBe(VERSION);
      expect(wordingFor({ code: 'HOLD_NOT_FOUND' })).not.toBeNull();
    });

    it('boots with a warning, not a crash, when the catalogue cannot be read', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      prisma.errorMessage.findMany.mockRejectedValue(new Error('db down'));

      await expect(service.onModuleInit()).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith('Error wording not loaded: Error: db down');
      expect(errorWordingVersion()).toBeNull();
    });

    it('never keeps the process alive with its refresh timer', async () => {
      await service.onModuleInit();

      const { timer } = service as unknown as { timer: NodeJS.Timeout };
      expect(timer.hasRef()).toBe(false);
    });
  });

  describe('the refresh every minute', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await service.onModuleInit();
      prisma.errorMessageCatalogue.findUnique.mockClear();
      prisma.errorMessage.findMany.mockClear();
    });

    it('checks nothing before the minute is up', async () => {
      await jest.advanceTimersByTimeAsync(REFRESH_MS - 1);

      expect(prisma.errorMessageCatalogue.findUnique).not.toHaveBeenCalled();
    });

    it('reads only the version while it is unchanged', async () => {
      await jest.advanceTimersByTimeAsync(REFRESH_MS);

      expect(prisma.errorMessageCatalogue.findUnique).toHaveBeenCalledWith({
        where: { emcId: 1 },
        select: { emcVersion: true },
      });
      expect(prisma.errorMessage.findMany).not.toHaveBeenCalled();
    });

    it.each([
      ['another process loaded a newer catalogue', { emcVersion: NEXT_VERSION }, NEXT_VERSION],
      ['the catalogue row is gone', null, null],
    ])('reloads when %s', async (_label, catalogueRow, expectedVersion) => {
      prisma.errorMessageCatalogue.findUnique.mockResolvedValue(catalogueRow);
      prisma.errorMessage.findMany.mockResolvedValue([dbRow('TILL_SESSION_NOT_OPEN')]);

      await jest.advanceTimersByTimeAsync(REFRESH_MS);

      expect(prisma.errorMessage.findMany).toHaveBeenCalledTimes(1);
      expect(errorWordingVersion()).toBe(expectedVersion);
      expect(wordingFor({ code: 'TILL_SESSION_NOT_OPEN' })).not.toBeNull();
      expect(wordingFor({ code: 'HOLD_NOT_FOUND' })).toBeNull();
    });

    it('keeps the loaded wording when a refresh fails', async () => {
      prisma.errorMessageCatalogue.findUnique.mockRejectedValue(new Error('db down'));

      await jest.advanceTimersByTimeAsync(REFRESH_MS);

      expect(errorWordingVersion()).toBe(VERSION);
      expect(wordingFor({ code: 'HOLD_NOT_FOUND' })).not.toBeNull();
    });

    it('stops once the module is destroyed', async () => {
      service.onModuleDestroy();

      await jest.advanceTimersByTimeAsync(REFRESH_MS * 2);

      expect(prisma.errorMessageCatalogue.findUnique).not.toHaveBeenCalled();
    });
  });

  it('can be destroyed before it was ever started', () => {
    expect(() => service.onModuleDestroy()).not.toThrow();
  });

  describe('catalogue', () => {
    it('answers unchanged with no rows when the app already holds this version', async () => {
      await expect(service.catalogue('en', VERSION)).resolves.toEqual({
        version: VERSION,
        lang: 'en',
        unchanged: true,
        rows: [],
      });
      expect(prisma.errorMessage.findMany).not.toHaveBeenCalled();
    });

    it('serves the active rows of the language asked for', async () => {
      prisma.errorMessage.findMany.mockResolvedValue([dbRow('HOLD_NOT_FOUND', 'ta', 'tamil')]);

      await expect(service.catalogue('ta', '2026-10-01.1')).resolves.toEqual({
        version: VERSION,
        lang: 'ta',
        unchanged: false,
        rows: [
          {
            code: 'HOLD_NOT_FOUND',
            variant: '',
            lang: 'ta',
            title: 'tamil',
            line: 'tamil line',
            todo: 'tamil todo',
          },
        ],
      });
      expect(prisma.errorMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ermIsActive: true, ermLang: 'ta' } }),
      );
    });

    it('serves English for a language with no rows yet, and says so', async () => {
      prisma.errorMessage.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([dbRow('HOLD_NOT_FOUND')]);

      const result = await service.catalogue('ta');

      expect(result.lang).toBe('en');
      expect(result.rows).toEqual([
        expect.objectContaining({ code: 'HOLD_NOT_FOUND', lang: 'en' }),
      ]);
      expect(prisma.errorMessage.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { ermIsActive: true, ermLang: 'en' } }),
      );
    });

    it('does not look again when English itself has no rows', async () => {
      prisma.errorMessage.findMany.mockResolvedValue([]);

      await expect(service.catalogue('en')).resolves.toEqual({
        version: VERSION,
        lang: 'en',
        unchanged: false,
        rows: [],
      });
      expect(prisma.errorMessage.findMany).toHaveBeenCalledTimes(1);
    });

    it('serves the rows when no since is sent', async () => {
      await expect(service.catalogue('en', null)).resolves.toMatchObject({ unchanged: false });
      await expect(service.catalogue('en')).resolves.toMatchObject({ unchanged: false });
      expect(prisma.errorMessage.findMany).toHaveBeenCalledTimes(2);
    });

    it('serves the rows before the first catalogue load, whatever since says', async () => {
      prisma.errorMessageCatalogue.findUnique.mockResolvedValue(null);

      await expect(service.catalogue('en', VERSION)).resolves.toMatchObject({
        version: null,
        unchanged: false,
        rows: [expect.objectContaining({ code: 'HOLD_NOT_FOUND' })],
      });
    });
  });
});
