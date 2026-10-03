import { snapshotFromDto } from './bill-snapshot';
import type { SaveBillDto } from './dto/save-bill.dto';

// E-WAY-DB — /validate used to read the transport band from the database only,
// so an unsaved draft was always told "transport missing". The snapshot now
// carries the band the body sends; the guard reads that first.
describe('snapshotFromDto — the transport band the body carries', () => {
  const dto = (overrides: Partial<SaveBillDto> = {}): SaveBillDto =>
    ({
      sbCompanyId: '019c0000-0000-7000-8000-000000000001',
      sbBranchId: '019c0000-0000-7000-8000-000000000002',
      sbAccYear: '2026-2027',
      sbBillDate: '2026-09-25',
      ...overrides,
    }) as SaveBillDto;

  it('is undefined when the body says nothing about transport, so the stored band is read', () => {
    expect(snapshotFromDto(dto(), new Map()).transport).toBeUndefined();
  });

  it('carries the transporter and LR the body names', () => {
    const snap = snapshotFromDto(
      dto({ sbTransporterName: 'VRL Logistics', sbLrNo: 'LR-1001' }),
      new Map(),
    );
    expect(snap.transport).toEqual({
      transporterId: null,
      transporterName: 'VRL Logistics',
      lrNo: 'LR-1001',
    });
  });

  it('is all-null when the body clears the band, which the guard treats as empty', () => {
    const snap = snapshotFromDto(
      dto({ sbTransporterId: null, sbTransporterName: null, sbLrNo: null }),
      new Map(),
    );
    expect(snap.transport).toEqual({ transporterId: null, transporterName: null, lrNo: null });
  });
});
