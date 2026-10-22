import { HttpException } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { NoTenderQueryDto, TenderDayBookQueryDto } from './tender-day-book.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b001';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b002';
const SESSION_ID = '019c6f6c-be87-7a11-8905-36092c46b003';
const TENDER_A = '019c6f6c-be87-7a11-8905-36092c46b020';
const TENDER_B = '019c6f6c-be87-7a11-8905-36092c46b021';
const QUERY = { companyId: COMPANY_ID, accYear: '2026-2027', fromDate: '2026-10-16' };

type QueryDto = typeof TenderDayBookQueryDto | typeof NoTenderQueryDto;

/** The query as the house ValidationPipe hands it to the controller. */
const parse = <T extends QueryDto>(query: object, dto: T) =>
  validateDto(query, dto, { type: 'query' }) as Promise<InstanceType<T>>;

/** The fields the house ValidationPipe refuses, or [] when it lets the query through. */
async function refusedFields(query: object, dto: QueryDto = TenderDayBookQueryDto) {
  try {
    await parse(query, dto);
    return [];
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return (error.getResponse() as { errors: { field: string }[] }).errors.map((e) => e.field);
  }
}

describe('TenderDayBookQueryDto', () => {
  it('accepts the bare scope', async () => {
    await expect(refusedFields(QUERY)).resolves.toEqual([]);
  });

  // fromDate is optional here: the Day Book's "required" is the service's DATE_REQUIRED.
  it('wants a company and a year, and nothing else', async () => {
    await expect(refusedFields({ groupBy: 'TENDER' })).resolves.toEqual(['companyId', 'accYear']);
  });

  it('refuses an empty query outright', async () => {
    await expect(refusedFields({})).resolves.toEqual(['request']);
  });

  it.each([
    ['a company id that is not a uuid', { companyId: 'acme' }, 'companyId'],
    ['a year not shaped 2026-2027', { accYear: '2026-27' }, 'accYear'],
    ['a branch id that is not a uuid', { branchId: 'main' }, 'branchId'],
    ['a session id that is not a uuid', { sessionId: '42' }, 'sessionId'],
    ['a date not shaped YYYY-MM-DD', { fromDate: '16-10-2026' }, 'fromDate'],
    ['a day the calendar does not have', { toDate: '2026-02-30' }, 'toDate'],
    ['a groupBy other than TENDER or TYPE', { groupBy: 'DAY' }, 'groupBy'],
    ['a tender id that is not a uuid', { tenderIds: `${TENDER_A},cash` }, 'tenderIds'],
    ['a tender type that is not a number', { tenderTypeIds: '1,UPI' }, 'tenderTypeIds'],
    ['a limit of 0', { limit: '0' }, 'limit'],
    ['a limit over 20000', { limit: '20001' }, 'limit'],
    ['a parameter the route does not know', { ledgerId: COMPANY_ID }, 'ledgerId'],
  ])('refuses %s', async (_label, overrides, field) => {
    await expect(refusedFields({ ...QUERY, ...overrides })).resolves.toEqual([field]);
  });

  it('reads the scope through: branch, session, dates and limit', async () => {
    await expect(
      parse(
        {
          ...QUERY,
          branchId: BRANCH_ID,
          sessionId: SESSION_ID,
          toDate: '2026-10-20',
          limit: '250',
        },
        TenderDayBookQueryDto,
      ),
    ).resolves.toMatchObject({
      branchId: BRANCH_ID,
      sessionId: SESSION_ID,
      fromDate: '2026-10-16',
      toDate: '2026-10-20',
      limit: 250,
    });
  });

  it('upper-cases groupBy', async () => {
    await expect(
      parse({ ...QUERY, groupBy: ' type ' }, TenderDayBookQueryDto),
    ).resolves.toMatchObject({ groupBy: 'TYPE' });
  });

  it('takes the tender filters comma-separated or repeated, trimmed', async () => {
    await expect(
      parse(
        { ...QUERY, tenderIds: ` ${TENDER_A} , ${TENDER_B} `, tenderTypeIds: '1, 4' },
        TenderDayBookQueryDto,
      ),
    ).resolves.toMatchObject({ tenderIds: [TENDER_A, TENDER_B], tenderTypeIds: ['1', '4'] });
    await expect(
      parse({ ...QUERY, tenderIds: [TENDER_A, TENDER_B] }, TenderDayBookQueryDto),
    ).resolves.toMatchObject({ tenderIds: [TENDER_A, TENDER_B] });
  });

  it('treats an empty filter as no filter', async () => {
    const dto = await parse(
      { ...QUERY, tenderIds: '', tenderTypeIds: ' , ' },
      TenderDayBookQueryDto,
    );

    expect(dto.tenderIds).toBeUndefined();
    expect(dto.tenderTypeIds).toBeUndefined();
  });

  it('leaves withRows out when it is not sent, so the rows come back', async () => {
    const dto = await parse(QUERY, TenderDayBookQueryDto);

    expect(dto.withRows).toBeUndefined();
  });

  it('reads withRows=true as true', async () => {
    await expect(
      parse({ ...QUERY, withRows: 'true' }, TenderDayBookQueryDto),
    ).resolves.toMatchObject({ withRows: true });
  });
});

describe('NoTenderQueryDto', () => {
  it('needs no dates', async () => {
    await expect(
      refusedFields({ companyId: COMPANY_ID, accYear: '2026-2027' }, NoTenderQueryDto),
    ).resolves.toEqual([]);
  });

  it('takes a limit but none of the Day Book options', async () => {
    await expect(
      refusedFields({ ...QUERY, limit: '10', groupBy: 'TYPE', withRows: 'true' }, NoTenderQueryDto),
    ).resolves.toEqual(['groupBy', 'withRows']);
  });
});
