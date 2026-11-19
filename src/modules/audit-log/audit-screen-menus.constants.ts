/**
 * Review list 11-19 step 3 (follow-up), user 2026-11-19: a user reads a screen's audit
 * history only with the View right (`user_menus.um_can_view`) on that screen's menu.
 *
 * audit.audit_screen carries no menu id, and its ids are made per database (a writer
 * that names an unknown screen creates it), so the link is kept here, keyed by the
 * screen NAME the writers use. A screen whose records are shown on more than one menu
 * lists each: the View right on ANY of them is enough (the first is the one a refusal
 * names). Every screen with a History button in NexERP is in this list.
 *
 * A screen NOT in this list (a log no screen shows, or a name a writer made up later)
 * is read by an ADMIN or SUPER ADMIN only — never by default.
 */
export const AUDIT_SCREEN_MENUS: ReadonlyMap<string, readonly number[]> = new Map<
  string,
  readonly number[]
>(
  (
    [
      // ── Inventory masters ──
      ['Item Group Master', [35]],
      ['Item Brand Master', [36]],
      ['Item Section Master', [37]],
      ['Units Master', [38]],
      ['Godown Location Master', [39]],
      ['Tax Rate Master', [40]],
      ['Category Master', [240]],
      ['Item Size Master', [291]],
      ['Item Colour Master', [292]],
      // Item Master and the child rows its History pulls in (one item, one trail).
      ['Item Master', [29]],
      ['Item Unit Conversion Master', [29]],
      ['Item Price Master', [29]],
      ['Item EAN Code Master', [29]],
      ['Item Reorder Master', [29]],
      ['Item Qty Price Master', [244]],
      ['Change Selling Price', [30]],
      ['Cost Price – Bulk Change', [298]],
      // ── Sales masters ──
      ['Customer Master', [10]],
      ['State Master', [18]],
      ['City Master', [19]],
      ['Area Master', [20]],
      ['Customer Group Master', [21]],
      ['Tender Master', [95]],
      ['Tender Type Master', [95]],
      ['Vehicle Master', [125]],
      ['Freight Charges', [130]],
      ['Sale Freight Charges', [130]],
      ['Sale Loading Charges', [177]],
      ['Promotion Loyalty Points', [67]],
      ['Promotion Scheme', [247]],
      ['Till Masters', [275, 280, 281, 282]],
      // ── Purchase masters ──
      ['Supplier Master', [22]],
      ['Supplier Group Master', [27]],
      ['Transporter Master', [149]],
      // ── Accounts masters ──
      ['Account Ledger Master', [53]],
      ['Ledger Bank Account', [53]],
      ['Ledger Shipping Address', [53, 10]],
      ['Account Group Master', [54]],
      // ── Settings / admin ──
      ['Company Master', [56]],
      ['Employee Master', [57]],
      ['User Administration', [58]],
      ['Print Template', [62]],
      ['Employee Department Master', [70]],
      ['Employee Designation Master', [71]],
      ['Grid Details', [73]],
      ['Dropdown Details', [77]],
      ['Branch Master', [191]],
      ['Device List Master', [239]],
      ['UI Table Master', [242]],
      ['UI Table Columns', [242]],
      ['Charge Master', [245]],
      ['App Settings', [246]],
      ['Print Template Assignments', [248]],
      ['Posting Ledger Map', [250]],
      ['App Theme Master', [266]],
      ['App Theme Template', [266]],
      ['GST Provider', [269]],
      ['GST Provider Service', [269]],
      ['GST Provider Error Map', [269]],
      ['GST Provider Endpoint', [269]],
      ['GST Provider Field Map', [269]],
      ['GST Provider Account', [269]],
      ['GST Company Credential', [270]],
      ['Voucher Types', [303]],
      ['WhatsApp', [307]],
      // ── Documents ──
      // Sales orders: the order screen and the Sales Order Management desk both open them.
      ['Sale Order', [11, 299]],
      ['Sales Order', [11, 299]],
      ['Sale Bill', [12]],
      ['Sale Return', [13]],
      ['Sale Quotation', [14]],
      ['Delivery Challan', [182]],
      ['DC Return', [251]],
      ['Temporary Credit', [257]],
      ['Delivery Note', [305]],
      ['purchase order', [23]],
      ['Purchase', [24]],
      ['Purchase Return', [25]],
      ['Shortage Receipt', [195]],
      ['GRN', [196]],
      ['Stock Transfer', [41, 192]],
      ['Stock Transfer Receipt', [193]],
      ['Opening Stock', [44]],
      ['Physical Stock', [45]],
      ['Physical Stock Count', [45]],
      ['Stock Adjustment', [264]],
      ['Receipt', [99]],
      ['Payment', [100]],
      ['Voucher Register', [262]],
      ['Expense Voucher', [277]],
    ] as const
  ).map(([screenName, menuIds]) => [screenName.toLowerCase(), menuIds]),
);

/** The menus whose View right opens this screen's history; undefined = admins only. */
export const auditScreenMenusOf = (screenName: string): readonly number[] | undefined =>
  AUDIT_SCREEN_MENUS.get(screenName.trim().toLowerCase());

/** Reports > Audit Logs: every screen's events in one list. */
export const AUDIT_LOGS_MENU_ID = 106;

/** assertMenuRight's family: AUDIT_LOG_RIGHT_VIEW. */
export const AUDIT_LOG_RIGHT_PREFIX = 'AUDIT_LOG';

/** Who reads the history of a screen no menu shows (usr_type, read from user_master). */
export const AUDIT_UNMAPPED_SCREEN_READERS: readonly string[] = ['ADMIN', 'SUPER ADMIN'];
