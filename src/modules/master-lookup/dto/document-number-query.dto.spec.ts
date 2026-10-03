import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DocumentNumberQueryDto } from './document-number-query.dto';
const COMPANY_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678';
const BRANCH_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45679';
const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const transformQuery = (query: Record<string, unknown>) =>
  validationPipe.transform(query, {
    type: 'query',
    metatype: DocumentNumberQueryDto,
  }) as Promise<DocumentNumberQueryDto>;
const validQuery = (overrides: Record<string, unknown> = {}) => ({
  module: 'saleOrder',
  orderNo: 'SO-0042',
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  ...overrides,
});
describe('DocumentNumberQueryDto', () => {
  it('accepts a canonical module key', async () => {
    await expect(transformQuery(validQuery())).resolves.toEqual({
      module: 'saleOrder',
      orderNo: 'SO-0042',
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
    });
  });
  it.each([
    ['sale-bill', 'saleBill'],
    ['SALE_BILL', 'saleBill'],
    ['invoice', 'saleBill'],
    ['order', 'saleOrder'],
    ['Sales Order', 'saleOrder'],
    ['quotation', 'saleQuotation'],
    ['quote', 'saleQuotation'],
  ])('resolves the display alias %s to %s', async (alias, expected) => {
    const dto = await transformQuery(validQuery({ module: alias }));
    expect(dto.module).toBe(expected);
  });
  it('trims the document number', async () => {
    const dto = await transformQuery(validQuery({ orderNo: '  quo00042  ' }));
    expect(dto.orderNo).toBe('quo00042');
  });
  it('rejects a module it does not read', async () => {
    // Master keys belong to the option-list endpoints; this one only reads the
    // three sales document tables.
    await expect(transformQuery(validQuery({ module: 'customers' }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it.each(['module', 'orderNo', 'companyId', 'branchId'])('rejects a missing %s', async (field) => {
    const query = validQuery();
    delete (query as Record<string, unknown>)[field];
    await expect(transformQuery(query)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects a blank document number', async () => {
    // Trimmed to nothing, it would otherwise match no refno and 404 late.
    await expect(transformQuery(validQuery({ orderNo: '   ' }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('rejects a non-UUID company', async () => {
    await expect(transformQuery(validQuery({ companyId: '42' }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('rejects an accYear the lookup does not take', async () => {
    // The number alone is what the caller has — the year is the answer, not an
    // input, and the global pipe runs with forbidNonWhitelisted.
    await expect(transformQuery(validQuery({ accYear: '2025-2026' }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
