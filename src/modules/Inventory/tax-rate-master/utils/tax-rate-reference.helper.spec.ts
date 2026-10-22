import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TaxRateErrorCode } from '../types/tax-rate-error-codes';
import {
  assertTaxRateRefs,
  collectTaxRateRefErrors,
  collectTaxRateRefs,
} from './tax-rate-reference.helper';

const LIVE_ID = '019c6f6c-be87-7a11-8905-36092c46ad01';
const INACTIVE_ID = '019c6f6c-be87-7a11-8905-36092c46ad02';
const DELETED_ID = '019c6f6c-be87-7a11-8905-36092c46ad03';
const MISSING_ID = '019c6f6c-be87-7a11-8905-36092c46ad04';

const RATES = [
  { taxId: LIVE_ID, taxName: 'GST 18%', taxIsActive: true, taxIsDeleted: false },
  { taxId: INACTIVE_ID, taxName: 'GST 28% (old)', taxIsActive: false, taxIsDeleted: false },
  { taxId: DELETED_ID, taxName: 'GST 5%', taxIsActive: false, taxIsDeleted: true },
];

const clientWith = (rates = RATES) => {
  const findMany = jest.fn().mockResolvedValue(rates);
  return {
    findMany,
    client: { taxRateMaster: { findMany } } as unknown as Pick<
      Prisma.TransactionClient,
      'taxRateMaster'
    >,
  };
};

describe('tax-rate-reference.helper', () => {
  describe('collectTaxRateRefs', () => {
    it('takes one ref per line that names a rate, with the field path of its line', () => {
      const lines = [
        { sqiTaxId: LIVE_ID },
        { sqiTaxId: null },
        { sqiTaxId: undefined },
        { sqiTaxId: '' },
        { sqiTaxId: INACTIVE_ID },
      ];

      expect(
        collectTaxRateRefs(
          lines,
          (line) => line.sqiTaxId,
          (index) => `items.${index}.sqiTaxId`,
        ),
      ).toEqual([
        { taxId: LIVE_ID, field: 'items.0.sqiTaxId' },
        { taxId: INACTIVE_ID, field: 'items.4.sqiTaxId' },
      ]);
    });
  });

  describe('collectTaxRateRefErrors', () => {
    it('asks for nothing when there are no refs', async () => {
      const { client, findMany } = clientWith();

      await expect(collectTaxRateRefErrors(client, [])).resolves.toEqual([]);
      expect(findMany).not.toHaveBeenCalled();
    });

    it('looks each distinct rate up once, however many lines quote it', async () => {
      const { client, findMany } = clientWith();

      await collectTaxRateRefErrors(client, [
        { taxId: LIVE_ID, field: 'items.0.taxId' },
        { taxId: LIVE_ID, field: 'items.1.taxId' },
        { taxId: INACTIVE_ID, field: 'items.2.taxId' },
      ]);

      expect(findMany).toHaveBeenCalledWith({
        where: { taxId: { in: [LIVE_ID, INACTIVE_ID] } },
        select: { taxId: true, taxName: true, taxIsActive: true, taxIsDeleted: true },
      });
    });

    it('reports a missing or deleted rate as not found, and an inactive one by name', async () => {
      const { client } = clientWith();

      await expect(
        collectTaxRateRefErrors(client, [
          { taxId: LIVE_ID, field: 'items.0.taxId' },
          { taxId: MISSING_ID, field: 'items.1.taxId' },
          { taxId: DELETED_ID, field: 'items.2.taxId' },
          { taxId: INACTIVE_ID, field: 'items.3.taxId' },
        ]),
      ).resolves.toEqual([
        {
          field: 'items.1.taxId',
          code: TaxRateErrorCode.REF_NOT_FOUND,
          message: `No tax rate found with id ${MISSING_ID}`,
        },
        {
          field: 'items.2.taxId',
          code: TaxRateErrorCode.REF_NOT_FOUND,
          message: `No tax rate found with id ${DELETED_ID}`,
        },
        {
          field: 'items.3.taxId',
          code: TaxRateErrorCode.REF_INACTIVE,
          message: 'Tax rate "GST 28% (old)" is inactive and cannot be quoted on a new document',
        },
      ]);
    });

    it("uses the caller's own codes when it passes them", async () => {
      const { client } = clientWith();

      const errors = await collectTaxRateRefErrors(
        client,
        [
          { taxId: MISSING_ID, field: 'a' },
          { taxId: INACTIVE_ID, field: 'b' },
        ],
        { notFound: 'QUOTATION_TAX_NOT_FOUND', inactive: 'QUOTATION_TAX_INACTIVE' },
      );

      expect(errors.map((error) => error.code)).toEqual([
        'QUOTATION_TAX_NOT_FOUND',
        'QUOTATION_TAX_INACTIVE',
      ]);
    });
  });

  describe('assertTaxRateRefs', () => {
    it('passes when every rate is live', async () => {
      const { client } = clientWith();

      await expect(
        assertTaxRateRefs(client, [{ taxId: LIVE_ID, field: 'items.0.taxId' }]),
      ).resolves.toBeUndefined();
    });

    it('refuses with one 400 listing every unusable ref, under the message given', async () => {
      const { client } = clientWith();

      const error = await assertTaxRateRefs(
        client,
        [
          { taxId: MISSING_ID, field: 'items.0.taxId' },
          { taxId: INACTIVE_ID, field: 'items.1.taxId' },
        ],
        'Quotation refused',
      ).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(400);
      expect((error as HttpException).getResponse()).toMatchObject({
        success: false,
        message: 'Quotation refused',
        errors: [{ field: 'items.0.taxId' }, { field: 'items.1.taxId' }],
      });
    });
  });
});
