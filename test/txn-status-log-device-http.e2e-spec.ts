import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import {
  BEARER,
  bankTender,
  bootApp,
  data,
  draftBody,
  expectStatus,
  keys,
  loadMasters,
  PaymentFixtures,
  PAYMENT_MENU,
  prisma,
  ROUTES,
  type Masters,
} from './helpers/payment-e2e';

/**
 * Notes 80 B — an accounts document's status trail records the counter it was
 * keyed at. tsl_device_id was NULL on every RECEIPT / PAYMENT / JOURNAL /
 * cheque row, because those services passed the voucher header's device
 * (never filled) instead of the session's. The session here carries a real
 * fixed.device_master row, as a counter login's token does.
 *
 * A payment stands for the accounts family: draft → CREATED, delete → DELETED.
 * Writes only its own rows and removes them in `afterAll`.
 */

jest.setTimeout(120_000);

// A live fixed.device_master row (the one the bill e2e suites file under).
const DEVICE_ID = '019e4e4c-9f08-7211-afe0-409b88a62180';

let app: INestApplication;
let masters: Masters;
const fixtures = new PaymentFixtures();
let partyId: string;

const api = () => request(app.getHttpServer());

beforeAll(async () => {
  await fixtures.grantRights([PAYMENT_MENU]);
  masters = await loadMasters();
  partyId = await fixtures.createParty('DEVICE');
  app = await bootApp({ device_id: DEVICE_ID });
});

afterAll(async () => {
  await fixtures.teardown();
  await app?.close();
  await prisma.$disconnect();
});

describe("a payment's trail names the session's device (notes 80 B)", () => {
  it('on the CREATED step and on the DELETED step', async () => {
    const created = await api()
      .post(ROUTES.create)
      .set('Authorization', BEARER)
      .send(draftBody(partyId, [bankTender(masters, 41)]));
    expectStatus(created, 201);
    const voucherId = data<{ header: { avhVoucherId: string } }>(created).header.avhVoucherId;
    fixtures.vouchers.push(voucherId);

    const deleted = await api()
      .post(ROUTES.delete)
      .set('Authorization', BEARER)
      .send(keys(voucherId));
    expectStatus(deleted, 201);

    const trail = await prisma.txnStatusLog.findMany({
      where: { tslSrcDocId: voucherId, tslSrcDocType: 'PAYMENT' },
      orderBy: { tslSeqNo: 'asc' },
      select: { tslEvent: true, tslDeviceId: true },
    });
    expect(trail).toEqual([
      { tslEvent: 'CREATED', tslDeviceId: DEVICE_ID },
      { tslEvent: 'DELETED', tslDeviceId: DEVICE_ID },
    ]);
  });
});
