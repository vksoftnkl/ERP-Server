import { Prisma } from '@prisma/client';
import { DEFAULT_ACTOR } from '../utils/module-shared.utils';
import {
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
  appendTxnStatusLog,
  statusActorOf,
} from './txn-status-log.helper';

const USER_ID = '019f0000-0000-7000-8000-0000000000e1';
const OTHER_USER_ID = '019f0000-0000-7000-8000-0000000000e2';

// notes 80 A: the CREATED step of a bill / quotation was handed the login NAME
// (sb_created_by is text), which tsl_changed_by cannot hold.
describe('statusActorOf', () => {
  it("replaces a login name with the request's user id", () => {
    expect(statusActorOf('VKPOS', USER_ID)).toBe(USER_ID);
  });

  it('keeps an actor that is already a uuid', () => {
    expect(statusActorOf(OTHER_USER_ID, USER_ID)).toBe(OTHER_USER_ID);
  });

  it('keeps the name when there is no request user (it then files as DEFAULT_ACTOR)', () => {
    expect(statusActorOf('VKPOS', null)).toBe('VKPOS');
  });
});

describe('appendTxnStatusLog', () => {
  const tx = {
    txnStatusLog: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      create: jest.fn((args: { data: unknown }) => Promise.resolve(args.data)),
    },
    deviceMaster: { findFirst: jest.fn(() => Promise.resolve(null)) },
  };

  it('files a non-uuid actor as DEFAULT_ACTOR and keeps the name in tsl_created_by', async () => {
    await appendTxnStatusLog(tx as unknown as Prisma.TransactionClient, {
      companyId: USER_ID,
      branchId: USER_ID,
      accYear: '2026-2027',
      srcModule: TxnStatusSrcModule.SALES,
      srcDocType: TxnStatusDocType.SALE_BILL,
      srcDocId: USER_ID,
      event: TxnStatusEvent.CREATED,
      toStatus: 'DRAFT',
      changedBy: 'VKPOS',
    });

    expect(tx.txnStatusLog.create.mock.calls[0][0].data).toMatchObject({
      tslChangedBy: DEFAULT_ACTOR,
      tslCreatedBy: 'VKPOS',
    });
  });
});
