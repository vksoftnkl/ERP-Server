import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Cache } from 'cache-manager';
import { firstValueFrom, of } from 'rxjs';
import { HttpCacheInterceptor } from '../../common/interceptors/http-cache.interceptor';
import { BillBalanceService } from '../accountsModule/billBalance/bill-balance.service';
import { GetPartyCreditSummaryDto } from '../accountsModule/billBalance/dto/get-party-credit-summary.dto';
import { PartyCreditSummary } from '../accountsModule/billBalance/types/bill-balance-api.types';
import { MasterLookupController } from './master-lookup.controller';
import { MasterLookupService } from './master-lookup.service';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const PARTY_ID = '019c6f6c-be87-7a11-8905-36092c46fe04';

const QUERY: GetPartyCreditSummaryDto = {
  companyId: COMPANY_ID,
  accYear: '2025-2026',
  partyId: PARTY_ID,
};

const SUMMARY = { partyId: PARTY_ID, pendingAmount: 125000 } as PartyCreditSummary;

describe('MasterLookupController party-credit route', () => {
  const makeController = (getCreditSummary: jest.Mock) =>
    new MasterLookupController(
      {} as MasterLookupService,
      {
        getCreditSummary,
      } as unknown as BillBalanceService,
    );

  it('delegates to the accounts bill-balance service and wraps the result', async () => {
    const getCreditSummary = jest.fn().mockResolvedValue(SUMMARY);

    await expect(makeController(getCreditSummary).getPartyCredit(QUERY)).resolves.toEqual({
      success: true,
      message: 'Party credit summary fetched successfully',
      data: SUMMARY,
    });
    // The route is a pass-through: the SQL lives in the accounts module so the
    // receipt and credit-note screens can share it rather than fork a copy.
    expect(getCreditSummary).toHaveBeenCalledWith(QUERY);
  });

  describe('cache exemption', () => {
    let cache: { get: jest.Mock; set: jest.Mock };
    let interceptor: HttpCacheInterceptor;

    /**
     * The bits of ExecutionContext HttpCacheInterceptor actually reads: the
     * handler it reflects the TTL off, and the request it builds the key from.
     */
    const contextFor = (handler: (...args: never[]) => unknown, url: string): ExecutionContext =>
      ({
        getType: () => 'http',
        getHandler: () => handler,
        getClass: () => MasterLookupController,
        switchToHttp: () => ({
          getRequest: () => ({ method: 'GET', originalUrl: url }),
          getResponse: () => ({ setHeader: jest.fn() }),
        }),
      }) as unknown as ExecutionContext;

    const next: CallHandler = { handle: () => of({ success: true }) };

    /**
     * The route handler, as the Reflector metadata key it is here — the
     * interceptor only reflects @CacheTTL off it, it never calls it.
     */
    const handlerOf = (name: keyof MasterLookupController): ((...args: never[]) => unknown) =>
      // eslint-disable-next-line @typescript-eslint/unbound-method
      MasterLookupController.prototype[name] as (...args: never[]) => unknown;

    const run = async (name: keyof MasterLookupController, url: string) => {
      const result = await interceptor.intercept(contextFor(handlerOf(name), url), next);
      await firstValueFrom(result);
    };

    beforeEach(() => {
      cache = {
        get: jest.fn().mockResolvedValue(undefined),
        set: jest.fn().mockResolvedValue(undefined),
      };
      interceptor = new HttpCacheInterceptor(cache as unknown as Cache, new Reflector());
    });

    it('never reads or writes a cache key for party-credit', async () => {
      // acc_bill_balance moves on every bill, receipt, credit note and
      // adjustment. A cached summary would let a salesman bill a customer,
      // collect the payment, and have the next bill still evaluate the
      // pre-payment outstanding.
      await run(
        'getPartyCredit',
        `/api/v1/master-lookups/party-credit?companyId=${COMPANY_ID}&partyId=${PARTY_ID}`,
      );

      expect(cache.get).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('still caches item-price, so the exemption is this route only', async () => {
      await run('getItemPriceLookup', '/api/v1/master-lookups/item-price?item_id=1');

      expect(cache.get).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
    });

    it('still caches the routes that inherit the class-level TTL', async () => {
      await run('getAllMasters', '/api/v1/master-lookups/name-id/all-masters');

      expect(cache.get).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
    });
  });
});
