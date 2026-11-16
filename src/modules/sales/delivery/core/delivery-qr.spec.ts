import { decodeDeliveryQr, deliveryQrCaption, encodeDeliveryQr, looksLikeDeliveryQr } from './delivery-qr';

const BILL = '01a1dfb3-ffa1-72b5-8b41-8e79fbeba967';
const NOTE = '01a1dfb4-34ff-7edd-af2c-3f2123c053b8';

describe('delivery QR (decision 51)', () => {
  it('round-trips a bill and a note', () => {
    const b = encodeDeliveryQr('BILL', BILL, '2026-2027');
    const n = encodeDeliveryQr('NOTE', NOTE, '2026-2027 ');
    expect(b).toMatch(/^NXB1-[0-9A-HJKMNP-TV-Z]{26}-2627-[0-9A-HJKMNP-TV-Z]{2}$/);
    expect(n.startsWith('NXD1-')).toBe(true);
    expect(decodeDeliveryQr(b)).toEqual({ kind: 'BILL', id: BILL, accYear: '2026-2027' });
    expect(decodeDeliveryQr(n.toLowerCase())).toEqual({ kind: 'NOTE', id: NOTE, accYear: '2026-2027' });
  });

  it('holds only QR alphanumeric characters and no price or name', () => {
    const b = encodeDeliveryQr('BILL', BILL, '2026-2027');
    expect(b).toMatch(/^[0-9A-Z-]+$/);
    expect(deliveryQrCaption(b)).toHaveLength(12);
  });

  it('refuses a misread (bad check characters, bad year, junk)', () => {
    const b = encodeDeliveryQr('BILL', BILL, '2026-2027');
    expect(decodeDeliveryQr(b.slice(0, -2) + (b.endsWith('ZZ') ? '00' : 'ZZ'))).toBeNull();
    expect(decodeDeliveryQr(b.replace('-2627-', '-2628-'))).toBeNull();
    expect(decodeDeliveryQr('bil04255')).toBeNull();
    expect(decodeDeliveryQr('')).toBeNull();
    expect(looksLikeDeliveryQr('nxb1-abc')).toBe(true);
    expect(looksLikeDeliveryQr('bil04255')).toBe(false);
  });

  it('throws on a programming error (not a uuid / not a year)', () => {
    expect(() => encodeDeliveryQr('BILL', 'x', '2026-2027')).toThrow();
    expect(() => encodeDeliveryQr('BILL', BILL, '2026')).toThrow();
  });
});
