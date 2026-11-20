import {
  COMPANY_CODE_RULE,
  DEPARTMENT_CODE_RULE,
  DESIGNATION_CODE_MAX_LENGTH,
  EMPLOYEE_CODE_RULE,
  firstFreeCode,
  initialsCode,
  nextFreeCode,
  wholeNameCode,
} from './code-from-name';

describe('code-from-name (Company plan C1 18/11, HR masters review step 5 20/11)', () => {
  describe('initialsCode — the Company rule', () => {
    it.each([
      ['MT Demo Traders', 'MDT'],
      ['SUGI TRADERS', 'STU'],
      ['Amazon Retail India Private Limited', 'ARI'],
      ['The Chennai Silks', 'CSH'],
      ['A & B Traders', 'ABT'],
      ['Ram and Sons Pvt Ltd', 'RSA'],
      ['Seven Seas Shipping Logistics Export Import Agencies', 'SSSLEI'],
      ['1st Choice', '1CS'],
      ['Kumar', 'KUM'],
      ['Om', 'OM'],
      ['The Limited', 'TLH'],
    ])('makes %p → %p', (name, code) => {
      expect(initialsCode(name, COMPANY_CODE_RULE)).toBe(code);
    });

    it('makes none from a name with no letter or digit', () => {
      expect(initialsCode('&& --', COMPANY_CODE_RULE)).toBeNull();
      expect(initialsCode('   ', COMPANY_CODE_RULE)).toBeNull();
    });
  });

  describe('Department = the Company rule', () => {
    it.each([
      ['Accounts', 'ACC'],
      ['Human Resources', 'HRU'],
      ['Sales and Marketing', 'SMA'],
      ['Transport', 'TRA'],
      ['sales', 'SAL'],
    ])('makes %p → %p', (name, code) => {
      expect(initialsCode(name, DEPARTMENT_CODE_RULE)).toBe(code);
    });
  });

  describe('Employee = initials, 3 to 6, no skip words', () => {
    it.each([
      ['Suresh Krishna', 'SKU'],
      ['RAMESH', 'RAM'],
      ['Gnanesh Kumar', 'GKN'],
      ['K. R. Suresh', 'KRS'],
      ['ZT Driver Mani', 'ZDM'],
      ['Anand And Sons', 'AAS'],
      ['A B C D E F G H', 'ABCDEF'],
      ['Li', 'LI'],
    ])('makes %p → %p', (name, code) => {
      expect(initialsCode(name, EMPLOYEE_CODE_RULE)).toBe(code);
    });
  });

  describe('wholeNameCode — Designation', () => {
    it.each([
      ['Driver', 'DRIVER'],
      ['Sales Manager', 'SALESMANAGER'],
      ['Load-man', 'LOADMAN'],
      ['  supervisor ', 'SUPERVISOR'],
      ['Senior Accounts Executive Grade 2', 'SENIORACCOUNTSEXECUT'],
    ])('makes %p → %p', (name, code) => {
      expect(wholeNameCode(name, DESIGNATION_CODE_MAX_LENGTH)).toBe(code);
    });

    it('keeps to 20 characters and makes none from punctuation alone', () => {
      expect(wholeNameCode('x'.repeat(40), DESIGNATION_CODE_MAX_LENGTH)).toHaveLength(20);
      expect(wholeNameCode('-- / --', DESIGNATION_CODE_MAX_LENGTH)).toBeNull();
    });
  });

  describe('firstFreeCode', () => {
    it('keeps the base when nothing holds it', () => {
      expect(firstFreeCode('RAM', [])).toBe('RAM');
      expect(firstFreeCode('RAM', ['RAMA', 'RAMESH', null])).toBe('RAM');
    });

    it('adds 2, 3 … while the code is taken in any case', () => {
      expect(firstFreeCode('RAM', ['ram'])).toBe('RAM2');
      expect(firstFreeCode('RAM', ['RAM', 'Ram2', ' ram3 '])).toBe('RAM4');
      expect(firstFreeCode('DRIVER', ['DRIVER', 'DRIVER3'])).toBe('DRIVER2');
    });
  });

  describe('nextFreeCode', () => {
    it('reads the codes starting with the base and picks the first free one', async () => {
      const read = jest.fn().mockResolvedValue(['SKU', 'sku2']);

      await expect(nextFreeCode('SKU', read)).resolves.toBe('SKU3');
      expect(read).toHaveBeenCalledWith('SKU');
    });

    it('reads nothing and answers null when the name made no base', async () => {
      const read = jest.fn();

      await expect(nextFreeCode(null, read)).resolves.toBeNull();
      expect(read).not.toHaveBeenCalled();
    });
  });
});
