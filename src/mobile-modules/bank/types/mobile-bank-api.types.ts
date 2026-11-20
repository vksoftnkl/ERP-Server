/** One bank of fixed.bank_master, for the Bank dropdown of a phone cheque. */
export interface MobileBank {
  bankId: string;
  /** What the phone sends as tdBankName (td_bank_name holds the name, not an id). */
  name: string;
  shortName: string | null;
}

/** GET /mobile/banks/list */
export interface MobileBankList {
  items: MobileBank[];
  total: number;
}
