import { TillPrintService } from '../../../../till/services/till-print.service';
import { ProviderRequest } from '../print-data-provider.types';
import {
  TILL_PRINT_PROVIDERS,
  TillDayHeaderProvider,
  TillDaySessionsProvider,
  TillDayTendersProvider,
  TillMovementHeaderProvider,
  TillMovementLinesProvider,
  TillRemitHeaderProvider,
  TillRemitLinesProvider,
  TillSessionHeaderProvider,
  TillSessionMovementsProvider,
  TillSessionTendersProvider,
} from './till.providers';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const SESSION_ID = '019c6f6c-be87-7a11-8905-36092c46e102';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e103';

const requestFor = (overrides: Partial<ProviderRequest['context']> = {}, rowLimit = 500) =>
  ({
    context: {
      companyId: COMPANY_ID,
      branchId: null,
      accYear: '2026-2027',
      docId: SESSION_ID,
      userId: USER_ID,
      deviceId: null,
      ...overrides,
    },
    params: {},
    lang: 'en-IN',
    rowLimit,
  }) as ProviderRequest;

const rows = (count: number) => Array.from({ length: count }, (_unused, index) => ({ n: index }));

describe('till print providers (notes 117 §7 / notes 135)', () => {
  let till: Record<string, jest.Mock>;

  beforeEach(() => {
    till = {
      sessionHeader: jest.fn().mockResolvedValue({ from: 'sessionHeader' }),
      sessionTenders: jest.fn().mockResolvedValue(rows(5)),
      sessionMovements: jest.fn().mockResolvedValue(rows(5)),
      dayHeader: jest.fn().mockResolvedValue({ from: 'dayHeader' }),
      daySessions: jest.fn().mockResolvedValue(rows(5)),
      dayTenders: jest.fn().mockResolvedValue(rows(5)),
      movementHeader: jest.fn().mockResolvedValue({ from: 'movementHeader' }),
      movementLines: jest.fn().mockResolvedValue(rows(5)),
      remitHeader: jest.fn().mockResolvedValue({ from: 'remitHeader' }),
      remitLines: jest.fn().mockResolvedValue(rows(5)),
    };
  });

  const service = () => till as unknown as TillPrintService;

  it('ships ten providers with distinct codes', () => {
    const codes = TILL_PRINT_PROVIDERS.map((Provider) => new Provider(service()).code);

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it.each([
    [TillSessionHeaderProvider, 'sessionHeader'],
    [TillDayHeaderProvider, 'dayHeader'],
    [TillMovementHeaderProvider, 'movementHeader'],
    [TillRemitHeaderProvider, 'remitHeader'],
  ] as const)('%p reads one row through TillPrintService.%s', async (Provider, method) => {
    const provider = new Provider(service());

    await expect(provider.resolve(requestFor())).resolves.toEqual({ from: method });
    expect(provider.cardinality).toBe('one');
    expect(till[method]).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      docId: SESSION_ID,
      accYear: '2026-2027',
      userId: USER_ID,
    });
  });

  it.each([
    [TillSessionTendersProvider, 'sessionTenders'],
    [TillSessionMovementsProvider, 'sessionMovements'],
    [TillDaySessionsProvider, 'daySessions'],
    [TillDayTendersProvider, 'dayTenders'],
    [TillMovementLinesProvider, 'movementLines'],
    [TillRemitLinesProvider, 'remitLines'],
  ] as const)('%p caps the rows of TillPrintService.%s at the row limit', async (Provider, method) => {
    const provider = new Provider(service());

    await expect(provider.resolve(requestFor({}, 3))).resolves.toEqual(rows(3));
    expect(provider.cardinality).toBe('many');
    expect(till[method]).toHaveBeenCalledTimes(1);
  });

  it('passes a missing user on as null — a blind session hides its expected figure then', async () => {
    await new TillSessionHeaderProvider(service()).resolve(requestFor({ userId: null }));

    expect(till.sessionHeader).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it.each(TILL_PRINT_PROVIDERS)('%p refuses a render with no document', async (Provider) => {
    const provider = new Provider(service());

    await expect(provider.resolve(requestFor({ docId: null }))).rejects.toThrow(
      `${provider.code} prints one document and the render named none`,
    );
  });

  it('refuses a render with no accounting year before asking the till', async () => {
    await expect(
      new TillDayTendersProvider(service()).resolve(requestFor({ accYear: null })),
    ).rejects.toThrow(/till\.day\.tenders reads a table partitioned by accounting year/);
    expect(till.dayTenders).not.toHaveBeenCalled();
  });
});
