import type {
  SaveTenderDetailDto,
  TenderTempCreditDto,
} from '../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import { TENDER_TYPE } from '../posting/sales-doc.utils';

/**
 * Where a DRAFT keeps the WHO behind a TEMP_CR tender.
 *
 * `accounts.acc_temp_credit` needs the bill's balance row (`atc_abl_id` is
 * NOT NULL), which does not exist until `/bills/post`. So between `/create`
 * and `/post` the details ride on the tender row itself, in the columns a
 * temporary-credit tender never otherwise uses: the name in `td_bank_name`,
 * the mobile in `td_ref_no`, the place in `td_payer_vpa`, and the rest as a
 * small JSON in `td_notes`. `/post` decodes them into the `atc` row; `/get`
 * echoes them back as `tempCredit`.
 */
const NOTES_PREFIX = 'TEMP_CR:';

export interface TempCreditDetails {
  name: string;
  mobile: string;
  place: string | null;
  addr: string | null;
  idRef: string | null;
  days: number;
  notes: string | null;
}

export function encodeTempCreditTenders(
  tenders: SaveTenderDetailDto[] | undefined,
): SaveTenderDetailDto[] | undefined {
  if (!tenders) {
    return tenders;
  }
  return tenders.map((t) => {
    const tc = t.tempCredit;
    // `tempCredit` is not a column; the DTO carries it only to be folded here.
    // Nor is `cheque` (notes 48) — it goes to sb_draft_cheques, then the
    // cheque register.
    const { tempCredit: _drop, cheque: _cheque, ...rest } = t;
    void _drop;
    void _cheque;
    if (!tc) {
      return rest as SaveTenderDetailDto;
    }
    const extra = JSON.stringify({
      addr: tc.addr ?? null,
      idRef: tc.idRef ?? null,
      days: tc.days ?? 0,
      notes: tc.notes ?? null,
    });
    return {
      ...rest,
      tdBankName: tc.name,
      tdRefNo: tc.mobile,
      tdPayerVpa: tc.place ?? null,
      tdNotes: (NOTES_PREFIX + extra).slice(0, 250),
    } as SaveTenderDetailDto;
  });
}

export function decodeTempCredit(row: {
  tdTenderTypeId: number | string;
  tdBankName: string | null;
  tdRefNo: string | null;
  tdPayerVpa: string | null;
  tdNotes: string | null;
}): TempCreditDetails | null {
  if (Number(row.tdTenderTypeId) !== TENDER_TYPE.TEMP_CREDIT) {
    return null;
  }
  let extra: { addr?: string | null; idRef?: string | null; days?: number; notes?: string | null } =
    {};
  if (row.tdNotes?.startsWith(NOTES_PREFIX)) {
    try {
      extra = JSON.parse(row.tdNotes.slice(NOTES_PREFIX.length)) as typeof extra;
    } catch {
      extra = {};
    }
  }
  if (!row.tdBankName || !row.tdRefNo) {
    return null;
  }
  return {
    name: row.tdBankName,
    mobile: row.tdRefNo,
    place: row.tdPayerVpa ?? null,
    addr: extra.addr ?? null,
    idRef: extra.idRef ?? null,
    days: Number(extra.days ?? 0) || 0,
    notes: extra.notes ?? null,
  };
}

export function toTempCreditDto(d: TempCreditDetails): TenderTempCreditDto {
  return {
    name: d.name,
    mobile: d.mobile,
    place: d.place,
    addr: d.addr,
    idRef: d.idRef,
    days: d.days,
    notes: d.notes,
  };
}
