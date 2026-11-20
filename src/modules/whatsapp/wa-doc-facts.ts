import { Prisma } from '@prisma/client';
import { waRefuse } from './wa-errors';
import { WA_CODES, WA_KIND_OF_DOC, WA_VT, type WaDocType, type WaKind } from './wa.constants';

type Raw = Pick<Prisma.TransactionClient, '$queryRaw'>;

/** What a send needs to know of one posted document (§5.2 step 2). */
export interface DocFacts {
  docType: WaDocType;
  kind: WaKind;
  docId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  refno: string;
  /** YYYY-MM-DD */
  date: string;
  amount: Prisma.Decimal;
  /** The document's status, unchanged by a send (the tsl step's to_status). */
  status: string;
  posted: boolean;
  cancelled: boolean;
  partyId: string | null;
  /** The name printed on the document (a walk-in's typed name). */
  docPartyName: string | null;
  /** The number typed on the order (so_cust_phone, else so_contact_phone). */
  docPhone: string | null;
  vchrTypeId: number | null;
  deviceId: string | null;
  /** The print purpose the PDF renders under (§5.2 step 7). */
  printPurposeCode: string;
}

export interface PartyFacts {
  partyId: string;
  name: string;
  whatsapp: string | null;
  phone1: string | null;
  phone2: string | null;
  lang: string | null;
  remindersOffOn: Date | null;
  allOffOn: Date | null;
}

const SO_POSTED = ['CONFIRMED', 'PARTIAL', 'COMPLETED', 'CLOSED', 'EXPIRED'];

const iso = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : '');

/** Reads the document, refusing a missing one with WA_DOC_NOT_FOUND. */
export async function readDocFacts(
  client: Raw,
  p: { companyId: string; docType: WaDocType; docId: string; accYear: string },
): Promise<DocFacts> {
  const kind = WA_KIND_OF_DOC[p.docType];
  // Scope cut 17/11: the Sales Order confirmation only (bills and receipts later).
  if (p.docType !== 'SALES_ORDER') {
    notFound(p);
  }
  const [r] = await client.$queryRaw<
    {
      so_branch_id: string;
      so_order_refno: string | null;
      so_order_date: Date | null;
      so_order_amt: Prisma.Decimal | null;
      so_status: string;
      so_cust_id: string | null;
      so_cust_name: string | null;
      so_cust_phone: string | null;
      so_contact_phone: string | null;
      so_device_id: string | null;
    }[]
  >`
    SELECT so_branch_id, so_order_refno, so_order_date, so_order_amt, so_status, so_cust_id, so_cust_name,
           so_cust_phone, so_contact_phone, so_device_id
      FROM sales.sale_order
     WHERE so_id = ${p.docId}::uuid AND so_acc_year = ${p.accYear}::bpchar
       AND so_company_id = ${p.companyId}::uuid AND so_is_deleted = false`;
  if (!r) notFound(p);
  return {
    docType: p.docType,
    kind,
    docId: p.docId,
    accYear: p.accYear,
    companyId: p.companyId,
    branchId: r.so_branch_id,
    refno: r.so_order_refno ?? '',
    date: iso(r.so_order_date),
    amount: new Prisma.Decimal(r.so_order_amt ?? 0),
    status: r.so_status,
    posted: SO_POSTED.includes(r.so_status),
    cancelled: r.so_status === 'CANCELLED',
    partyId: r.so_cust_id,
    docPartyName: r.so_cust_name,
    docPhone: r.so_cust_phone || r.so_contact_phone,
    vchrTypeId: WA_VT.ORDER,
    deviceId: r.so_device_id,
    printPurposeCode: 'SALE_ORDER',
  };
}

function notFound(p: { docType: string; docId: string; accYear: string }): never {
  waRefuse(
    WA_CODES.DOC_NOT_FOUND,
    `No ${p.docType} ${p.docId} in year ${p.accYear} for this company`,
    'docId',
  );
}

export async function readParty(client: Raw, partyId: string): Promise<PartyFacts | null> {
  const [r] = await client.$queryRaw<
    {
      led_id: string;
      led_name: string;
      led_whatsapp_no: string | null;
      led_phone1: string | null;
      led_phone2: string | null;
      led_wa_lang: string | null;
      led_wa_reminders_off_on: Date | null;
      led_wa_all_off_on: Date | null;
    }[]
  >`
    SELECT led_id, led_name, led_whatsapp_no, led_phone1, led_phone2, led_wa_lang,
           led_wa_reminders_off_on, led_wa_all_off_on
      FROM accounts.acc_ledger_master
     WHERE led_id = ${partyId}::uuid AND led_is_deleted = false`;
  return r
    ? {
        partyId: r.led_id,
        name: r.led_name,
        whatsapp: r.led_whatsapp_no,
        phone1: r.led_phone1,
        phone2: r.led_phone2,
        lang: r.led_wa_lang,
        remindersOffOn: r.led_wa_reminders_off_on,
        allOffOn: r.led_wa_all_off_on,
      }
    : null;
}

/** The phone a customer is told to call: the branch's, else the company's. */
export async function shopPhone(client: Raw, companyId: string, branchId: string | null): Promise<string | null> {
  const [r] = await client.$queryRaw<{ phone: string | null }[]>`
    SELECT COALESCE(NULLIF(btrim(b.br_phone), ''), NULLIF(btrim(b.br_tel), ''),
                    NULLIF(btrim(c.comp_phone), ''), NULLIF(btrim(c.comp_tel), '')) AS phone
      FROM public.companys c
      LEFT JOIN public.branch_master b ON b.br_id = ${branchId}::uuid
     WHERE c.comp_id = ${companyId}::uuid`;
  return r?.phone ?? null;
}

/** 1234567.5 → "12,34,567.50" (the print designs' ##,##,##0.00). */
export function inr(v: Prisma.Decimal | number | string): string {
  const d = new Prisma.Decimal(v).abs().toFixed(2);
  const [whole, frac] = d.split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${grouped}.${frac}`;
}

/** YYYY-MM-DD → DD-MM-YYYY. */
export function dmy(isoDate: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/**
 * The values a template's named parameters take (§4.3 texts). Only the
 * template's own `params` are sent (the relay refuses an extra or an empty one);
 * a value that is blank goes as "-".
 */
export function templateParams(names: readonly string[], values: Record<string, string | null | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of names) {
    const v = (values[n] ?? '').toString().replace(/\s+/g, ' ').trim();
    out[n] = (v || '-').slice(0, 1024);
  }
  return out;
}

/** A PDF file name WhatsApp shows the customer: "Bill-BIL04857.pdf". */
export function pdfName(prefix: string, ref: string): string {
  const safe = `${prefix}-${ref}`.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${safe.slice(0, 90) || prefix}.pdf`;
}
