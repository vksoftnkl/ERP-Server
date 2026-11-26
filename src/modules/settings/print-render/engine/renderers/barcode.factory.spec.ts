import { BarcodeFactory, isValidEan13, resolveAutoSymbology } from './barcode.factory';

describe('BarcodeFactory — auto (SM3) and the raw bar pattern', () => {
  it('auto picks EAN-13 for a valid EAN-13 and Code 128 for anything else', () => {
    expect(resolveAutoSymbology('4006381333931')).toBe('ean13');
    expect(resolveAutoSymbology(' 8901234567890 ')).toBe('ean13');
    expect(resolveAutoSymbology('4006381333932')).toBe('code128'); // wrong check digit
    expect(resolveAutoSymbology('000123')).toBe('code128');
    expect(resolveAutoSymbology('V000123')).toBe('code128');
    expect(resolveAutoSymbology('012345678905')).toBe('code128'); // a 12-digit UPC
  });

  it('isValidEan13 checks the GS1 check digit', () => {
    expect(isValidEan13('4006381333931')).toBe(true);
    expect(isValidEan13('400638133393')).toBe(false);
  });

  it('rawBars: auto EAN-13 is 95 modules, no warning', () => {
    const factory = new BarcodeFactory();
    const bars = factory.rawBars('auto', '4006381333931');
    expect(bars?.symbology).toBe('ean13');
    expect(bars?.modules).toBe(95);
    expect(factory.drainWarnings()).toEqual([]);
  });

  it('rawBars: auto 000123 prints Code 128 with no warning', () => {
    const factory = new BarcodeFactory();
    const bars = factory.rawBars('auto', '000123');
    expect(bars?.symbology).toBe('code128');
    expect(bars?.sbs.length).toBeGreaterThan(10);
    expect(factory.drainWarnings()).toEqual([]);
  });

  it('rawBars: a bad explicit EAN-13 is a warning and no bars; 2-D symbols have none', () => {
    const factory = new BarcodeFactory();
    expect(factory.rawBars('ean13', 'ABC')).toBeNull();
    expect(factory.drainWarnings()[0]).toContain('EAN-13');
    expect(factory.rawBars('datamatrix', 'X1')).toBeNull();
  });

  it('the PNG path resolves auto too', async () => {
    const factory = new BarcodeFactory();
    const png = await factory.barcode('auto', 'V000123', 30, 10, true);
    expect(png?.png.length).toBeGreaterThan(100);
  });
});
