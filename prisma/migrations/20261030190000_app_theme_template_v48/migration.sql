-- ═══════════════════════════════════════════════════════════════════════════
--  App theme template v48 — carried to every server by the deploy      2026-10-30
--
--  The stylesheet template (public.app_theme_template.tpl_qss) was seeded once by
--  20261001140000_app_theme_template (v1). Every version since was PUBLISHED through
--  POST /app-themes/template/save on the dev box only, so nothing carried it to the live
--  server. From v48 on, an approved version is first published on dev through the API (that
--  path validates placeholders and braces and is audited), then shipped as a migration like
--  this one, with exactly the same text (md5 634b89cc6f8ab7ab9cfaa1c9e05e5859).
--
--  v48 = v47 + the Purchase Order (menu 23) block: the Revision / Approval pills, the
--  one-row audit label, the quick icon strip, the header grid with no row gap.
--
--  The template is replaced ONLY when the server's current text is a version we shipped
--  (v1..v47, by md5 — 48 known texts). A template a company changed on the App Themes
--  screen (menu 266) is LEFT ALONE, with a NOTICE. It never raises: a theme must not fail a
--  deploy (P3009). tpl_modified_on moves, so the clients' cached copy and ETag refresh.
--  No sync calls.
-- ═══════════════════════════════════════════════════════════════════════════

DO $mig$
DECLARE
    v_new   text := $qss_v48$/* ═══════════════════════════════════════════════════════════════════════
   NEXERP theme template — v46 (2026-10-29): v45 + the Supplier Dues block (menu 297) at the end. Earlier history: v6 (2026-10-01) A, B, D, C — the whole app
   app_theme_template.tpl_qss. The ONE set of stylesheet rules; every
   double-brace placeholder is a colour token of the company's theme (app_theme_master
   .thm_tokens). share/theme/plan-app-theme-template.md.

   v1 = sweep step 1: the former src/shared/styles/app.qss (part A) and
   the main window's own sheet (part B, scoped under MenuWindow because it
   was set on MenuWindow and reached everything inside it).

   Literals left as written are not the brand: dialog background, scroll
   bars, the dark drop-down menus, and the fixed action-button colours
   (Add green, Delete red, ...). They are still theme-master data — this
   text is edited on the theme master screen, not in the client.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Part A: application-wide ─────────────────────────────────────────── */

QDialog {
    background-color: #F5F6FA;
    font-family: "Inter", "Noto Sans", "Segoe UI";
    font-size: 13px;
    color: #1F2937;
}

QLabel[class="lblTitle"] {
    color: {{text}};
    font-size: 20px;
    font-weight: 700;
}

QLabel[class="lblSubTitle"] {
    color: {{text.muted}};
}

QTabWidget
{
        border:none;
}

QTabWidget::pane {
  border: none;
  border-top: 1px solid {{border}};
  top: -1px;
  background: {{surface}};
}

QTabBar::tab {
  background: {{surface.alt}};
  color: {{text.muted}};
  border: none;
  border-top: 3px solid transparent;
  padding: 6px 16px;
  margin-right: 2px;
}

QTabBar::tab:selected {
  background: {{surface}};
  color: {{text}};
  font-weight: 700;
}

QTabBar::tab:!selected:hover {
  background: #E5E7EB;
}


QTableWidget QLineEdit {
    background: {{table.row}};
    border: none;
    padding: 0px 0px;
    margin: 0px;
    color: #222222;
}

QTableWidget QLineEdit:focus {
    background: {{table.row}};
    border: 0px solid {{primary}};
    outline: none;
}

QTableWidget QSpinBox {
    background: {{table.row}};
    border: none;
    padding: 0px;
    margin: 0px;
    color: #222222;
}

QTableWidget QSpinBox:focus {
    background: {{table.row}};
    border: none;
    outline: none;
}


QLineEdit,
QPlainTextEdit,
QTextEdit,
QSpinBox,
QDoubleSpinBox,
QDateEdit,
QTimeEdit,
QDateTimeEdit
{
    background-color: {{surface}};
    color: {{text}};
    border: 1px solid #D1D5DB;
    padding: 5px 7px;
    selection-background-color: {{primary}};
    selection-color: {{on.primary}};
}

QDateEdit:focus,
QLineEdit:focus,
QTextEdit:focus,
QPlainTextEdit:focus,
QComboBox:focus,
QSpinBox:focus,
QDoubleSpinBox:focus,
QDateEdit:focus,
QTimeEdit:focus,
QDateTimeEdit:focus
{
    border: 1px solid {{primary}};
}

/* ── Spin, date, time and date-time fields (v19) ─────────────────────────
   One look for every QAbstractSpinBox: QSpinBox, QDoubleSpinBox, QDateEdit,
   QTimeEdit and QDateTimeEdit (the last three are all QDateTimeEdit, so
   that selector reaches them). Up/down buttons stacked on the right; a
   calendarPopup field shows one drop-down button like the combo. */

QAbstractSpinBox {
    padding-right: 26px;
}

QAbstractSpinBox:disabled {
    background-color: {{surface.alt}};
    color: #9CA3AF;
    border: 1px solid {{border}};
}

QAbstractSpinBox::up-button,
QAbstractSpinBox::down-button {
    subcontrol-origin: border;
    width: 24px;
    border-left: 1px solid {{border}};
    background-color: transparent;
}

QAbstractSpinBox::up-button {
    subcontrol-position: top right;
    border-bottom: 1px solid {{border}};
}

QAbstractSpinBox::down-button {
    subcontrol-position: bottom right;
}

QAbstractSpinBox::up-button:hover,
QAbstractSpinBox::down-button:hover {
    background-color: {{primary.soft}};
}

QAbstractSpinBox::up-button:pressed,
QAbstractSpinBox::down-button:pressed {
    background-color: {{primary.pressed.bg}};
}

QAbstractSpinBox::up-arrow {
    image: url(:/resources/assets/icons/up_arrow.svg);
    width: 10px;
    height: 10px;
}

QAbstractSpinBox::down-arrow {
    image: url(:/resources/assets/icons/down_arrow.svg);
    width: 10px;
    height: 10px;
}

QAbstractSpinBox::up-arrow:off,
QAbstractSpinBox::down-arrow:off {
    image: none;
}

QDateTimeEdit[calendarPopup="true"] {
    padding-right: 30px;
}

QDateTimeEdit::drop-down {
    subcontrol-origin: border;
    subcontrol-position: top right;
    width: 28px;
    border-left: 1px solid {{border}};
    background-color: transparent;
}

QDateTimeEdit::drop-down:hover {
    background-color: {{primary.soft}};
}

QDateTimeEdit::down-arrow {
    image: url(:/resources/assets/icons/down_arrow.svg);
    width: 12px;
    height: 12px;
}

/* the calendar: a QDateTimeEdit popup and NexDateEdit's picker */
QCalendarWidget QWidget#qt_calendar_navigationbar {
    background-color: {{primary}};
}

QCalendarWidget QToolButton {
    background-color: transparent;
    color: {{on.primary}};
    border: none;
    padding: 4px 8px;
    font-weight: 600;
}

QCalendarWidget QToolButton:hover {
    background-color: {{primary.hover}};
}

QCalendarWidget QToolButton::menu-indicator {
    image: none;
}

QCalendarWidget QMenu {
    background-color: {{surface}};
    color: {{text}};
}

QCalendarWidget QSpinBox {
    background-color: {{surface}};
    color: {{text}};
    border: 1px solid {{border}};
    padding: 2px 4px;
}

QCalendarWidget QAbstractItemView {
    background-color: {{surface}};
    color: {{text}};
    selection-background-color: {{primary}};
    selection-color: {{on.primary}};
    outline: 0px;
}

QCalendarWidget QAbstractItemView:disabled {
    color: #9CA3AF;
}

QComboBox {
    background-color: {{surface}};
    color: {{text}};

    border: 1px solid #D1D5DB;
    padding: 5px 32px 5px 10px;


    selection-background-color: {{primary}};
    selection-color: {{on.primary}};
}

QComboBox:focus {
    border: 1px solid {{primary}};
}

QComboBox:disabled {
    background-color: {{surface.alt}};
    color: #9CA3AF;
    border: 1px solid {{border}};
}

QComboBox::drop-down {
    subcontrol-origin: padding;
    subcontrol-position: top right;

    width: 28px;
    border-left: 1px solid {{border}};
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;

    background-color: transparent;
}

QComboBox::down-arrow {
    image: url(:/resources/assets/icons/down_arrow.svg);
    width: 12px;
    height: 12px;
}

/* Dropdown popup */
QComboBox QAbstractItemView {
    background-color: {{surface}};
    color: {{text}};

    outline: 0px;

    selection-background-color: {{primary}};
    selection-color: {{on.primary}};
}

QComboBox QAbstractItemView::item {
    min-height: 40px;
}

QComboBox QAbstractItemView::item:hover {
    background-color: {{primary.soft}};
    color: {{primary}};
}

QComboBox QAbstractItemView::item:selected {
    background-color: {{primary}};
    color: {{on.primary}};
}


/* ── Buttons: ONE system for every form (v8) ─────────────────────────────
   standard  every QPushButton
   primary   the form's main action — by name (btnSave, btnPost, …) or
             nexRole="primary" for a button made in code without one
   danger    destroys or reverses (btnDelete, btnCancelVoucher, …)
   success   the cheque registers' Clear / Presented
   checked   any checkable button that is on (scope switch, kind strip)
   Screens never style a button themselves; the canvas designer, the master
   list toolbar, chips, pagers and dialogs' message boxes keep their own. */
QPushButton {
    background-color: {{surface}};
    color: {{text}};
    border: 1px solid #CBD2DA;
    border-radius: 4px;
    padding: 5px 14px;
}
QPushButton:hover,
QPushButton:focus {
    background-color: {{primary.soft}};
    border-color: {{primary.soft.border}};
    color: {{primary}};
}
QPushButton:pressed {
    background-color: {{primary.pressed.bg}};
    border-color: {{primary.pressed.border}};
    color: {{primary}};
}
QPushButton:checked {
    background-color: {{primary}};
    border-color: {{primary}};
    color: {{on.primary}};
    font-weight: bold;
}
QPushButton:disabled {
    background-color: {{surface.alt}};
    border-color: {{border}};
    color: #9CA3AF;
}

QPushButton[nexRole="primary"],
QPushButton#btnSave, QPushButton#btnPost, QPushButton#pBtnSave, QPushButton#pBSave,
QPushButton#btnOk, QPushButton#btnPanelOk, QPushButton#btnPick, QPushButton#btnBookSave,
QPushButton#btnBelowCostSave, QPushButton#btnFilterApply,
QPushButton#settingsSave, QPushButton#btnDeposit, QPushButton#btnReplace {
    background-color: {{primary}};
    border-color: {{primary}};
    color: {{on.primary}};
    font-weight: bold;
}
QPushButton[nexRole="primary"]:hover, QPushButton[nexRole="primary"]:focus,
QPushButton#btnSave:hover, QPushButton#btnSave:focus, QPushButton#btnPost:hover, QPushButton#btnPost:focus,
QPushButton#pBtnSave:hover, QPushButton#pBSave:hover, QPushButton#btnOk:hover, QPushButton#btnOk:focus,
QPushButton#btnPanelOk:hover, QPushButton#btnPanelOk:focus, QPushButton#btnPick:hover, QPushButton#btnPick:focus,
QPushButton#btnBookSave:hover, QPushButton#btnBelowCostSave:hover, QPushButton#btnBelowCostSave:focus,
QPushButton#btnFilterApply:hover, QPushButton#btnFilterApply:focus,
QPushButton#settingsSave:hover, QPushButton#btnDeposit:hover, QPushButton#btnReplace:hover {
    background-color: {{primary.hover}};
    border-color: {{primary.hover}};
    color: {{on.primary}};
}
QPushButton[nexRole="primary"]:disabled,
QPushButton#btnSave:disabled, QPushButton#btnPost:disabled, QPushButton#pBtnSave:disabled, QPushButton#pBSave:disabled,
QPushButton#btnOk:disabled, QPushButton#btnPanelOk:disabled, QPushButton#btnPick:disabled, QPushButton#btnBookSave:disabled,
QPushButton#btnBelowCostSave:disabled, QPushButton#btnFilterApply:disabled,
QPushButton#settingsSave:disabled, QPushButton#btnDeposit:disabled, QPushButton#btnReplace:disabled {
    background-color: {{primary.pressed.border}};
    border-color: {{primary.pressed.border}};
    color: {{on.primary}};
}

QPushButton[nexRole="danger"],
QPushButton#btnDelete, QPushButton#btnDeleteDraft, QPushButton#btnDeleteRow, QPushButton#btnDeleteColumn,
QPushButton#pBtnDeleteColumn, QPushButton#btnCancelVoucher, QPushButton#btnCancelBill, QPushButton#btnCancelDoc,
QPushButton#btnUnmap, QPushButton#btnBounce, QPushButton#btnReturned {
    color: {{danger}};
    border-color: {{danger}};
}
QPushButton[nexRole="danger"]:hover, QPushButton[nexRole="danger"]:focus,
QPushButton#btnDelete:hover, QPushButton#btnDelete:focus, QPushButton#btnDeleteDraft:hover, QPushButton#btnDeleteDraft:focus,
QPushButton#btnDeleteRow:hover, QPushButton#btnDeleteColumn:hover, QPushButton#pBtnDeleteColumn:hover,
QPushButton#btnCancelVoucher:hover, QPushButton#btnCancelVoucher:focus, QPushButton#btnCancelBill:hover, QPushButton#btnCancelBill:focus,
QPushButton#btnCancelDoc:hover, QPushButton#btnCancelDoc:focus, QPushButton#btnUnmap:hover, QPushButton#btnUnmap:focus,
QPushButton#btnBounce:hover, QPushButton#btnBounce:focus, QPushButton#btnReturned:hover, QPushButton#btnReturned:focus {
    background-color: {{danger.bg}};
    border-color: {{danger}};
    color: {{danger}};
}
QPushButton[nexRole="danger"]:disabled,
QPushButton#btnDelete:disabled, QPushButton#btnDeleteDraft:disabled, QPushButton#btnDeleteRow:disabled,
QPushButton#btnDeleteColumn:disabled, QPushButton#pBtnDeleteColumn:disabled, QPushButton#btnCancelVoucher:disabled,
QPushButton#btnCancelBill:disabled, QPushButton#btnCancelDoc:disabled, QPushButton#btnUnmap:disabled,
QPushButton#btnBounce:disabled, QPushButton#btnReturned:disabled {
    background-color: {{surface.alt}};
    border-color: {{border}};
    color: #9CA3AF;
}

QDialog#ReceivedCheques QPushButton#btnClear:enabled,
QDialog#IssuedCheques QPushButton#btnPresented:enabled {
    color: {{success}};
    border-color: {{success}};
}
QDialog#ReceivedCheques QPushButton#btnClear:hover:enabled,
QDialog#IssuedCheques QPushButton#btnPresented:hover:enabled {
    background-color: {{success.bg}};
}


QPushButton[class="action"] {
    background-color: {{surface}};
    color: {{text}};

    padding: 7px 16px;
}

/* Hover - light maroon */


/* Click / Pressed - maroon */


/* Disabled */


/* ── Tables — 3.0's grid (its Maroon style_sheets row), every colour a table.* token.
   Row numbers are drawn by NexTblHeaderView from THIS rule's colours (the table's
   background / alternate-background / selection / color / gridline-color), so the
   gutter alternates with its rows and marks the current row; nothing is set in code. ── */
QTableView {
    background-color: {{table.row}};
    alternate-background-color: {{table.row.alt}};
    gridline-color: #DCDFE4;
    border: 1px solid #CBD0D7;
    color: {{text}};
    selection-background-color: {{table.selected}};
    selection-color: {{table.selected.fg}};
    outline: 0;
}

QTableView::item {
    padding: 0px 6px;
    border: none;
}

QTableView::item:selected {
    background-color: {{table.selected}};
    color: {{table.selected.fg}};
}

/* the header's empty area (below the last row number, right of the last column) */
QHeaderView {
    background-color: {{table.row}};
}

QHeaderView::section:horizontal {
    background-color: {{table.header.bg}};
    color: {{table.header.fg}};
    font-weight: bold;
    padding: 4px 6px;
    border: 1px solid #CBD0D7;
    border-left: none;
    border-top: none;
}

QHeaderView::section:vertical {
    width: 40px;
}

/* The blank area of a grid — below the last row, right of the last column, and the
   header beside / under it — grey, as 3.0's table_bgcolor. NexTable / NexApiTableView
   read qproperty-emptyAreaColor; rows keep their own colours. */
NexTable, NexApiTableView {
    qproperty-emptyAreaColor: #E1E4E8;
}

NexTable QHeaderView, NexApiTableView QHeaderView {
    background-color: #E1E4E8;
}

/* Top-left corner — NexTable paints it as one more header section ("#") with the
   section:horizontal rule above; this rule is the fallback for plain QTableViews */
QTableCornerButton::section {
    background-color: {{table.header.bg}};
    color: {{table.header.fg}};
    font-weight: bold;
    border: 1px solid #CBD0D7;
    border-left: none;
    border-top: none;
}

/* Scrollbar */
QScrollBar:vertical {
    background: {{surface}};
    width: 10px;
    margin: 0px;
    border: none;
}

QScrollBar::handle:vertical {
    background: #d1d5db;
    border-radius: 5px;
    min-height: 30px;
}

QScrollBar::handle:vertical:hover {
    background: #9ca3af;
}

QScrollBar::add-line:vertical,
QScrollBar::sub-line:vertical {
    height: 0px;
}

QScrollBar:horizontal {
    background: {{surface}};
    height: 10px;
    margin: 0px;
    border: none;
}

QScrollBar::handle:horizontal {
    background: #d1d5db;
    border-radius: 5px;
    min-width: 30px;
}

QScrollBar::handle:horizontal:hover {
    background: #9ca3af;
}

QScrollBar::add-line:horizontal,
QScrollBar::sub-line:horizontal {
    width: 0px;
}


/* =========================================================
   MASTER LIST ACTION BUTTON - COMMON STYLE
   ========================================================= */

QToolButton[nexRole="masterActionButton"] {
    /* icon LEFT, text RIGHT (v18): the template, not the code, picks the style */
    qproperty-toolButtonStyle: ToolButtonTextBesideIcon;
    qproperty-iconSize: 18px 18px;
    min-width: 0px;
    padding: 6px 12px;

    background-color: {{surface}};
    color: #1F2937;

    border: 1px solid {{border}};
    border-radius: 8px;

    font-size: 12px;
    font-weight: 600;
}

QToolButton[nexRole="masterActionButton"]:hover {
    background-color: {{primary.softer}};
    border: 1px solid {{primary.soft.border}};
    color: {{primary}};
}

QToolButton[nexRole="masterActionButton"]:pressed {
    background-color: {{primary.pressed.bg}};
    border: 1px solid {{primary.pressed.border}};
}

QToolButton[nexRole="masterActionButton"]:disabled {
    background-color: #F5F5F5;
    color: #9CA3AF;
    border: 1px solid {{border}};
}


/* =========================================================
   FILTER - PURPLE
   ========================================================= */

QToolButton[nexRole="masterActionButton"][nexAction="filter"] {
    background-color: #F5F0FF;
    color: #7C3AED;
    border: 1px solid #DDD0FF;
}

QToolButton[nexRole="masterActionButton"][nexAction="filter"]:hover {
    background-color: #EDE4FF;
    border: 1px solid #C4B5FD;
    color: #6D28D9;
}

QToolButton[nexRole="masterActionButton"][nexAction="filter"]:pressed {
    background-color: #DDD6FE;
    border: 1px solid #A78BFA;
    color: #5B21B6;
}


/* =========================================================
   ADD - GREEN
   ========================================================= */

QToolButton[nexRole="masterActionButton"][nexAction="add"] {
    background-color: #ECFDF3;
    color: #15803D;
    border: 1px solid #BBF7D0;
}

QToolButton[nexRole="masterActionButton"][nexAction="add"]:hover {
    background-color: #DCFCE7;
    border: 1px solid #86EFAC;
    color: #166534;
}

QToolButton[nexRole="masterActionButton"][nexAction="add"]:pressed {
    background-color: #BBF7D0;
    border: 1px solid #4ADE80;
    color: #14532D;
}


/* =========================================================
   EDIT - BLUE
   ========================================================= */

QToolButton[nexRole="masterActionButton"][nexAction="edit"] {
    background-color: #EFF6FF;
    color: #2563EB;
    border: 1px solid #BFDBFE;
}

QToolButton[nexRole="masterActionButton"][nexAction="edit"]:hover {
    background-color: #DBEAFE;
    border: 1px solid #93C5FD;
    color: #1D4ED8;
}

QToolButton[nexRole="masterActionButton"][nexAction="edit"]:pressed {
    background-color: #BFDBFE;
    border: 1px solid #60A5FA;
    color: #1E40AF;
}


/* =========================================================
   DELETE - RED
   ========================================================= */

QToolButton[nexRole="masterActionButton"][nexAction="delete"] {
    background-color: #FEF2F2;
    color: #DC2626;
    border: 1px solid #FECACA;
}

QToolButton[nexRole="masterActionButton"][nexAction="delete"]:hover {
    background-color: #FEE2E2;
    border: 1px solid #FCA5A5;
    color: #B91C1C;
}

QToolButton[nexRole="masterActionButton"][nexAction="delete"]:pressed {
    background-color: #FECACA;
    border: 1px solid #F87171;
    color: #991B1B;
}


/* =========================================================
   REFRESH - SLATE
   ========================================================= */

QToolButton[nexRole="masterActionButton"][nexAction="refresh"] {
    background-color: #F8FAFC;
    color: #475569;
    border: 1px solid #CBD5E1;
}

QToolButton[nexRole="masterActionButton"][nexAction="refresh"]:hover {
    background-color: #F1F5F9;
    border: 1px solid #94A3B8;
    color: #334155;
}

QToolButton[nexRole="masterActionButton"][nexAction="refresh"]:pressed {
    background-color: #E2E8F0;
    border: 1px solid #64748B;
    color: #1E293B;
}


/* =========================================================
   IMPORT DATA - INDIGO
   ========================================================= */

QToolButton[nexRole="masterActionButton"][nexAction="import"] {
    background-color: #EEF2FF;
    color: #4F46E5;
    border: 1px solid #C7D2FE;
}

QToolButton[nexRole="masterActionButton"][nexAction="import"]:hover {
    background-color: #E0E7FF;
    border: 1px solid #A5B4FC;
    color: #4338CA;
}

QToolButton[nexRole="masterActionButton"][nexAction="import"]:pressed {
    background-color: #C7D2FE;
    border: 1px solid #818CF8;
    color: #3730A3;
}


/* =========================================================
   EXPORT EXCEL - GREEN
   ========================================================= */

QToolButton[nexRole="masterActionButton"][nexAction="export"] {
    background-color: #F0FDF4;
    color: #15803D;
    border: 1px solid #BBF7D0;
}

QToolButton[nexRole="masterActionButton"][nexAction="export"]:hover {
    background-color: #DCFCE7;
    border: 1px solid #86EFAC;
    color: #166534;
}

QToolButton[nexRole="masterActionButton"][nexAction="export"]:pressed {
    background-color: #BBF7D0;
    border: 1px solid #4ADE80;
    color: #14532D;
}


/* =========================================================
   PRINT - DARK SLATE
   ========================================================= */

QToolButton[nexRole="masterActionButton"][nexAction="print"] {
    background-color: #F8FAFC;
    color: #334155;
    border: 1px solid #CBD5E1;
}

QToolButton[nexRole="masterActionButton"][nexAction="print"]:hover {
    background-color: #E2E8F0;
    border: 1px solid #94A3B8;
    color: #1E293B;
}

QToolButton[nexRole="masterActionButton"][nexAction="print"]:pressed {
    background-color: #CBD5E1;
    border: 1px solid #64748B;
    color: #0F172A;
}


/* =========================================================
   HISTORY - TEAL
   ========================================================= */

QToolButton[nexRole="masterActionButton"][nexAction="history"] {
    background-color: #F0FDFA;
    color: #0F766E;
    border: 1px solid #99F6E4;
}

QToolButton[nexRole="masterActionButton"][nexAction="history"]:hover {
    background-color: #CCFBF1;
    border: 1px solid #5EEAD4;
    color: #0F766E;
}

QToolButton[nexRole="masterActionButton"][nexAction="history"]:pressed {
    background-color: #99F6E4;
    border: 1px solid #2DD4BF;
    color: #115E59;
}


/* =========================================================
   SMS - BLUE
   ========================================================= */

QToolButton[nexRole="masterActionButton"][nexAction="sms"] {
    background-color: #EFF6FF;
    color: #2563EB;
    border: 1px solid #BFDBFE;
}

QToolButton[nexRole="masterActionButton"][nexAction="sms"]:hover {
    background-color: #DBEAFE;
    border: 1px solid #93C5FD;
    color: #1D4ED8;
}

QToolButton[nexRole="masterActionButton"][nexAction="sms"]:pressed {
    background-color: #BFDBFE;
    border: 1px solid #60A5FA;
    color: #1E40AF;
}


/* =========================================================
   WHATSAPP - GREEN
   ========================================================= */

QToolButton[nexRole="masterActionButton"][nexAction="whatsapp"] {
    background-color: #F0FDF4;
    color: #16A34A;
    border: 1px solid #BBF7D0;
}

QToolButton[nexRole="masterActionButton"][nexAction="whatsapp"]:hover {
    background-color: #DCFCE7;
    border: 1px solid #86EFAC;
    color: #15803D;
}

QToolButton[nexRole="masterActionButton"][nexAction="whatsapp"]:pressed {
    background-color: #BBF7D0;
    border: 1px solid #4ADE80;
    color: #166534;
}

/* ── Part B: the main window (MenuWindow) ─────────────────────────────
   v18 = option A "light bar" (share/theme/menu_style_diff.png), one set of
   rules (v1–v17 carried two). Colours are TOKENS, so the bar follows each
   company's theme: a light surface, the theme's text, its primary as the
   accent. Module icons are tinted with primary in code
   (MenuWindow::tintModuleIcons), re-tinted when the theme changes. */

/* Module icon colour — MenuWindow::menuIconTint (the icons are tinted in code) */
MenuWindow { qproperty-menuIconTint: {{primary}}; }

/* Bar */
MenuWindow QToolBar,
MenuWindow QToolBar#topToolBar {
    background-color: {{surface}};
    border: none;
    border-bottom: 1px solid {{border}};
    padding: 0;
    spacing: 0;
}
MenuWindow QMenuBar {
    background-color: {{surface}};
    border: none;
    border-bottom: 1px solid {{border}};
}
MenuWindow QMenuBar::item { background: transparent; color: {{text}}; padding: 0 14px; }
MenuWindow QMenuBar::item:selected,
MenuWindow QMenuBar::item:pressed { background-color: {{primary.soft}}; color: {{primary}}; }

/* Module buttons */
MenuWindow QToolButton[class="menuButton"] {
    background: transparent;
    color: {{text}};
    border: none;
    border-bottom: 3px solid transparent;
    padding: 6px 14px 4px 14px;
    font-size: 13px;
    font-weight: 600;
    min-width: 64px;
}
MenuWindow QToolButton[class="menuButton"]:hover {
    background-color: {{primary.softer}};
    color: {{primary}};
    border-bottom: 3px solid {{primary.soft.border}};
}
MenuWindow QToolButton[class="menuButton"]:pressed,
MenuWindow QToolButton[class="menuButton"][popupMode="1"]:pressed {
    background-color: {{primary.soft}};
    color: {{primary}};
    border-bottom: 3px solid {{primary}};
}
MenuWindow QToolButton[class="menuButton"]::menu-indicator { image: none; width: 0; height: 0; }

/* Drop-down menus */
MenuWindow QMenu {
    background-color: {{surface}};
    color: {{text}};
    border: 1px solid {{border}};
    border-radius: 8px;
    padding: 6px;
    font-size: 13px;
}
MenuWindow QMenu::item {
    padding: 8px 32px 8px 12px;
    background: transparent;
    color: {{text}};
    border-radius: 6px;
}
MenuWindow QMenu::item:selected { background-color: {{primary.soft}}; color: {{primary}}; }
MenuWindow QMenu::item:disabled { color: {{text.muted}}; }
MenuWindow QMenu::separator { height: 1px; background: {{border}}; margin: 5px 8px; }
MenuWindow QMenu::right-arrow { width: 8px; height: 8px; right: 10px; image: url(:/resources/assets/icons/quick/chevron_right.svg); }

/* Brand */
MenuWindow QFrame#frameBrand { background-color: transparent; border: none; }
MenuWindow QLabel#lblLogoBox {
    background-color: {{primary}};
    color: {{on.primary}};
    border-radius: 8px;
    font-size: 20px;
    font-weight: 800;
}
MenuWindow QLabel#lblAppName { color: {{text}}; font-size: 23px; font-weight: 800; }
MenuWindow QLabel#lblSubTitle { color: {{text.muted}}; }

/* Company / branch / year selectors */
/* One container, three EQUAL segments (MenuWindow::kSelectorWidth), flat combos */
MenuWindow QFrame#frameRightSelectors { background-color: {{surface}}; border: 1px solid {{border}}; border-radius: 10px; }
MenuWindow QFrame[class="selectorCard"] { background: transparent; border: none; border-radius: 0; }
MenuWindow QFrame#frameSelectorBranch,
MenuWindow QFrame#frameSelectorYear { border-left: 1px solid {{border}}; }
MenuWindow QLabel[class="selectorLabel"] { color: {{text.muted}}; font-size: 10px; font-weight: 700; padding-left: 6px; }
MenuWindow QFrame[class="selectorCard"] QComboBox { border: none; background: transparent; color: {{text}}; font-weight: 600; padding: 0 4px; }
MenuWindow QFrame[class="selectorCard"] QComboBox::drop-down { border: none; background: transparent; }

/* User box */
MenuWindow QFrame#userBox { background: transparent; border: 0px; }
MenuWindow QLabel#userName { color: {{text}}; font-size: 13px; font-weight: 800; }
MenuWindow QLabel#userRole { color: {{text.muted}}; font-size: 11px; font-weight: 700; }
MenuWindow QLabel#avatarIcon { background-color: {{primary}}; border-radius: 25px; }
MenuWindow QLabel#userArrow { color: {{text}}; font-size: 14px; font-weight: 800; }

/* Footer */
MenuWindow QFrame#footerFrame { background: {{surface}}; border-top: 1px solid {{border}}; }
MenuWindow QLabel[class="footerText"] { color: {{text}}; font-size: 13px; font-weight: 600; }
MenuWindow QLabel[class="footerValue"] { color: {{primary}}; font-size: 13px; font-weight: 700; }
MenuWindow QLabel[class="footerSeparator"] { color: #CBD5E1; font-size: 20px; font-weight: 300; }
MenuWindow QLabel#footerStatus { color: {{text}}; background: transparent; border: 0px; padding: 0px; font-size: 14px; font-weight: 700; }
MenuWindow QLabel#footerDot { color: #16A34A; font-size: 18px; font-weight: 900; }

/* ── Part D: screens (sweep step 3) ─────────────────────────────────────
   Each screen's own stylesheet, scoped under its id. Order matters: A (app),
   B (main window), D (screens), C (shared widgets) — the order Qt used to
   apply them in by distance (a widget's own sheet beat its screen's, which
   beat the app's). A screen opened INSIDE another (tender in a sale bill,
   cheque books in a cheque register) comes after it. */
/* ReceiptEntry (receipt_entry.ui) */
QDialog#ReceiptEntry,
QWidget QDialog#ReceiptEntry,
QDialog#ReceiptEntry QDialog { background-color: #F4F5F7; }
QDialog#ReceiptEntry QLabel#lblFormTitle { font-size: 19px; font-weight: 700; color: #111827; }
QDialog#ReceiptEntry QLabel#lblSubtitle { font-size: 11px; color: #6B7280; }
QDialog#ReceiptEntry QLabel#lblStatusPill { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 10px; background-color: #FEF3C7; color: #92400E; }
QDialog#ReceiptEntry QLabel#lblBillsHeading,
QDialog#ReceiptEntry QLabel#lblTendersHeading { font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: #7B1113; }
QDialog#ReceiptEntry QLabel[caption="true"] { font-size: 10px; font-weight: 700; color: #6B7280; letter-spacing: 0.4px; }
QDialog#ReceiptEntry QFrame#framePartyDetail QLabel#lblPartyHeading { color: #1E40AF; }
QDialog#ReceiptEntry QFrame#frameCheques QLabel#lblChequesHeading { color: #92400E; }
QDialog#ReceiptEntry QFrame#framePartyDetail QLabel#lblPartyAddress,
QDialog#ReceiptEntry QFrame#framePartyDetail QLabel#lblPartyMobile { color: #1E293B; font-weight: 600; }
QDialog#ReceiptEntry QFrame#frameHeader { background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; }
QDialog#ReceiptEntry QFrame#framePartyDetail { background-color: #F5F8FC; border: 1px solid #C7D9EE; border-radius: 6px; }
QDialog#ReceiptEntry QFrame#frameLastReceipts { background-color: #FAFAFA; border: 1px solid #E5E7EB; border-radius: 6px; }
QDialog#ReceiptEntry QFrame#frameCheques { background-color: #FFFBEB; border: 1px solid #FCD34D; border-radius: 6px; }
QDialog#ReceiptEntry QFrame#frameUnusedLegacyBandStyle { background-color: #FCFCFD; border: 1px solid #E5E7EB; border-radius: 6px; }
QDialog#ReceiptEntry QLabel#lblPartyHeading,
QDialog#ReceiptEntry QLabel#lblPanelsHeading,
QDialog#ReceiptEntry QLabel#lblChequesHeading { font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: #7B1113; }
QDialog#ReceiptEntry QLabel#capGroup,
QDialog#ReceiptEntry QLabel#capTerms,
QDialog#ReceiptEntry QLabel#capTds,
QDialog#ReceiptEntry QLabel#capOutstanding,
QDialog#ReceiptEntry QLabel#capOverdue,
QDialog#ReceiptEntry QLabel#capCreditsHeld,
QDialog#ReceiptEntry QLabel#capTotalBalance,
QDialog#ReceiptEntry QLabel#capChequesOut,
QDialog#ReceiptEntry QLabel#capAfterThis,
QDialog#ReceiptEntry QLabel#capReceiptNo,
QDialog#ReceiptEntry QLabel#capDate,
QDialog#ReceiptEntry QLabel#capBeat,
QDialog#ReceiptEntry QLabel#capSalesman,
QDialog#ReceiptEntry QLabel#capTheirRef,
QDialog#ReceiptEntry QLabel#capTheirRefDate,
QDialog#ReceiptEntry QLabel#capOurRef,
QDialog#ReceiptEntry QLabel#capNarration { font-size: 9px; font-weight: 700; letter-spacing: 0.5px; color: #6B7280; }
QDialog#ReceiptEntry QLabel#lblPartyGroup,
QDialog#ReceiptEntry QLabel#lblPartyTerms,
QDialog#ReceiptEntry QLabel#lblPartyTds { font-size: 12px; color: #111827; }
QDialog#ReceiptEntry QLabel#lblPartyOutstanding,
QDialog#ReceiptEntry QLabel#lblPartyOverdue,
QDialog#ReceiptEntry QLabel#lblPartyCredits,
QDialog#ReceiptEntry QLabel#lblPartyTotalBalance,
QDialog#ReceiptEntry QLabel#lblPartyChequesOut,
QDialog#ReceiptEntry QLabel#lblPartyAfterThis { font-size: 13px; font-weight: 700; color: #111827; }
QDialog#ReceiptEntry QFrame#frameIdentity { background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; }
QDialog#ReceiptEntry QLabel[figureCaption="true"] { font-size: 10px; font-weight: 700; letter-spacing: 0.7px; color: #047857; }
QDialog#ReceiptEntry QLabel[figureValue="true"] { font-size: 15px; font-weight: 700; color: #065F46; }
QDialog#ReceiptEntry QLabel#lblIdentityHint { font-size: 11px; color: #4B5563; }


QDialog#ReceiptEntry QLabel#lblBanner { background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 10px; padding: 2px 10px; color: #92400E; font-size: 11px; }
QDialog#ReceiptEntry QLabel#lblPdcNote { font-size: 11px; color: #6B7280; }
QDialog#ReceiptEntry QLabel#lblBillsTotals { font-size: 11px; color: #4B5563; }
QDialog#ReceiptEntry QLabel#lblOtherHint { font-size: 11px; color: #6B7280; }
QDialog#ReceiptEntry QLabel#lblEquals { font-size: 18px; font-weight: 700; color: #065F46; }

/* PaymentEntry (payment_entry.ui) */
QDialog#PaymentEntry,
QWidget QDialog#PaymentEntry,
QDialog#PaymentEntry QDialog { background-color: #F4F5F7; }
QDialog#PaymentEntry QLabel#lblFormTitle { font-size: 19px; font-weight: 700; color: #111827; }
QDialog#PaymentEntry QLabel#lblSubtitle { font-size: 11px; color: #6B7280; }
QDialog#PaymentEntry QLabel#lblStatusPill { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 10px; background-color: #FEF3C7; color: #92400E; }
QDialog#PaymentEntry QLabel#lblBillsHeading,
QDialog#PaymentEntry QLabel#lblTendersHeading { font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: #7B1113; }
QDialog#PaymentEntry QLabel[caption="true"] { font-size: 10px; font-weight: 700; color: #6B7280; letter-spacing: 0.4px; }
QDialog#PaymentEntry QFrame#framePartyDetail QLabel#lblPartyHeading { color: #1E40AF; }
QDialog#PaymentEntry QFrame#frameCheques QLabel#lblChequesHeading { color: #92400E; }
QDialog#PaymentEntry QFrame#framePartyDetail QLabel#lblPartyAddress,
QDialog#PaymentEntry QFrame#framePartyDetail QLabel#lblPartyMobile { color: #1E293B; font-weight: 600; }
QDialog#PaymentEntry QFrame#frameHeader { background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; }
QDialog#PaymentEntry QFrame#framePartyDetail { background-color: #F5F8FC; border: 1px solid #C7D9EE; border-radius: 6px; }
QDialog#PaymentEntry QFrame#frameLastPayments { background-color: #FAFAFA; border: 1px solid #E5E7EB; border-radius: 6px; }
QDialog#PaymentEntry QFrame#frameCheques { background-color: #FFFBEB; border: 1px solid #FCD34D; border-radius: 6px; }
QDialog#PaymentEntry QFrame#frameUnusedLegacyBandStyle { background-color: #FCFCFD; border: 1px solid #E5E7EB; border-radius: 6px; }
QDialog#PaymentEntry QLabel#lblPartyHeading,
QDialog#PaymentEntry QLabel#lblPanelsHeading,
QDialog#PaymentEntry QLabel#lblChequesHeading { font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: #7B1113; }
QDialog#PaymentEntry QLabel#capGroup,
QDialog#PaymentEntry QLabel#capTerms,
QDialog#PaymentEntry QLabel#capTds,
QDialog#PaymentEntry QLabel#capOutstanding,
QDialog#PaymentEntry QLabel#capOverdue,
QDialog#PaymentEntry QLabel#capCreditsHeld,
QDialog#PaymentEntry QLabel#capTotalBalance,
QDialog#PaymentEntry QLabel#capChequesOut,
QDialog#PaymentEntry QLabel#capAfterThis,
QDialog#PaymentEntry QLabel#capBank,
QDialog#PaymentEntry QLabel#capFavouring,
QDialog#PaymentEntry QLabel#capPaymentNo,
QDialog#PaymentEntry QLabel#capDate,
QDialog#PaymentEntry QLabel#capSalesman,
QDialog#PaymentEntry QLabel#capTheirRef,
QDialog#PaymentEntry QLabel#capTheirRefDate,
QDialog#PaymentEntry QLabel#capOurRef,
QDialog#PaymentEntry QLabel#capNarration { font-size: 9px; font-weight: 700; letter-spacing: 0.5px; color: #6B7280; }
QDialog#PaymentEntry QLabel#lblPartyGroup,
QDialog#PaymentEntry QLabel#lblPartyTerms,
QDialog#PaymentEntry QLabel#lblPartyTds,
QDialog#PaymentEntry QLabel#lblPartyBank,
QDialog#PaymentEntry QLabel#lblPartyFavouring { font-size: 12px; color: #111827; }
QDialog#PaymentEntry QLabel#lblPartyOutstanding,
QDialog#PaymentEntry QLabel#lblPartyOverdue,
QDialog#PaymentEntry QLabel#lblPartyCredits,
QDialog#PaymentEntry QLabel#lblPartyTotalBalance,
QDialog#PaymentEntry QLabel#lblPartyChequesOut,
QDialog#PaymentEntry QLabel#lblPartyAfterThis { font-size: 13px; font-weight: 700; color: #111827; }
QDialog#PaymentEntry QFrame#frameIdentity { background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; }
QDialog#PaymentEntry QLabel[figureCaption="true"] { font-size: 10px; font-weight: 700; letter-spacing: 0.7px; color: #047857; }
QDialog#PaymentEntry QLabel[figureValue="true"] { font-size: 15px; font-weight: 700; color: #065F46; }
QDialog#PaymentEntry QLabel#lblIdentityHint { font-size: 11px; color: #4B5563; }


QDialog#PaymentEntry QLabel#lblBanner { background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 10px; padding: 2px 10px; color: #92400E; font-size: 11px; }
QDialog#PaymentEntry QLabel#lblPdcNote { font-size: 11px; color: #6B7280; }
QDialog#PaymentEntry QLabel#lblBillsTotals { font-size: 11px; color: #4B5563; }
QDialog#PaymentEntry QLabel#lblOtherHint { font-size: 11px; color: #6B7280; }
QDialog#PaymentEntry QLabel#lblEquals { font-size: 18px; font-weight: 700; color: #065F46; }

/* OpeningBalanceEntry (opening_balance_entry.ui) */
QDialog#OpeningBalanceEntry,
QWidget QDialog#OpeningBalanceEntry,
QDialog#OpeningBalanceEntry QDialog { background-color: #FFFFFF; }
QDialog#OpeningBalanceEntry QLabel#lblFormTitle { font-size: 19px; font-weight: 700; color: #111827; }
QDialog#OpeningBalanceEntry QLabel#lblSubtitle { font-size: 11px; color: #6B7280; }
QDialog#OpeningBalanceEntry QLabel#lblStatusPill { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 10px; background-color: #DCFCE7; color: #166534; }
QDialog#OpeningBalanceEntry QLabel#lblLedgersHeading,
QDialog#OpeningBalanceEntry QLabel#lblBillsHeading { font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: #7B1113; }
QDialog#OpeningBalanceEntry QFrame#frameTotals,
QDialog#OpeningBalanceEntry QFrame#frameBillBand { background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; }
QDialog#OpeningBalanceEntry QLabel[figureCaption="true"] { font-size: 10px; font-weight: 700; letter-spacing: 0.7px; color: #047857; }
QDialog#OpeningBalanceEntry QLabel[figureValue="true"] { font-size: 16px; font-weight: 700; color: #065F46; }
QDialog#OpeningBalanceEntry QLabel#lblPlug,
QDialog#OpeningBalanceEntry QLabel#lblServerTb { font-size: 11px; color: #4B5563; }
QDialog#OpeningBalanceEntry QLabel#lblBanner { background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 8px 10px; color: #92400E; font-size: 11px; }


QDialog#OpeningBalanceEntry QLabel#lblScopeCaption { color: #4B5563; font-size: 12px; }
QDialog#OpeningBalanceEntry QLabel#lblHint { color: #6B7280; font-size: 11px; }
QDialog#OpeningBalanceEntry QComboBox { padding: 5px 8px; border: 1px solid #D1D5DB; border-radius: 6px; }
QDialog#OpeningBalanceEntry QLabel#lblBanner { background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 6px; padding: 6px; color: #92400E; }
QDialog#OpeningBalanceEntry QLabel#lblBillParty { font-weight: 700; color: #111827; }
QDialog#OpeningBalanceEntry QLabel#lblPlug { color: #6B7280; }
QDialog#OpeningBalanceEntry QLabel#lblServerTb { color: #6B7280; }
QDialog#OpeningBalanceEntry QLabel#lblHint { color: #6B7280; }

/* LedgerMapEntry (ledger_map_entry.ui) */
QDialog#LedgerMapEntry,
QWidget QDialog#LedgerMapEntry,
QDialog#LedgerMapEntry QDialog { background-color: #FFFFFF; }
QDialog#LedgerMapEntry QLabel#lblFormTitle { font-size: 19px; font-weight: 700; color: #111827; }
QDialog#LedgerMapEntry QLabel#lblSubtitle { font-size: 11px; color: #6B7280; }
QDialog#LedgerMapEntry QLabel#lblStatusPill { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 10px; background-color: #DCFCE7; color: #166534; }
QDialog#LedgerMapEntry QLabel#lblGridHeading { font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: #7B1113; }
QDialog#LedgerMapEntry QLabel#lblWhy { background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px 10px; color: #4B5563; font-size: 11px; }
QDialog#LedgerMapEntry QLabel#lblBanner { background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 8px 10px; color: #92400E; font-size: 11px; }


QDialog#LedgerMapEntry QLabel#lblHint { color: #6B7280; font-size: 11px; }

/* VoucherRegisterEntry (voucher_register_entry.ui) */
QDialog#VoucherRegisterEntry,
QWidget QDialog#VoucherRegisterEntry,
QDialog#VoucherRegisterEntry QDialog { background-color: #F4F5F7; }
QDialog#VoucherRegisterEntry QLabel#lblTitle { font-size: 19px; font-weight: 700; color: #111827; }
QDialog#VoucherRegisterEntry QLabel#lblContext { font-size: 11px; color: #6B7280; }
QDialog#VoucherRegisterEntry QLabel#lblStatus { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 10px; background-color: #FEF3C7; color: #92400E; }
QDialog#VoucherRegisterEntry QLabel#lblNoTypes { font-size: 13px; color: #991B1B; padding: 18px; }
QDialog#VoucherRegisterEntry QFrame#frameTypes,
QDialog#VoucherRegisterEntry QFrame#frameRules { background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; }


QDialog#VoucherRegisterEntry QLabel#lblOpenedFrom { font-size: 11px; color: #6B7280; }
QDialog#VoucherRegisterEntry QFrame#frameRules QLabel[role="cap"] { font-size: 10px; color: #6B7280; }
QDialog#VoucherRegisterEntry QFrame#frameRules QLabel[role="val"] { font-size: 12px; font-weight: 600; color: #111827; }
QDialog#VoucherRegisterEntry QGroupBox { background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; margin-top: 14px; padding-top: 8px; font-weight: 600; color: #374151; }
QDialog#VoucherRegisterEntry QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 4px; }
QDialog#VoucherRegisterEntry QLabel#lblFacts { font-size: 11px; color: #374151; }
QDialog#VoucherRegisterEntry QLabel#lblHint { font-size: 11px; color: #6B7280; }
QDialog#VoucherRegisterEntry QLabel#lblTotals { font-size: 12px; color: #374151; }
QDialog#VoucherRegisterEntry QLabel#lblDifference { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 9px; background-color: #DCFCE7; color: #166534; }
QDialog#VoucherRegisterEntry QLabel#lblStale { font-size: 11px; color: #92400E; }
QDialog#VoucherRegisterEntry QLabel#lblRuleHead { font-weight: 700; color: #111827; }


QDialog#VoucherRegisterEntry QLabel#lblPostDated { color:#B45309; }

/* ReceivedCheques (received_cheques.ui) */
QDialog#ReceivedCheques,
QWidget QDialog#ReceivedCheques,
QDialog#ReceivedCheques QDialog { background-color: #F7F8FA; }
QDialog#ReceivedCheques QLabel#lblFormTitle { font-size: 20px; font-weight: 800; color: #0F172A; }
QDialog#ReceivedCheques QLabel#lblScope { font-size: 11px; color: #64748B; }
QDialog#ReceivedCheques QLabel[sectionHeading="true"] { font-size: 10px; font-weight: 800; letter-spacing: 0.9px; color: #7B1113; }
QDialog#ReceivedCheques QFrame#frameSummary { background: transparent; border: none; }
QDialog#ReceivedCheques QFrame[tile="true"] { border-radius: 8px; border: 1px solid; padding: 2px; }
QDialog#ReceivedCheques QFrame#tileInHand { background-color: #FFFBEB; border-color: #FCD34D; }
QDialog#ReceivedCheques QFrame#tileWithBank { background-color: #EFF6FF; border-color: #93C5FD; }
QDialog#ReceivedCheques QFrame#tileBounced { background-color: #FEF2F2; border-color: #FCA5A5; }
QDialog#ReceivedCheques QFrame#tileCleared { background-color: #F0FDF4; border-color: #86EFAC; }
QDialog#ReceivedCheques QFrame#tileTotal { background-color: #1E293B; border-color: #0F172A; }
QDialog#ReceivedCheques QFrame#tileTotal QLabel[figureCaption="true"] { color: #94A3B8; }
QDialog#ReceivedCheques QFrame#tileTotal QLabel[figureValue="true"] { color: #FFFFFF; }
QDialog#ReceivedCheques QFrame#tileTotal QLabel[figureCount="true"] { color: #94A3B8; }
QDialog#ReceivedCheques QLabel[figureCaption="true"] { font-size: 10px; font-weight: 800; letter-spacing: 0.8px; }
QDialog#ReceivedCheques QFrame#tileInHand QLabel[figureCaption="true"] { color: #92400E; }
QDialog#ReceivedCheques QFrame#tileWithBank QLabel[figureCaption="true"] { color: #1E40AF; }
QDialog#ReceivedCheques QFrame#tileBounced QLabel[figureCaption="true"] { color: #991B1B; }
QDialog#ReceivedCheques QFrame#tileCleared QLabel[figureCaption="true"] { color: #166534; }
QDialog#ReceivedCheques QLabel[figureValue="true"] { font-size: 19px; font-weight: 800; }
QDialog#ReceivedCheques QFrame#tileInHand QLabel[figureValue="true"] { color: #78350F; }
QDialog#ReceivedCheques QFrame#tileWithBank QLabel[figureValue="true"] { color: #1E3A8A; }
QDialog#ReceivedCheques QFrame#tileBounced QLabel[figureValue="true"] { color: #7F1D1D; }
QDialog#ReceivedCheques QFrame#tileCleared QLabel[figureValue="true"] { color: #14532D; }
QDialog#ReceivedCheques QLabel[figureCount="true"] { font-size: 10px; color: #64748B; }
QDialog#ReceivedCheques QLabel#lblTie { font-size: 11px; color: #475569; }
QDialog#ReceivedCheques QFrame#frameFilters { background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; }
QDialog#ReceivedCheques QCheckBox { font-size: 12px; color: #334155; spacing: 6px; }
QDialog#ReceivedCheques QLineEdit#txtSearch { border: 1px solid #CBD5E1; border-radius: 6px; padding: 5px 8px; background: #FFFFFF; }
QDialog#ReceivedCheques QLineEdit#txtSearch:focus { border-color: #7B1113; }
QDialog#ReceivedCheques QFrame#frameRegister { background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; }
QDialog#ReceivedCheques QLabel#lblCount { font-size: 11px; color: #475569; }
QDialog#ReceivedCheques QFrame#frameDetail { background-color: #F1F5F9; border: 1px solid #E2E8F0; border-left: 3px solid #7B1113; border-radius: 6px; }
QDialog#ReceivedCheques QLabel#lblDetail { font-size: 12px; color: #1E293B; }
QDialog#ReceivedCheques QLabel#lblDetailChain { font-size: 11px; font-style: italic; color: #64748B; }


QDialog#ReceivedCheques QLabel#lblSelection { font-size: 12px; font-weight: 700; color: #0F172A; background-color: #E2E8F0; border-radius: 10px; padding: 4px 12px; }
QDialog#ReceivedCheques QFrame#framePanel { background-color: #FFFFFF; border: 1px solid #CBD5E1; border-top: 3px solid #7B1113; border-radius: 8px; }
QDialog#ReceivedCheques QLabel#lblPanelTitle { font-size: 14px; font-weight: 800; color: #0F172A; }
QDialog#ReceivedCheques QLabel#lblPanelWhy { font-size: 11px; font-weight: 600; color: #B91C1C; }


/* IssuedCheques (issued_cheques.ui) */
QDialog#IssuedCheques,
QWidget QDialog#IssuedCheques,
QDialog#IssuedCheques QDialog { background-color: #F7F8FA; }
QDialog#IssuedCheques QLabel#lblFormTitle { font-size: 20px; font-weight: 800; color: #0F172A; }
QDialog#IssuedCheques QLabel#lblScope { font-size: 11px; color: #64748B; }
QDialog#IssuedCheques QFrame#frameSummary { background: transparent; border: none; }
QDialog#IssuedCheques QFrame[tile="true"] { border-radius: 8px; border: 1px solid; padding: 2px; }
QDialog#IssuedCheques QFrame#tileOutstanding { background-color: #FFFBEB; border-color: #FCD34D; }
QDialog#IssuedCheques QFrame#tilePostDated { background-color: #EFF6FF; border-color: #93C5FD; }
QDialog#IssuedCheques QFrame#tileReturned { background-color: #FEF2F2; border-color: #FCA5A5; }
QDialog#IssuedCheques QFrame#tileLeaves { background-color: #F0FDF4; border-color: #86EFAC; }
QDialog#IssuedCheques QFrame#tileTotal { background-color: #1E293B; border-color: #0F172A; }
QDialog#IssuedCheques QLabel[figureCaption="true"] { font-size: 10px; font-weight: 800; letter-spacing: 0.8px; }
QDialog#IssuedCheques QFrame#tileOutstanding QLabel[figureCaption="true"] { color: #92400E; }
QDialog#IssuedCheques QFrame#tilePostDated QLabel[figureCaption="true"] { color: #1E40AF; }
QDialog#IssuedCheques QFrame#tileReturned QLabel[figureCaption="true"] { color: #991B1B; }
QDialog#IssuedCheques QFrame#tileLeaves QLabel[figureCaption="true"] { color: #166534; }
QDialog#IssuedCheques QFrame#tileTotal QLabel[figureCaption="true"] { color: #94A3B8; }
QDialog#IssuedCheques QLabel[figureValue="true"] { font-size: 19px; font-weight: 800; color: #0F172A; }
QDialog#IssuedCheques QFrame#tileTotal QLabel[figureValue="true"] { color: #FFFFFF; }
QDialog#IssuedCheques QLabel[figureCount="true"] { font-size: 10px; color: #64748B; }
QDialog#IssuedCheques QFrame#tileTotal QLabel[figureCount="true"] { color: #94A3B8; }
QDialog#IssuedCheques QFrame#frameFilters,
QDialog#IssuedCheques QFrame#frameRegister { background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; }
QDialog#IssuedCheques QCheckBox { font-size: 12px; color: #334155; spacing: 6px; }
QDialog#IssuedCheques QLineEdit#txtSearch { border: 1px solid #CBD5E1; border-radius: 6px; padding: 5px 8px; background: #FFFFFF; }
QDialog#IssuedCheques QLineEdit#txtSearch:focus { border-color: #7B1113; }
QDialog#IssuedCheques QLabel#lblCount { font-size: 11px; color: #475569; }
QDialog#IssuedCheques QFrame#frameDetail { background-color: #F1F5F9; border: 1px solid #E2E8F0; border-left: 3px solid #7B1113; border-radius: 6px; }
QDialog#IssuedCheques QLabel#lblDetail { font-size: 12px; color: #1E293B; }
QDialog#IssuedCheques QLabel#lblDetailChain { font-size: 11px; font-style: italic; color: #64748B; }


QDialog#IssuedCheques QLabel#lblSelection { font-size: 12px; font-weight: 700; color: #0F172A; background-color: #E2E8F0; border-radius: 10px; padding: 4px 12px; }
QDialog#IssuedCheques QLabel#lblHint { font-size: 11px; color: #64748B; }

/* ItemQtyPriceEntry (item_qty_price_entry.ui) */
QDialog#ItemQtyPriceEntry,
QWidget QDialog#ItemQtyPriceEntry,
QDialog#ItemQtyPriceEntry QDialog { background-color: #FBF2F2; }
/* ItemQtyPriceEntry: per-widget (item_qty_price_entry.ui) */
QDialog#ItemQtyPriceEntry QLabel#lblFormTitle { font:25px; font-weight:bold; padding:5px; }
QDialog#ItemQtyPriceEntry QLabel#lblBarcode { font-weight:bold; }
QDialog#ItemQtyPriceEntry QLabel#lblItemName { font-weight:bold; }
/* ItemQtyPriceEntry: the promotion page's look (2026-10-22 redesign) */
QDialog#ItemQtyPriceEntry QLabel#lblItemHeading,
QDialog#ItemQtyPriceEntry QLabel#lblSlabsHeading,
QDialog#ItemQtyPriceEntry QLabel#lblScopeHeading,
QDialog#ItemQtyPriceEntry QLabel#lblWhenHeading { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#ItemQtyPriceEntry QFrame#ruleItem, QDialog#ItemQtyPriceEntry QFrame#ruleSlabs,
QDialog#ItemQtyPriceEntry QFrame#ruleScope, QDialog#ItemQtyPriceEntry QFrame#ruleWhen { color:#E5E7EB; }
QDialog#ItemQtyPriceEntry QLabel[cap="true"] { color:#6B7280; }
QDialog#ItemQtyPriceEntry QLabel#lblItemPrices { color:#374151; padding:2px 0; }
QDialog#ItemQtyPriceEntry QFrame#framePreview { background:#F5F3FF; border:1px solid #DDD6FE; border-radius:6px; }
QDialog#ItemQtyPriceEntry QFrame#framePreview QLabel#lblPreview { color:#4C1D95; padding:6px 8px; background:transparent; }

/* ItemEntry (item_entry.ui) */
QDialog#ItemEntry,
QWidget QDialog#ItemEntry,
QDialog#ItemEntry QDialog { background-color: #FBF2F2; }
/* ItemEntry: per-widget (item_entry.ui) */
QDialog#ItemEntry QLabel#lblBasicInfoHeading_4 { color:#2563EB; letter-spacing:0.3px; }
QDialog#ItemEntry QFrame#ruleBasicInfo_4,
QDialog#ItemEntry QFrame#ruleBasicInfo_4 * { color:#E5E7EB; }
QDialog#ItemEntry QLabel#lblUnitConversionHeading_2 { color:#2563EB; letter-spacing:0.3px; }
QDialog#ItemEntry QFrame#ruleBasicInfo_3,
QDialog#ItemEntry QFrame#ruleBasicInfo_3 * { color:#E5E7EB; }
QDialog#ItemEntry QLabel#lblUnitConversionHeading { color:#2563EB; letter-spacing:0.3px; }
QDialog#ItemEntry QFrame#ruleUnitConversion,
QDialog#ItemEntry QFrame#ruleUnitConversion * { color:#E5E7EB; }
QDialog#ItemEntry QLabel#lblBasicInfoHeading_2 { color:#2563EB; letter-spacing:0.3px; }
QDialog#ItemEntry QFrame#ruleBasicInfo_2,
QDialog#ItemEntry QFrame#ruleBasicInfo_2 * { color:#E5E7EB; }

/* StockAdjustmentEntry (stock_adjustment_entry.ui) */
QDialog#StockAdjustmentEntry,
QWidget QDialog#StockAdjustmentEntry,
QDialog#StockAdjustmentEntry QDialog { background-color: #FFFFFF; }
QDialog#StockAdjustmentEntry QLabel[cap="true"] { color:#6B7280; }


QDialog#StockAdjustmentEntry QFrame[card="true"] { background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; }
QDialog#StockAdjustmentEntry QLabel[cardTitle="true"] { color:#7B1113; font-weight:bold; }
/* StockAdjustmentEntry: per-widget (stock_adjustment_entry.ui) */
QDialog#StockAdjustmentEntry QLabel#lblFormTitle { font-size:20px; font-weight:bold; color:#111827; }
QDialog#StockAdjustmentEntry QLabel#lblKindHint { color:#6B7280; font-size:12px; }
QDialog#StockAdjustmentEntry QLabel#lblScope { color:#6B7280; font-size:12px; padding-right:10px; }
QDialog#StockAdjustmentEntry Line#lineTitle,
QDialog#StockAdjustmentEntry Line#lineTitle * { color:#E5E7EB; }
QDialog#StockAdjustmentEntry QLineEdit#txtVoucherNo,
QDialog#StockAdjustmentEntry QLineEdit#txtVoucherNo * { background:#F3F4F6; color:#6B7280; }
QDialog#StockAdjustmentEntry QLabel#lblKindNote { color:#6B7280; }
QDialog#StockAdjustmentEntry QLabel#lblTotalOut { color:#B42318; }
QDialog#StockAdjustmentEntry QLabel#lblTotalIn { color:#15803D; }
QDialog#StockAdjustmentEntry QLabel#lblTotalNet { font-weight:bold; }
QDialog#StockAdjustmentEntry QLabel#lblAccounts { font-family:monospace; }
QDialog#StockAdjustmentEntry QLabel#lblAccountsNote { color:#6B7280; font-size:11px; }
QDialog#StockAdjustmentEntry QLabel#lblValidation { background:#FDECEC; color:#B42318; padding:8px 14px; border-radius:4px; font-weight:600; }
QDialog#StockAdjustmentEntry QLabel#lblHint { color:#8b1a1a; }


/* StockAdjustmentEntry: states set from code */
QDialog#StockAdjustmentEntry QLabel#lblStatus[nexTone="posted"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #15803D; background: #E8F5EA; }
QDialog#StockAdjustmentEntry QLabel#lblStatus[nexTone="cancelled"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #B42318; background: #FDE8E8; }
QDialog#StockAdjustmentEntry QLabel#lblStatus[nexTone="draft"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #B45309; background: #FEF3E2; }
/* StockAdjustmentEntry v35 (2026-10-24): relayout to Opening Stock's — the audit line, the godown box (red until chosen), the button bar */
QDialog#StockAdjustmentEntry QLabel#lblAudit { color:#6B7280; font-size:11px; }
QDialog#StockAdjustmentEntry QFrame#frameGodown { background: {{primary.soft}}; border: 1px solid {{primary.soft.border}}; border-radius: 6px; }
QDialog#StockAdjustmentEntry QFrame#frameGodown QLabel#lblGodown { color: {{primary}}; font-weight: bold; }
QDialog#StockAdjustmentEntry QFrame#frameGodown QLineEdit { font-weight: bold; }
QDialog#StockAdjustmentEntry QFrame#frameGodown[nexTone="missing"] { background: #FEF2F2; border: 1px solid #F87171; }
QDialog#StockAdjustmentEntry QFrame#frameGodown[nexTone="missing"] QLabel#lblGodown { color: #B42318; }
QDialog#StockAdjustmentEntry QFrame#frameButtons { background:#F8FAFC; border-top:1px solid #E5E7EB; }
QDialog#StockAdjustmentEntry QLabel#lblRelotBalance[nexTone="good"] { background: #E8F5EA; color: #15803D; padding: 6px 12px; border-radius: 4px; font-weight: 600; }
QDialog#StockAdjustmentEntry QLabel#lblRelotBalance[nexTone="bad"] { background: #FDECEC; color: #B42318; padding: 6px 12px; border-radius: 4px; font-weight: 600; }

/* OpeningStockEntry (opening_stock_entry.ui) — 2026-10-02 relayout, Change Selling style */
QDialog#OpeningStockEntry,
QWidget QDialog#OpeningStockEntry,
QDialog#OpeningStockEntry QDialog { background-color: #FFFFFF; }
QDialog#OpeningStockEntry QLabel[cap="true"] { color:#6B7280; }
QDialog#OpeningStockEntry QFrame[card="true"] { background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; }
/* OpeningStockEntry: per-widget */
QDialog#OpeningStockEntry QLabel#lblFormTitle { font-size:20px; font-weight:bold; color:#111827; }
QDialog#OpeningStockEntry QLabel#lblScope { color:#6B7280; font-size:12px; }
QDialog#OpeningStockEntry QLabel#lblAudit { color:#6B7280; font-size:11px; }
QDialog#OpeningStockEntry Line#lineTitle,
QDialog#OpeningStockEntry Line#lineTitle * { color:#E5E7EB; }
QDialog#OpeningStockEntry QLabel#lblGridHint { color:#6B7280; font-size:11px; }
QDialog#OpeningStockEntry QFrame#frameTotals QLabel { color:#111827; font-weight:600; }
QDialog#OpeningStockEntry QFrame#frameTotals QLabel[cap="true"] { color:#6B7280; font-weight:normal; }
QDialog#OpeningStockEntry QFrame#frameTotals QLabel#sepTotals1,
QDialog#OpeningStockEntry QFrame#frameTotals QLabel#sepTotals2,
QDialog#OpeningStockEntry QFrame#frameTotals QLabel#sepTotals3 { color:#CBD5E1; font-weight:normal; padding:0 6px; }
QDialog#OpeningStockEntry QFrame#frameTotals QLabel#lblTotalValue { color:#7B1113; font-weight:bold; font-size:14px; }
QDialog#OpeningStockEntry QLabel#lblHint { color:#8b1a1a; }
QDialog#OpeningStockEntry QFrame#frameButtons { background:#F8FAFC; border-top:1px solid #E5E7EB; }
/* OpeningStockEntry: states set from code — the status pill */
QDialog#OpeningStockEntry QLabel#lblStatus[nexTone="posted"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #15803D; background: #E8F5EA; }
QDialog#OpeningStockEntry QLabel#lblStatus[nexTone="cancelled"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #B42318; background: #FDE8E8; }
QDialog#OpeningStockEntry QLabel#lblStatus[nexTone="draft"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #B45309; background: #FEF3E2; }
/* OpeningStockEntry v31 (2026-10-23): the godown box — required, so it stands out; red until chosen */
QDialog#OpeningStockEntry QFrame#frameGodown { background: {{primary.soft}}; border: 1px solid {{primary.soft.border}}; border-radius: 6px; }
QDialog#OpeningStockEntry QFrame#frameGodown QLabel#lblGodown { color: {{primary}}; font-weight: bold; }
QDialog#OpeningStockEntry QFrame#frameGodown QLineEdit { font-weight: bold; }
QDialog#OpeningStockEntry QFrame#frameGodown[nexTone="missing"] { background: #FEF2F2; border: 1px solid #F87171; }
QDialog#OpeningStockEntry QFrame#frameGodown[nexTone="missing"] QLabel#lblGodown { color: #B42318; }
/* TxnKeysDialog v32 (2026-10-23): the F1 key sheet of every txn screen — action left, key chip right */
QDialog#TxnKeysDialog { background: {{surface}}; }
QDialog#TxnKeysDialog QLabel#keysTitle { color: {{text}}; font-size: 16px; font-weight: bold; padding-bottom: 2px; }
QDialog#TxnKeysDialog QLabel#keysSection { color: {{primary}}; font-size: 11px; font-weight: bold; border-bottom: 1px solid {{border}}; padding: 6px 0 4px 0; }
QDialog#TxnKeysDialog QLabel#keysAction { color: {{text}}; }
QDialog#TxnKeysDialog QLabel#keysCap { color: {{text}}; background: {{surface.alt}}; border: 1px solid {{border}}; border-bottom: 2px solid {{border}}; border-radius: 4px; padding: 2px 10px; font-weight: bold; min-width: 36px; }
/* PriceChangeLog v33 (2026-10-23): the Price Change Log report (menu 290, notes 144) + its two popups */
QDialog#PriceChangeLog,
QDialog#PriceLogDetail,
QDialog#PriceLogHistory { background-color: {{surface}}; }
QDialog#PriceChangeLog QLabel#lblFormTitle { font-size: 20px; font-weight: bold; color: {{text}}; }
QDialog#PriceChangeLog QLabel#lblScope { color: {{text.muted}}; font-size: 12px; }
QDialog#PriceChangeLog QLabel[cap="true"] { color: {{text.muted}}; }
QDialog#PriceChangeLog QFrame[card="true"] { background: {{surface.alt}}; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#PriceChangeLog QLabel#lblGaps { font-size: 11px; font-weight: bold; padding: 3px 10px; border-radius: 10px; }
QDialog#PriceChangeLog QLabel#lblGaps[nexTone="ok"] { color: {{success}}; background: {{success.bg}}; }
QDialog#PriceChangeLog QLabel#lblGaps[nexTone="bad"] { color: {{danger}}; background: {{danger.bg}}; }
QDialog#PriceChangeLog QPushButton#dayChip { text-align: left; padding: 4px 12px; border: 1px solid {{border}}; border-radius: 6px; background: {{surface}}; color: {{text}}; font-size: 11px; }
QDialog#PriceChangeLog QPushButton#dayChip:hover { border-color: {{primary}}; background: {{primary.soft}}; }
QDialog#PriceChangeLog QLabel#lblTotals { color: {{text}}; font-weight: 600; }
QDialog#PriceChangeLog QLabel#lblHint { color: {{text.muted}}; font-size: 11px; }
QDialog#PriceChangeLog QFrame#frameButtons { background: {{surface.alt}}; border-top: 1px solid {{border}}; }
QDialog#PriceLogDetail QLabel#plTitle,
QDialog#PriceLogHistory QLabel#plTitle { font-size: 15px; font-weight: bold; color: {{text}}; }
QDialog#PriceLogDetail QLabel#plMeta,
QDialog#PriceLogHistory QLabel#plMeta { color: {{text.muted}}; font-size: 11px; }
QDialog#PriceLogDetail QLabel#plReason { color: {{warning}}; background: {{warning.bg}}; border-radius: 4px; padding: 4px 8px; font-weight: 600; }
QDialog#PriceLogDetail QLabel#plSame { color: {{text.muted}}; font-size: 11px; }
/* QuickRateDialog v33 (2026-10-23): Ctrl+R "Change Rate" popup (notes-146) */
QDialog#QuickRateDialog { background-color: {{surface}}; }
QDialog#QuickRateDialog QLabel#qrTitle { font-size: 18px; font-weight: bold; color: {{text}}; }
QDialog#QuickRateDialog QLabel#qrSub { color: {{text.muted}}; font-size: 11px; }
QDialog#QuickRateDialog QLabel#qrSide { color: {{text}}; font-weight: 600; font-size: 11px; }
QDialog#QuickRateDialog QLabel[cap="true"] { color: {{text.muted}}; }
QDialog#QuickRateDialog QPushButton#qrScope { padding: 4px 14px; border: 1px solid {{border}}; border-radius: 12px; background: {{surface}}; color: {{text.muted}}; font-weight: 600; }
QDialog#QuickRateDialog QPushButton#qrScope:checked { border-color: {{primary}}; background: {{primary.soft}}; color: {{primary}}; }
QDialog#QuickRateDialog QPushButton#qrScope:disabled { color: {{border}}; }
QDialog#QuickRateDialog QLabel#qrRights { font-size: 11px; font-weight: bold; padding: 3px 10px; border-radius: 10px; }
QDialog#QuickRateDialog QLabel#qrRights[nexTone="ok"] { color: {{success}}; background: {{success.bg}}; }
QDialog#QuickRateDialog QLabel#qrRights[nexTone="warn"] { color: {{warning}}; background: {{warning.bg}}; }
QDialog#QuickRateDialog QLabel#qrLive { background: {{surface.alt}}; border: 1px solid {{border}}; border-radius: 6px; padding: 6px 10px; color: {{text}}; }
QDialog#QuickRateDialog QLabel#qrLive[nexTone="warn"] { background: {{warning.bg}}; color: {{warning}}; border-color: {{warning}}; }
QDialog#QuickRateDialog QLabel#qrSection { color: {{text}}; font-weight: bold; padding-top: 4px; }
QDialog#QuickRateDialog QLabel#qrNote { color: {{text.muted}}; font-size: 11px; }

/* PhysicalStockEntry (physical_stock_entry.ui) — 2026-10-02 relayout, Change Selling style */
QDialog#PhysicalStockEntry,
QWidget QDialog#PhysicalStockEntry,
QDialog#PhysicalStockEntry QDialog { background-color: #FFFFFF; }
QDialog#PhysicalStockEntry QLabel[cap="true"] { color:#6B7280; }
QDialog#PhysicalStockEntry QFrame[card="true"] { background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; }
/* PhysicalStockEntry: per-widget */
QDialog#PhysicalStockEntry QLabel#lblFormTitle { font-size:20px; font-weight:bold; color:#111827; }
QDialog#PhysicalStockEntry QLabel#lblScope { color:#6B7280; font-size:12px; }
QDialog#PhysicalStockEntry QLabel#lblAudit { color:#6B7280; font-size:11px; }
QDialog#PhysicalStockEntry Line#lineTitle,
QDialog#PhysicalStockEntry Line#lineTitle * { color:#E5E7EB; }
QDialog#PhysicalStockEntry QFrame#frameTotals QLabel { color:#111827; font-weight:600; }
QDialog#PhysicalStockEntry QFrame#frameTotals QLabel[cap="true"] { color:#6B7280; font-weight:normal; }
QDialog#PhysicalStockEntry QFrame#frameTotals QLabel#sepTotals1,
QDialog#PhysicalStockEntry QFrame#frameTotals QLabel#sepTotals2,
QDialog#PhysicalStockEntry QFrame#frameTotals QLabel#sepTotals3,
QDialog#PhysicalStockEntry QFrame#frameTotals QLabel#sepTotals4 { color:#CBD5E1; font-weight:normal; padding:0 6px; }
QDialog#PhysicalStockEntry QFrame#frameTotals QLabel#lblNetValue { color:#7B1113; font-weight:bold; font-size:14px; }
QDialog#PhysicalStockEntry QLabel#lblHint { color:#8b1a1a; }
QDialog#PhysicalStockEntry QFrame#frameButtons { background:#F8FAFC; border-top:1px solid #E5E7EB; }
/* PhysicalStockEntry: states set from code — the status pill */
QDialog#PhysicalStockEntry QLabel#lblStatus[nexTone="posted"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #15803D; background: #E8F5EA; }
QDialog#PhysicalStockEntry QLabel#lblStatus[nexTone="cancelled"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #B42318; background: #FDE8E8; }
QDialog#PhysicalStockEntry QLabel#lblStatus[nexTone="draft"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #B45309; background: #FEF3E2; }
/* PhysicalStockEntry v34 (2026-10-24): relayout to Opening Stock's — the godown box (red until chosen), the grid hint */
QDialog#PhysicalStockEntry QLabel#lblGridHint { color:#6B7280; font-size:11px; }
QDialog#PhysicalStockEntry QFrame#frameGodown { background: {{primary.soft}}; border: 1px solid {{primary.soft.border}}; border-radius: 6px; }
QDialog#PhysicalStockEntry QFrame#frameGodown QLabel#lblGodown { color: {{primary}}; font-weight: bold; }
QDialog#PhysicalStockEntry QFrame#frameGodown QLineEdit { font-weight: bold; }
QDialog#PhysicalStockEntry QFrame#frameGodown[nexTone="missing"] { background: #FEF2F2; border: 1px solid #F87171; }
QDialog#PhysicalStockEntry QFrame#frameGodown[nexTone="missing"] QLabel#lblGodown { color: #B42318; }

/* ChangeSellingPriceEntry (change_selling_price_entry.ui) */
QDialog#ChangeSellingPriceEntry,
QWidget QDialog#ChangeSellingPriceEntry,
QDialog#ChangeSellingPriceEntry QDialog { background-color: #FFFFFF; }
QDialog#ChangeSellingPriceEntry QLabel[cap="true"] { color:#6B7280; }


QDialog#ChangeSellingPriceEntry QFrame[card="true"] { background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; }
QDialog#ChangeSellingPriceEntry QFrame[card="new"] { background:#ECFDF3; border:1px solid #BBE5C8; border-radius:6px; }
QDialog#ChangeSellingPriceEntry QFrame[card="violet"] { background:#F5F3FF; border:1px solid #DDD6FE; border-radius:6px; }
QDialog#ChangeSellingPriceEntry QLabel[cardTitle="true"] { color:#7B1113; font-weight:bold; }
/* ChangeSellingPriceEntry: per-widget (change_selling_price_entry.ui) */
QDialog#ChangeSellingPriceEntry QLabel#lblFormTitle { font-size:20px; font-weight:bold; color:#111827; }
QDialog#ChangeSellingPriceEntry QLabel#lblSubtitle { color:#6B7280; font-size:12px; }
QDialog#ChangeSellingPriceEntry QLabel#lblChangedChip { background:#FEF3C7; color:#B45309; font-weight:bold; font-size:11px; padding:3px 12px; border-radius:10px; }
QDialog#ChangeSellingPriceEntry Line#lineTitle,
QDialog#ChangeSellingPriceEntry Line#lineTitle * { color:#E5E7EB; }
QDialog#ChangeSellingPriceEntry QLabel#lblScopeNote { color:#6B7280; font-size:12px; padding-left:16px; }
QDialog#ChangeSellingPriceEntry QLabel#lblRowsHint { color:#6B7280; font-size:12px; padding-left:8px; }
QDialog#ChangeSellingPriceEntry QLabel#lblValidation { background:#FDECEC; color:#B42318; padding:8px 14px; border-radius:4px; font-weight:600; }
QDialog#ChangeSellingPriceEntry QLabel#lblFourTitle { color:#6D28D9; font-weight:bold; }
QDialog#ChangeSellingPriceEntry QLabel#lblFourWhich { color:#6D28D9; font-size:12px; }
QDialog#ChangeSellingPriceEntry QLabel#capMarkup { color:#6D28D9; font-family:monospace; }
QDialog#ChangeSellingPriceEntry QLabel#capWot { color:#6D28D9; font-family:monospace; }
QDialog#ChangeSellingPriceEntry QLabel#capPrice { color:#6D28D9; font-family:monospace; }
QDialog#ChangeSellingPriceEntry QLabel#capMargin { color:#6D28D9; font-family:monospace; }
QDialog#ChangeSellingPriceEntry QLabel#arr1 { color:#6D28D9; }
QDialog#ChangeSellingPriceEntry QLabel#arr2 { color:#6D28D9; }
QDialog#ChangeSellingPriceEntry QLabel#arr3 { color:#6D28D9; }
QDialog#ChangeSellingPriceEntry QLabel#lblFourNote { color:#6D28D9; font-size:12px; }
QDialog#ChangeSellingPriceEntry QLabel#lblCess { color:#B45309; font-size:12px; }
QDialog#ChangeSellingPriceEntry QLabel#lblRowTitle { color:#15803D; font-weight:bold; }
QDialog#ChangeSellingPriceEntry QLabel#lblRowNote { color:#166534; font-size:12px; }
QDialog#ChangeSellingPriceEntry QLabel#lblHint { color:#8b1a1a; }
QDialog#ChangeSellingPriceEntry QFrame#frameButtons { background:#F8FAFC; border-top:1px solid #E5E7EB; }
/* ChangeSellingPriceEntry: states set from code */
QDialog#ChangeSellingPriceEntry QLabel#lblValidation[nexTone="amber"] { background: #FEF6E7; color: #B45309; padding: 8px 14px; border-radius: 4px; font-weight: 600; }
QDialog#ChangeSellingPriceEntry QLabel#lblValidation[nexTone="red"] { background: #FDECEC; color: #B42318; padding: 8px 14px; border-radius: 4px; font-weight: 600; }
QDialog#ChangeSellingPriceEntry QLabel#lblRowTitle[nexTone="new"] { color: #15803D; font-weight: bold; }
QDialog#ChangeSellingPriceEntry QLabel#lblRowTitle[nexTone="plain"] { color: #7B1113; font-weight: bold; }
QDialog#ChangeSellingPriceEntry QLabel#lblRowNote[nexTone="new"] { color: #166534; font-size: 12px; }
QDialog#ChangeSellingPriceEntry QLabel#lblRowNote[nexTone="plain"] { color: #374151; font-size: 12px; }
QDialog#ChangeSellingPriceEntry QLabel#chipBucketBr { background: #e8eefc; color: #1d4ed8; font-weight: bold; font-size: 11px; padding: 2px 10px; border-radius: 9px; }
QDialog#ChangeSellingPriceEntry QLabel#chipBucketCh { background: #f1eafd; color: #6d28d9; font-weight: bold; font-size: 11px; padding: 2px 10px; border-radius: 9px; }
QDialog#ChangeSellingPriceEntry QLabel#chipMaster { background: #f1f5f9; color: #475569; font-weight: bold; font-size: 11px; padding: 2px 10px; border-radius: 9px; }
QDialog#ChangeSellingPriceEntry QLabel#chipNew { background: #e8f5ea; color: #15803d; font-weight: bold; font-size: 11px; padding: 2px 10px; border-radius: 9px; }

/* DeliveryChallanEntry (delivery_challan_entry.ui) */
QDialog#DeliveryChallanEntry,
QWidget QDialog#DeliveryChallanEntry,
QDialog#DeliveryChallanEntry QDialog { background-color: #FBF2F2; }
QDialog#DeliveryChallanEntry QGroupBox { border: 1px solid #E5D5D5; border-radius: 8px; padding: 5px; margin-top: 10px; background: #FFFFFF; }
QDialog#DeliveryChallanEntry QGroupBox::title { subcontrol-origin: margin; subcontrol-position: top left; left: 10px; padding: 0 4px; color: #2563EB; font-weight: bold; letter-spacing: 0.3px; }
QDialog#DeliveryChallanEntry QFrame#frameHeader,
QDialog#DeliveryChallanEntry QFrame#frameHdrFields,
QDialog#DeliveryChallanEntry QFrame#frameQuick,
QDialog#DeliveryChallanEntry QFrame#frame_2,
QDialog#DeliveryChallanEntry QFrame#frameTransport { border: 1px solid #E5D5D5; border-radius: 8px; background: #FFFFFF; }
/* DeliveryChallanEntry: per-widget (delivery_challan_entry.ui) */
QDialog#DeliveryChallanEntry QLabel#lblFormTitle { font-size:15px; font-weight:bold; color:#1F2937; }
QDialog#DeliveryChallanEntry QLabel#lblStatus { font-weight:bold; color:#B45309; padding:0 6px; }
QDialog#DeliveryChallanEntry QLabel#lblAudit { color:#666; font-size:10px; }
QDialog#DeliveryChallanEntry QLabel#lblDcRefno { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry QLabel#lblDcDate { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry QLabel#lblPurpose { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry QLabel#lblUsrRefno { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry QLabel#lblUsrRefdate { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry QLabel#lblPriceLevel { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry QLabel#lblSalesman { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry QLabel#lblBillToCap { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry QLabel#lblStockInfo { color:#666; font-size:10px; }
QDialog#DeliveryChallanEntry QLabel#lblSourceHint { color:#888; font-size:10px; }
QDialog#DeliveryChallanEntry QLabel#lbl_edtTotItems { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry NexDoubleEdit#edtTotItems,
QDialog#DeliveryChallanEntry NexDoubleEdit#edtTotItems * { font-weight:bold; font-size:13px; background:transparent; }
QDialog#DeliveryChallanEntry QLabel#lbl_edtTotBags { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry NexDoubleEdit#edtTotBags,
QDialog#DeliveryChallanEntry NexDoubleEdit#edtTotBags * { font-weight:bold; font-size:13px; background:transparent; }
QDialog#DeliveryChallanEntry QLabel#lbl_edtTotWeight { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry NexDoubleEdit#edtTotWeight,
QDialog#DeliveryChallanEntry NexDoubleEdit#edtTotWeight * { font-weight:bold; font-size:13px; background:transparent; }
QDialog#DeliveryChallanEntry QLabel#lbl_edtTaxableAmt { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry NexDoubleEdit#edtTaxableAmt,
QDialog#DeliveryChallanEntry NexDoubleEdit#edtTaxableAmt * { font-weight:bold; font-size:13px; background:transparent; }
QDialog#DeliveryChallanEntry QLabel#lbl_edtTaxAmt { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry NexDoubleEdit#edtTaxAmt,
QDialog#DeliveryChallanEntry NexDoubleEdit#edtTaxAmt * { font-weight:bold; font-size:13px; background:transparent; }
QDialog#DeliveryChallanEntry QLabel#lbl_edtTotal { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry NexDoubleEdit#edtTotal,
QDialog#DeliveryChallanEntry NexDoubleEdit#edtTotal * { font-weight:bold; font-size:13px; background:transparent; }
QDialog#DeliveryChallanEntry QLabel#lbl_edtCogs { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry NexDoubleEdit#edtCogs,
QDialog#DeliveryChallanEntry NexDoubleEdit#edtCogs * { font-weight:bold; font-size:13px; background:transparent; }
QDialog#DeliveryChallanEntry QLabel#lblRemarks { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry QLabel#lbl_edtGrossAmt { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry NexDoubleEdit#edtGrossAmt,
QDialog#DeliveryChallanEntry NexDoubleEdit#edtGrossAmt * { font-weight:bold; font-size:13px; background:transparent; }
QDialog#DeliveryChallanEntry QLabel#lbl_edtItemDisc { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry NexDoubleEdit#edtItemDisc,
QDialog#DeliveryChallanEntry NexDoubleEdit#edtItemDisc * { font-weight:bold; font-size:13px; background:transparent; }
QDialog#DeliveryChallanEntry QLabel#lbl_edtSplDisc { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry NexDoubleEdit#edtSplDisc,
QDialog#DeliveryChallanEntry NexDoubleEdit#edtSplDisc * { font-weight:bold; font-size:13px; background:transparent; }
QDialog#DeliveryChallanEntry QLabel#lbl_edtSchDisc { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry NexDoubleEdit#edtSchDisc,
QDialog#DeliveryChallanEntry NexDoubleEdit#edtSchDisc * { font-weight:bold; font-size:13px; background:transparent; }
QDialog#DeliveryChallanEntry QLabel#lbl_edtRoundOff { color:#666; font-size:10px; font-weight:bold; letter-spacing:0.5px; }
QDialog#DeliveryChallanEntry NexDoubleEdit#edtRoundOff,
QDialog#DeliveryChallanEntry NexDoubleEdit#edtRoundOff * { font-weight:bold; font-size:13px; background:transparent; }
/* DeliveryChallanEntry: states set from code */
QDialog#DeliveryChallanEntry QLabel#lblFulfilStatus[nexTone="open"] { color: #b35900; font-weight: bold; padding: 0 6px; }
QDialog#DeliveryChallanEntry QLabel#lblFulfilStatus[nexTone="done"] { color: #1a7f37; font-weight: bold; padding: 0 6px; }

/* PromotionSchemeEntry (promotion_scheme_entry.ui) */
QDialog#PromotionSchemeEntry,
QWidget QDialog#PromotionSchemeEntry,
QDialog#PromotionSchemeEntry QDialog { background-color: #FBF2F2; }
/* PromotionSchemeEntry: per-widget (promotion_scheme_entry.ui) */
QDialog#PromotionSchemeEntry QScrollArea#scrollScheme,
QDialog#PromotionSchemeEntry QScrollArea#scrollScheme QScrollArea { border: none; background: transparent; }
QDialog#PromotionSchemeEntry QLabel#lblIdentityHeading { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#PromotionSchemeEntry QFrame#ruleIdentity,
QDialog#PromotionSchemeEntry QFrame#ruleIdentity * { color:#E5E7EB; }
QDialog#PromotionSchemeEntry QLabel#lblOfferHeading { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#PromotionSchemeEntry QFrame#ruleOffer,
QDialog#PromotionSchemeEntry QFrame#ruleOffer * { color:#E5E7EB; }
QDialog#PromotionSchemeEntry QLabel#lblWhereHeading { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#PromotionSchemeEntry QFrame#ruleWhere,
QDialog#PromotionSchemeEntry QFrame#ruleWhere * { color:#E5E7EB; }
QDialog#PromotionSchemeEntry QLabel#lblWhenHeading { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#PromotionSchemeEntry QFrame#ruleWhen,
QDialog#PromotionSchemeEntry QFrame#ruleWhen * { color:#E5E7EB; }
QDialog#PromotionSchemeEntry QLabel#lblCapsHeading { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#PromotionSchemeEntry QFrame#ruleCaps,
QDialog#PromotionSchemeEntry QFrame#ruleCaps * { color:#E5E7EB; }
QDialog#PromotionSchemeEntry QLabel#lblBranchesHeading { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#PromotionSchemeEntry QFrame#ruleBranches,
QDialog#PromotionSchemeEntry QFrame#ruleBranches * { color:#E5E7EB; }
QDialog#PromotionSchemeEntry QLabel#lblHelptblBranches { color:#4B5563; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:4px; padding:8px; }
QDialog#PromotionSchemeEntry QLabel#lblPartiesHeading { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#PromotionSchemeEntry QFrame#ruleParties,
QDialog#PromotionSchemeEntry QFrame#ruleParties * { color:#E5E7EB; }
QDialog#PromotionSchemeEntry QLabel#lblHelptblParties { color:#4B5563; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:4px; padding:8px; }
QDialog#PromotionSchemeEntry QLabel#lblItemScopeHeading { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#PromotionSchemeEntry QFrame#ruleItemScope,
QDialog#PromotionSchemeEntry QFrame#ruleItemScope * { color:#E5E7EB; }
QDialog#PromotionSchemeEntry QLabel#lblHelptblItems { color:#4B5563; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:4px; padding:8px; }
QDialog#PromotionSchemeEntry QLabel#lblBandsHeading { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#PromotionSchemeEntry QFrame#ruleBands,
QDialog#PromotionSchemeEntry QFrame#ruleBands * { color:#E5E7EB; }
QDialog#PromotionSchemeEntry QLabel#lblHelptblSlabs { color:#4B5563; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:4px; padding:8px; }

/* QuotationEntry (quotation_entry.ui) */
QDialog#QuotationEntry,
QWidget QDialog#QuotationEntry,
QDialog#QuotationEntry QDialog { background-color: #FBF2F2; }
QDialog#QuotationEntry QGroupBox { border-radius: 8px; padding: 5px; }
QDialog#QuotationEntry QGroupBox::title { subcontrol-origin: margin; subcontrol-position: top left; left: 10px; padding: 0 4px; color: #2563EB; font-weight: bold; letter-spacing: 0.3px; }
/* QuotationEntry: per-widget (quotation_entry.ui) */
QDialog#QuotationEntry QLabel#lblTotalMargin { padding-right:10px; }
QDialog#QuotationEntry QLabel#lblTotalSavings { padding-left:10px; }
QDialog#QuotationEntry QLabel#lblFormTitle { font:25px; font-weight:bold; padding:5px; }
QDialog#QuotationEntry QLabel#lblStatus { font:25px; font-weight:bold; padding:5px; color:red; }
QDialog#QuotationEntry QLabel#lblAudit { color:#666; font-size:11px; padding:5px; }
QDialog#QuotationEntry QFrame#frameQuick QToolButton { border: 1px solid #E5D5D5; border-radius: 6px; padding: 3px 8px; background: #FFFFFF; }
QDialog#QuotationEntry QFrame#frameQuick QToolButton:hover { background: #F3E8E8; }
QDialog#QuotationEntry QFrame#frameQuick QToolButton:disabled { color: #B8A8A8; background: #FAF5F5; }
QDialog#QuotationEntry QLineEdit#txtQuoteRefno,
QDialog#QuotationEntry QLineEdit#txtQuoteRefno * { font-weight:bold; }
QDialog#QuotationEntry NexDoubleEdit#edtTotal,
QDialog#QuotationEntry NexDoubleEdit#edtTotal * { background:transparent; border:none; font-weight:bold; }

/* SaleBillEntry (sale_bill_entry.ui) */
QDialog#SaleBillEntry,
QWidget QDialog#SaleBillEntry,
QDialog#SaleBillEntry QDialog { background-color: #FBF2F2; }
QDialog#SaleBillEntry QGroupBox { border-radius: 8px; padding: 5px; }
QDialog#SaleBillEntry QGroupBox::title { subcontrol-origin: margin; subcontrol-position: top left; left: 10px; padding: 0 4px; color: #2563EB; font-weight: bold; letter-spacing: 0.3px; }
/* SaleBillEntry: per-widget (sale_bill_entry.ui) */
QDialog#SaleBillEntry QLabel#lblFormTitle { font:25px; font-weight:bold; padding:5px; }
QDialog#SaleBillEntry QLabel#lblSourceList { color:#444; }
QDialog#SaleBillEntry QLabel#lblStatus { font:25px; font-weight:bold; padding:5px; color:red; }
QDialog#SaleBillEntry QLabel#lblSource { font:12px; font-weight:bold; padding:4px 8px; border:1px solid #b58900; border-radius:9px; color:#b58900; }
QDialog#SaleBillEntry QLabel#lblAudit { color:#666; font-size:11px; padding:5px; }
QDialog#SaleBillEntry QFrame#frameQuick QToolButton { border: 1px solid #E5D5D5; border-radius: 6px; padding: 3px 8px; background: #FFFFFF; }
QDialog#SaleBillEntry QFrame#frameQuick QToolButton:hover { background: #F3E8E8; }
QDialog#SaleBillEntry QFrame#frameQuick QToolButton:disabled { color: #B8A8A8; background: #FAF5F5; }
QDialog#SaleBillEntry QLabel#lblFacts1 { padding: 3px 4px; }
QDialog#SaleBillEntry QLineEdit#txtBillRefno,
QDialog#SaleBillEntry QLineEdit#txtBillRefno * { font-weight:bold; }
QDialog#SaleBillEntry QGroupBox#grpTotals { background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; }
QDialog#SaleBillEntry QGroupBox#grpTotals QLabel { color: #6B7280; font-weight: normal; }
QDialog#SaleBillEntry QGroupBox#grpTotals QLabel#lblRemarks { color: #374151; font-weight: bold; }
QDialog#SaleBillEntry QGroupBox#grpTotals NexDoubleEdit { background: transparent; border: none; color: #111827; font-weight: bold; }
QDialog#SaleBillEntry QGroupBox#grpTotals NexDoubleEdit#edtTotal { color: #7B1113; }
QDialog#SaleBillEntry QGroupBox#grpTotals NexDoubleEdit#edtAdvanceAdj { color: #1A7F37; }
QDialog#SaleBillEntry QGroupBox#grpTotals NexDoubleEdit#edtCreditAmt { color: #C01C28; }
QDialog#SaleBillEntry NexDoubleEdit#edtTaxableAmt,
QDialog#SaleBillEntry NexDoubleEdit#edtTaxableAmt * { border:none; }
QDialog#SaleBillEntry NexDoubleEdit#edtTaxAmt,
QDialog#SaleBillEntry NexDoubleEdit#edtTaxAmt * { border:none; }
QDialog#SaleBillEntry NexDoubleEdit#edtCharges,
QDialog#SaleBillEntry NexDoubleEdit#edtCharges * { border:none; }
QDialog#SaleBillEntry NexDoubleEdit#edtTotal,
QDialog#SaleBillEntry NexDoubleEdit#edtTotal * { background:transparent; border:none; font-weight:bold; font-size:15px; color:#7B1113; }
QDialog#SaleBillEntry NexDoubleEdit#edtTendered,
QDialog#SaleBillEntry NexDoubleEdit#edtTendered * { border:none; }
QDialog#SaleBillEntry NexDoubleEdit#edtChangeGiven,
QDialog#SaleBillEntry NexDoubleEdit#edtChangeGiven * { border:none; }
QDialog#SaleBillEntry NexDoubleEdit#edtCreditAmt,
QDialog#SaleBillEntry NexDoubleEdit#edtCreditAmt * { border:none; }
QDialog#SaleBillEntry NexDoubleEdit#edtAdvanceAdj,
QDialog#SaleBillEntry NexDoubleEdit#edtAdvanceAdj * { border:none; }
QDialog#SaleBillEntry QLabel#lblStockInfo { color:#666; font-size:11px; }
QDialog#SaleBillEntry QLabel#lblTotalMargin { padding-right:10px; }
QDialog#SaleBillEntry QLabel#lblTotalSavings { padding-left:10px; }
/* SaleBillEntry: states set from code */
QDialog#SaleBillEntry QLineEdit#valCrAvailable[nexTone="danger"] { color: #c01c28; font-weight: bold; }
QDialog#SaleBillEntry QLineEdit#valCrPending[nexTone="danger"] { color: #c01c28; font-weight: bold; }
QDialog#SaleBillEntry QLineEdit#valAdvances[nexTone="success"] { color: #1a7f37; font-weight: bold; }
QDialog#SaleBillEntry QLineEdit#valCreditNotes[nexTone="success"] { color: #1a7f37; font-weight: bold; }
QDialog#SaleBillEntry QLineEdit#valCashToday[nexTone="warning"] { color: #b35900; font-weight: bold; }
QDialog#SaleBillEntry QLineEdit#valTempCredit[nexTone="warning"] { color: #b35900; font-weight: bold; }
QDialog#SaleBillEntry QLineEdit#valLoyaltyCard[nexTone="member"] { color: #0b7285; font-weight: bold; }
QDialog#SaleBillEntry QLabel#lblGstBadges { font-size: 11px; padding: 0 6px; }

/* SaleOrderEntry (sale_order_entry.ui) */
QDialog#SaleOrderEntry,
QWidget QDialog#SaleOrderEntry,
QDialog#SaleOrderEntry QDialog { background-color: #FBF2F2; }
QDialog#SaleOrderEntry QGroupBox { border-radius: 8px; padding: 5px; }
QDialog#SaleOrderEntry QGroupBox::title { subcontrol-origin: margin; subcontrol-position: top left; left: 10px; padding: 0 4px; color: #2563EB; font-weight: bold; letter-spacing: 0.3px; }
/* SaleOrderEntry: per-widget (sale_order_entry.ui) */
QDialog#SaleOrderEntry QLabel#lblFormTitle { font:25px; font-weight:bold; padding:5px; }
QDialog#SaleOrderEntry QLabel#lblStatus { font:25px; font-weight:bold; padding:5px; color:red; }
QDialog#SaleOrderEntry QLabel#lblFulfilStatus { font:14px; font-weight:bold; padding:5px; color:#0a7; }
QDialog#SaleOrderEntry QLabel#lblSource { font:12px; font-weight:bold; padding:4px 8px; border:1px solid #b58900; border-radius:9px; color:#b58900; }
QDialog#SaleOrderEntry QLabel#lblAudit { color:#666; font-size:11px; padding:5px; }
QDialog#SaleOrderEntry QFrame#frameQuick QToolButton { border: 1px solid #E5D5D5; border-radius: 6px; padding: 3px 8px; background: #FFFFFF; }
QDialog#SaleOrderEntry QFrame#frameQuick QToolButton:hover { background: #F3E8E8; }
QDialog#SaleOrderEntry QFrame#frameQuick QToolButton:disabled { color: #B8A8A8; background: #FAF5F5; }
QDialog#SaleOrderEntry QLineEdit#txtOrderRefno,
QDialog#SaleOrderEntry QLineEdit#txtOrderRefno * { font-weight:bold; }
QDialog#SaleOrderEntry QLabel#lblStockInfo { color:#666; font-size:11px; }
QDialog#SaleOrderEntry QLabel#lblCrStatus { color:#666; font-size:11px; }
QDialog#SaleOrderEntry NexDoubleEdit#edtTotal,
QDialog#SaleOrderEntry NexDoubleEdit#edtTotal * { background:transparent; border:none; font-weight:bold; }
QDialog#SaleOrderEntry QLabel#lblTotalMargin { padding-right:10px; }
QDialog#SaleOrderEntry QLabel#lblTotalSavings { padding-left:10px; }
/* SaleOrderEntry: states set from code */
QDialog#SaleOrderEntry QLineEdit#valCrOverdue[nexTone="danger"] { color: #c01c28; font-weight: bold; }
QDialog#SaleOrderEntry QLineEdit#valCrOverdueDays[nexTone="danger"] { color: #c01c28; font-weight: bold; }
QDialog#SaleOrderEntry QLineEdit#valCrAvailable[nexTone="danger"] { color: #c01c28; font-weight: bold; }
QDialog#SaleOrderEntry QLineEdit#valCrPending[nexTone="danger"] { color: #c01c28; font-weight: bold; }
QDialog#SaleOrderEntry QLineEdit#valCrLimit[nexTone="danger"] { color: #c01c28; font-weight: bold; }
QDialog#SaleOrderEntry QLabel#lblCrStatus[nexTone="danger"] { color: #c01c28; font-size: 11px; }

/* LoyaltySchemeEntry (no dialog-level sheet) */
/* LoyaltySchemeEntry: per-widget (loyalty_scheme_entry.ui) */
QDialog#LoyaltySchemeEntry QLabel#lblTitle { font-size:16px; font-weight:700; }
QDialog#LoyaltySchemeEntry QLabel#lblSubTitle { color:#6B7280; }
QDialog#LoyaltySchemeEntry QScrollArea#scrollScheme,
QDialog#LoyaltySchemeEntry QScrollArea#scrollScheme QScrollArea { border: none; background: transparent; }
QDialog#LoyaltySchemeEntry QLabel#lblHdr0laytabScheme { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#LoyaltySchemeEntry QFrame#ruleHdr0laytabScheme,
QDialog#LoyaltySchemeEntry QFrame#ruleHdr0laytabScheme * { color:#E5E7EB; }
QDialog#LoyaltySchemeEntry QLabel#lblHdr3laytabScheme { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#LoyaltySchemeEntry QFrame#ruleHdr3laytabScheme,
QDialog#LoyaltySchemeEntry QFrame#ruleHdr3laytabScheme * { color:#E5E7EB; }
QDialog#LoyaltySchemeEntry QLabel#lblHdr8laytabScheme { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#LoyaltySchemeEntry QFrame#ruleHdr8laytabScheme,
QDialog#LoyaltySchemeEntry QFrame#ruleHdr8laytabScheme * { color:#E5E7EB; }
QDialog#LoyaltySchemeEntry QLabel#lblHdr13laytabScheme { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#LoyaltySchemeEntry QFrame#ruleHdr13laytabScheme,
QDialog#LoyaltySchemeEntry QFrame#ruleHdr13laytabScheme * { color:#E5E7EB; }
QDialog#LoyaltySchemeEntry QLabel#lblHdr0laytabExpiry { color:#2563EB; font-weight:bold; letter-spacing:0.3px; }
QDialog#LoyaltySchemeEntry QFrame#ruleHdr0laytabExpiry,
QDialog#LoyaltySchemeEntry QFrame#ruleHdr0laytabExpiry * { color:#E5E7EB; }
QDialog#LoyaltySchemeEntry QLabel#lblCaptblBranches { color:#7B1113; font-weight:700; padding-top:6px; }
QDialog#LoyaltySchemeEntry QLabel#lblHelptabBranches { color:#4B5563; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:4px; padding:8px; }
QDialog#LoyaltySchemeEntry QLabel#lblCaptblParties { color:#7B1113; font-weight:700; padding-top:6px; }
QDialog#LoyaltySchemeEntry QLabel#lblHelptabCustomers { color:#4B5563; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:4px; padding:8px; }
QDialog#LoyaltySchemeEntry QLabel#lblCaptblItems { color:#7B1113; font-weight:700; padding-top:6px; }
QDialog#LoyaltySchemeEntry QLabel#lblHelptabItems { color:#4B5563; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:4px; padding:8px; }
QDialog#LoyaltySchemeEntry QLabel#lblCaptblSlabs { color:#7B1113; font-weight:700; padding-top:6px; }
QDialog#LoyaltySchemeEntry QLabel#lblHelptabSlabs { color:#4B5563; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:4px; padding:8px; }
QDialog#LoyaltySchemeEntry QLabel#lblCaptblGifts { color:#7B1113; font-weight:700; padding-top:6px; }
QDialog#LoyaltySchemeEntry QLabel#lblHelptabGifts { color:#4B5563; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:4px; padding:8px; }

/* ChequeBooksScreen (cheque_books_screen.ui) */
QDialog#ChequeBooksScreen,
QWidget QDialog#ChequeBooksScreen,
QDialog#ChequeBooksScreen QDialog { background-color: #F4F5F7; }
QDialog#ChequeBooksScreen QLabel#lblTitle { font-size: 16pt; font-weight: 700; color: #111827; }

/* SaleBillTender (sale_bill_tender.ui) */
QDialog#SaleBillTender,
QWidget QDialog#SaleBillTender,
QDialog#SaleBillTender QDialog { background-color: #FBF2F2; }
QDialog#SaleBillTender QGroupBox { border-radius: 8px; padding: 5px; }
QDialog#SaleBillTender QGroupBox::title { subcontrol-origin: margin; subcontrol-position: top left; left: 10px; padding: 0 4px; color: #2563EB; font-weight: bold; }
/* SaleBillTender: per-widget (sale_bill_tender.ui) */
QDialog#SaleBillTender QLabel#lblHint { color:#666; font-size:11px; }
QDialog#SaleBillTender QLabel#lblLastTender { color:#666; font-size:11px; }
QDialog#SaleBillTender QLabel#lblTenderBar { background:#fafafa; color:#8b1a1a; font-weight:700; font-size:12px; padding:6px; border-top-left-radius:8px; border-top-right-radius:8px; }
QDialog#SaleBillTender QTableWidget#tableTender,
QDialog#SaleBillTender QTableWidget#tableTender QTableWidget { font: 12pt; }
QDialog#SaleBillTender QTableWidget#tableTender QHeaderView::section:vertical { width: 118px; }
QDialog#SaleBillTender QTableWidget#tableTender QLineEdit { border:none; }
QDialog#SaleBillTender QTableWidget#tableTender,
QDialog#SaleBillTender QTableWidget#tableTender QTableView { border:1px solid lightgray;gridline-color: gray; }
QDialog#SaleBillTender NexDoubleEdit#lEBalance,
QDialog#SaleBillTender NexDoubleEdit#lEBalance * { font: 16pt; padding:0.2em; font-weight:bold; color:white; background:#A9A9A9; }
/* SaleBillTender: states set from code */
QDialog#SaleBillTender NexDoubleEdit#lETotal { font: 12pt; padding: 2px 6px; font-weight: bold; color: white; border-radius: 3px; background: #1E88E5; }
QDialog#SaleBillTender NexDoubleEdit#lEServiceCharge { font: 12pt; padding: 2px 6px; font-weight: bold; color: white; border-radius: 3px; background: #FB8C00; }
QDialog#SaleBillTender NexDoubleEdit#lETender { font: 12pt; padding: 2px 6px; font-weight: bold; color: white; border-radius: 3px; background: #43A047; }
QDialog#SaleBillTender NexDoubleEdit#lEAdjusted { font: 12pt; padding: 2px 6px; font-weight: bold; color: white; border-radius: 3px; background: #8E24AA; }
QDialog#SaleBillTender NexDoubleEdit#lEBalance[nexTone="settled"] { font: 12pt; padding: 2px 6px; font-weight: bold; color: white; border-radius: 3px; background: #A9A9A9; }
QDialog#SaleBillTender NexDoubleEdit#lEBalance[nexTone="shortAdvance"] { font: 12pt; padding: 2px 6px; font-weight: bold; color: white; border-radius: 3px; background: #FB8C00; }
QDialog#SaleBillTender NexDoubleEdit#lEBalance[nexTone="short"] { font: 12pt; padding: 2px 6px; font-weight: bold; color: white; border-radius: 3px; background: #FF4500; }
QDialog#SaleBillTender NexDoubleEdit#lEBalance[nexTone="refund"] { font: 12pt; padding: 2px 6px; font-weight: bold; color: white; border-radius: 3px; background: #006400; }
QDialog#SaleBillTender QLabel#lblTcWarn { color: #b35900; font-size: 11px; }
QDialog#SaleBillTender QLabel#lblCashLimit[nexTone="ok"] { color: #666; padding: 2px; }
QDialog#SaleBillTender QLabel#lblCashLimit[nexTone="breached"] { color: #c01c28; font-weight: bold; padding: 2px; }

/* ── Accounts: states set from code (NexStyle tones) ─────────────────── */
QDialog#PaymentEntry QLabel#lblStatusPill[nexTone="draft"] { background-color: #FEF3C7; color: #92400E; }
QDialog#PaymentEntry QLabel#lblStatusPill[nexTone="posted"] { background-color: #DCFCE7; color: #166534; }
QDialog#PaymentEntry QLabel#lblStatusPill[nexTone="cancelled"] { background-color: #FEE2E2; color: #991B1B; }
QDialog#PaymentEntry QFrame#frameIdentity[nexTone="good"] { background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; }
QDialog#PaymentEntry QFrame#frameIdentity[nexTone="bad"] { background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; }
QDialog#PaymentEntry QLabel#lblDifference[nexTone="good"] { font-size: 15px; font-weight: 700; color: #065F46; }
QDialog#PaymentEntry QLabel#lblDifference[nexTone="bad"] { font-size: 15px; font-weight: 700; color: #991B1B; }
QDialog#PaymentEntry QLabel#lblPartyOverdue[nexTone="danger"] { color: #B91C1C; }
QDialog#PaymentEntry QLabel#lblPartyCredits[nexTone="success"] { color: #15803D; }
QDialog#PaymentEntry QLabel#lblPartyAfterThis[nexTone="info"] { color: #1D4ED8; }
QDialog#ReceiptEntry QLabel#lblStatusPill[nexTone="draft"] { background-color: #FEF3C7; color: #92400E; }
QDialog#ReceiptEntry QLabel#lblStatusPill[nexTone="posted"] { background-color: #DCFCE7; color: #166534; }
QDialog#ReceiptEntry QLabel#lblStatusPill[nexTone="cancelled"] { background-color: #FEE2E2; color: #991B1B; }
QDialog#ReceiptEntry QFrame#frameIdentity[nexTone="good"] { background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; }
QDialog#ReceiptEntry QFrame#frameIdentity[nexTone="bad"] { background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; }
QDialog#ReceiptEntry QLabel#lblDifference[nexTone="good"] { font-size: 15px; font-weight: 700; color: #065F46; }
QDialog#ReceiptEntry QLabel#lblDifference[nexTone="bad"] { font-size: 15px; font-weight: 700; color: #991B1B; }
QDialog#ReceiptEntry QLabel#lblPartyOverdue[nexTone="danger"] { color: #B91C1C; }
QDialog#ReceiptEntry QLabel#lblPartyCredits[nexTone="success"] { color: #15803D; }
QDialog#ReceiptEntry QLabel#lblPartyAfterThis[nexTone="info"] { color: #1D4ED8; }
QDialog#PaymentEntry QLabel#lblPartyTds[nexTone="danger"] { color: #B91C1C; }
QDialog#PaymentEntry QLabel#lblPartyTds[nexTone="warning"] { color: #B45309; }
QDialog#OpeningBalanceEntry QLabel#lblServerTb[nexTone="warning"] { color: #92400E; }
QDialog#OpeningBalanceEntry QFrame#frameTotals[nexTone="good"], QDialog#OpeningBalanceEntry QFrame#frameBillBand[nexTone="good"], QDialog#OpeningBalanceEntry QFrame[nexBand="good"] { background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; }
QDialog#OpeningBalanceEntry QFrame#frameTotals[nexTone="bad"], QDialog#OpeningBalanceEntry QFrame#frameBillBand[nexTone="bad"], QDialog#OpeningBalanceEntry QFrame[nexBand="bad"] { background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; }
QDialog#OpeningBalanceEntry QLabel[nexBand="good"][figureCaption="true"] { color: #047857; }
QDialog#OpeningBalanceEntry QLabel[nexBand="good"][figureValue="true"] { color: #065F46; }
QDialog#OpeningBalanceEntry QLabel[nexBand="bad"][figureCaption="true"] { color: #B91C1C; }
QDialog#OpeningBalanceEntry QLabel[nexBand="bad"][figureValue="true"] { color: #991B1B; }
QDialog#OpeningBalanceEntry QLabel#lblStatusPill[nexTone="good"] { background-color: #DCFCE7; color: #166534; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 10px; }
QDialog#OpeningBalanceEntry QLabel#lblStatusPill[nexTone="bad"] { background-color: #FEE2E2; color: #991B1B; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 10px; }
QDialog#LedgerMapEntry QLabel#lblStatusPill[nexTone="good"] { background-color: #DCFCE7; color: #166534; }
QDialog#LedgerMapEntry QLabel#lblStatusPill[nexTone="bad"] { background-color: #FEE2E2; color: #991B1B; }
QDialog#VoucherRegisterEntry QLabel#lblTotals[nexTone="stale"] { color: #9CA3AF; }
QDialog#VoucherRegisterEntry QLabel#lblDifference[nexTone="good"] { background-color: #DCFCE7; color: #166534; }
QDialog#VoucherRegisterEntry QLabel#lblDifference[nexTone="bad"] { background-color: #FEE2E2; color: #991B1B; }
QDialog#VoucherRegisterEntry QLabel#lblStatus[nexTone="draft"] { background-color: #FEF3C7; color: #92400E; }
QDialog#VoucherRegisterEntry QLabel#lblStatus[nexTone="posted"] { background-color: #DCFCE7; color: #166534; }
QDialog#VoucherRegisterEntry QLabel#lblStatus[nexTone="cancelled"] { background-color: #F3F4F6; color: #374151; }
QDialog#ReceivedCheques QLabel#lblSelection[nexTone="warning"] { color: #92400E; font-weight: 700; }
QDialog#IssuedCheques QLabel#lblSelection[nexTone="warning"] { color: #92400E; font-weight: 700; }

/* Accounts dialogs built in code */
QLabel#lblBookFigures { color: #334155; font-weight: 600; }
QLabel#lblActionNote { color: #475569; font-size: 11px; }
QLabel#lblActionError { color: #B91C1C; font-weight: 600; }
QLabel#lblBeneficiaryNote { color: #6B7280; font-size: 11px; }
QLabel#lblPdcNotice { background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 6px; padding: 8px; color: #92400E; font-size: 11px; }
QLabel#lblChequeLeaf { color: #1D4ED8; }
QLabel#lblNoChequeBook { background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; padding: 8px; color: #991B1B; font-size: 11px; }
QLabel#lblExceptionsHint { color: #6B7280; }
QLabel#lblInstrumentHint { color: #6B7280; }
QLabel#lblInstrumentAmount { color: #374151; }
QLabel#lblInstrumentPdc { background: #FDF3E3; color: #B45309; border: 1px solid #B45309; border-radius: 5px; padding: 6px; }
QLabel#lblInstrumentError { color: #B91C1C; }
QLabel#lblBillwiseTotals { color: #374151; }

/* Sales dialogs built in code */
QLabel#lblSourcesStatus { color: #666; }
QLabel#lblRetenderHead { font-weight: bold; }
QLabel#lblRetenderStatus { color: #c01c28; }
QLabel#lblRetenderNewSum[nexTone="good"] { color: #1a7f37; font-weight: bold; }
QLabel#lblRetenderNewSum[nexTone="bad"] { color: #c01c28; font-weight: bold; }

/* Inventory dialogs built in code */
QLabel#lblLedgerGridSummary { color: #6B7280; }
QLabel#lblPickTitle { font-size: 18px; font-weight: bold; color: #111827; }
QLabel#lblPickSub { color: #6B7280; }
QLabel#lblPickNote { color: #555; }

QLabel[nexRole="dlgTitle"] { font-size: 18px; font-weight: bold; color: #111827; }
QLabel[nexRole="dlgMuted"] { color: #6B7280; }


QLabel#lblBucketNote { background: #FEF6E7; color: #92400E; padding: 8px 12px; border-radius: 4px; }
QLabel#lblBelowCostTitle { font-weight: bold; color: #111827; }

/* NexComboEntry: per-widget (nex_combo_entry.ui) */
QDialog#NexComboEntry QLabel#label_3 { font: italic; }
QDialog#NexComboEntry QLabel#label_2 { font: italic; }
QDialog#NexComboEntry QLabel#lblCompletion { font: italic; }
QDialog#NexComboEntry QCheckBox#chkWidth,
QDialog#NexComboEntry QCheckBox#chkWidth * { font: italic; }
QDialog#NexComboEntry QCheckBox#chkHeader,
QDialog#NexComboEntry QCheckBox#chkHeader * { font: italic; }

/* GridMasterEntry: per-widget (grid_master_entry.ui) */


QDialog#GridMasterEntry QFrame#fGridDetail { background-color:skyblue; }

/* GridMasterSetting: per-widget (grid_master_setting.ui) */
QDialog#GridMasterSetting QTableWidget#tableColumns,
QDialog#GridMasterSetting QTableWidget#tableColumns QTableWidget { background:white; }

/* PrintAssignments: per-widget (print_assignments.ui) */
QDialog#PrintAssignments QLabel#lblTitle { font:20px; font-weight:bold; color:#111827; padding:2px 6px; }
QDialog#PrintAssignments QLabel#lblSubtitle { color:#6B7280; }
QDialog#PrintAssignments QLabel#lblMatrixNote { color:#6B7280; }
QDialog#PrintAssignments QLabel#lblRowsNote { color:#6B7280; }
QDialog#PrintAssignments QLabel#lblProblem { background-color:#FEF2F2; border:1px solid #FECACA; border-radius:6px; padding:8px; color:#991B1B; }
QDialog#PrintAssignments QLabel#lblFootNote { color:#6B7280; }

/* PrintDesigner: per-widget (print_designer.ui) */
QDialog#PrintDesigner QLabel#lblTitle { font:20px; font-weight:bold; color:#111827; padding:2px 6px; }
QDialog#PrintDesigner QLabel#chipWorking { font-size:11px; font-weight:bold; padding:3px 9px; border-radius:9px; color:#B45309; background:#FDF0DA; }
QDialog#PrintDesigner QLabel#chipPublished { font-size:11px; font-weight:bold; padding:3px 9px; border-radius:9px; color:#15803D; background:#D6F0E0; }
QDialog#PrintDesigner QLabel#chipFork { font-size:11px; font-weight:bold; padding:3px 9px; border-radius:9px; color:#6B7280; background:#EDF0F4; }
QDialog#PrintDesigner QPushButton#btnUsedBy,
QDialog#PrintDesigner QPushButton#btnUsedBy QPushButton { font-size:11px; font-weight:bold; padding:3px 9px; border-radius:9px; color:#1D4ED8; background:#DCE7FE; border:none; }
QDialog#PrintDesigner QLabel#chipPayload { font-size:11px; font-weight:bold; padding:3px 9px; border-radius:9px; color:#1D4ED8; background:#DCE7FE; }
QDialog#PrintDesigner QLabel#lblIdentity { font-weight:bold; color:#7B1113; }
QDialog#PrintDesigner QLabel#keyIdentity { font-family:'DejaVu Sans Mono',monospace; font-size:11px; color:#1D4ED8; }
QDialog#PrintDesigner QLineEdit#edClonedFrom,
QDialog#PrintDesigner QLineEdit#edClonedFrom * { background:#F3F4F6; color:#6B7280; }
QDialog#PrintDesigner QLabel#lblPage { font-weight:bold; color:#6D28D9; }
QDialog#PrintDesigner QLabel#keyPage { font-family:'DejaVu Sans Mono',monospace; font-size:11px; color:#1D4ED8; }
QDialog#PrintDesigner QLabel#lblRail { font-weight:bold; color:#6D28D9; }
QDialog#PrintDesigner QLabel#keyRail { font-family:'DejaVu Sans Mono',monospace; font-size:11px; color:#1D4ED8; }
QDialog#PrintDesigner QLabel#lblRailNote { color:#6B7280; }
QDialog#PrintDesigner QLabel#lblBody { font-weight:bold; color:#6D28D9; }
QDialog#PrintDesigner QLabel#keyBody { font-family:'DejaVu Sans Mono',monospace; font-size:11px; color:#1D4ED8; }
QDialog#PrintDesigner QLabel#lblBodyNote { color:#6B7280; }
QDialog#PrintDesigner QLabel#lblCanvasNote { color:#6B7280; }
QDialog#PrintDesigner QPlainTextEdit#edBody,
QDialog#PrintDesigner QPlainTextEdit#edBody * { font-family:'DejaVu Sans Mono',monospace; font-size:12px; }
QDialog#PrintDesigner QLabel#lblDatasets { font-weight:bold; color:#6D28D9; }
QDialog#PrintDesigner QLabel#keyDatasets { font-family:'DejaVu Sans Mono',monospace; font-size:11px; color:#1D4ED8; }
QDialog#PrintDesigner QLabel#lblDatasetHint { color:#6B7280; }
QDialog#PrintDesigner QLabel#lblOrderNote { color:#6B7280; }
QDialog#PrintDesigner QPlainTextEdit#edDsSql,
QDialog#PrintDesigner QPlainTextEdit#edDsSql * { font-family:'DejaVu Sans Mono',monospace; font-size:12px; }
QDialog#PrintDesigner QLabel#lblNestNote { background:#EAF3EC; color:#1a6b5a; padding:6px 10px; border-radius:4px; }
QDialog#PrintDesigner QLabel#lblPrompts { font-weight:bold; color:#6D28D9; }
QDialog#PrintDesigner QLabel#keyPrompts { font-family:'DejaVu Sans Mono',monospace; font-size:11px; color:#1D4ED8; }
QDialog#PrintDesigner QLabel#lblPromptFindings { color:#9F1239; font-size:11px; }
QDialog#PrintDesigner QLabel#lblContext { background:#F4F8F5; color:#374151; padding:6px 10px; border-radius:4px; font-family:'DejaVu Sans Mono',monospace; font-size:11px; }
QDialog#PrintDesigner QLabel#lblReadOnlyNote { background:#FDECEF; color:#9F1239; padding:6px 10px; border-radius:4px; }
QDialog#PrintDesigner QLabel#lblFootHint { color:#6B7280; }


/* NexTableMasterEntry: per-widget (nex_table_master_entry.ui) */


QDialog#NexTableMasterEntry QFrame#fGridDetail { background-color:skyblue; }

/* NexTableSetting: per-widget (nex_table_setting.ui) */
QDialog#NexTableSetting QLabel#lblHint { color:#5c5c5c; }
QDialog#NexTableSetting NexColumnOrderTable#tableColumns,
QDialog#NexTableSetting NexColumnOrderTable#tableColumns QTableWidget { background:white; }

/* MenuWidgetEntry: per-widget (menu_widget_entry.ui) */
QDialog#MenuWidgetEntry QLabel#visibleHint { color:#6b7280;font-size:12px; }
QDialog#MenuWidgetEntry QLabel#fieldsHint { color:#6b7280;font-size:12px; }

/* ── Admin + printing (sweep step 6) ────────────────────────────────── */
/* Canvas window (was kStyle) */
QDialog#canvasWindow { background:#f0f0f0; color:#1b1b1b; }
QDialog#canvasWindow QWidget { font-size:11px; }
QDialog#canvasWindow QMenuBar { min-height:0px; max-height:1000px; padding:0px 2px; spacing:0px; border:none; border-bottom:1px solid #c8c8c8; background:#f0f0f0; }
QDialog#canvasWindow QMenuBar::item { height:20px; color:#1b1b1b; font-size:11px; margin:0px; border:none; padding:3px 8px; background:transparent; }
QDialog#canvasWindow QMenuBar::item:selected { border:none; background:#e4e4e4; color:#1b1b1b; }
QDialog#canvasWindow QMenuBar::item:pressed { border:none; background:#8b1d1d; color:#fff; }
QDialog#canvasWindow QMenu { background:#fafafa; color:#1b1b1b; border:1px solid #a0a0a0; border-radius:0px; padding:2px; font-size:11px; }
QDialog#canvasWindow QMenu::item { padding:3px 24px 3px 22px; color:#1b1b1b; background:transparent; border:none; }
QDialog#canvasWindow QMenu::item:selected { background:#8b1d1d; color:#fff; }
QDialog#canvasWindow QMenu::item:disabled { color:#9a9a9a; background:transparent; }
QDialog#canvasWindow QMenu::separator { height:1px; background:#d4d4d4; margin:2px 4px; }
QDialog#canvasWindow QMenu::indicator { width:12px; height:12px; left:6px; }
QDialog#canvasWindow QWidget#topBar { background:#f0f0f0; border-bottom:1px solid #c8c8c8; min-height:28px; max-height:28px; }
QDialog#canvasWindow QWidget#toolStrip { background:#f0f0f0; border-bottom:1px solid #a0a0a0; min-height:36px; max-height:36px; }
QDialog#canvasWindow QLabel#toolLabel { color:#5f5f5f; padding:0 4px 0 2px; }
QDialog#canvasWindow QFrame#toolDivider { color:#d4d4d4; }
QDialog#canvasWindow QToolButton#toolButton { min-width:22px; min-height:22px; max-height:22px; padding:0 4px; border:1px solid transparent; background:transparent; color:#1b1b1b; }
QDialog#canvasWindow QWidget#toolStrip QToolButton#toolButton { min-width:30px; min-height:30px; max-height:30px; padding:0 6px; font-family:'IBM Plex Mono','DejaVu Sans Mono',monospace; font-size:17px; }
QDialog#canvasWindow QWidget#toolStrip QToolButton#toolButtonWord { min-width:30px; min-height:30px; max-height:30px; padding:0 6px; border:1px solid transparent; background:transparent; color:#1b1b1b; font-size:12px; font-weight:600; }
QDialog#canvasWindow QToolButton#toolButton:hover,
QDialog#canvasWindow QToolButton#toolButtonWord:hover { border-color:#c8c8c8; background:qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #ffffff, stop:1 #e6e6e6); }
QDialog#canvasWindow QToolButton#toolButton:pressed,
QDialog#canvasWindow QToolButton#toolButtonWord:pressed { border-color:#a0a0a0; background:#dcdcdc; }
QDialog#canvasWindow QToolButton#toolButton:checked,
QDialog#canvasWindow QToolButton#toolButtonWord:checked { border-color:#a0a0a0; background:rgba(139,29,29,0.14); }
QDialog#canvasWindow QToolButton#toolButton:disabled,
QDialog#canvasWindow QToolButton#toolButtonWord:disabled { color:#9a9a9a; }
QDialog#canvasWindow QToolButton#toolButton::menu-indicator { image:none; width:0px; }
QDialog#canvasWindow QWidget#toolStrip QComboBox { min-height:22px; max-height:24px; border:1px solid #c8c8c8; background:#fff; padding:0 2px; }
QDialog#canvasWindow QLineEdit#nameInput { min-height:20px; max-height:20px; padding:0 4px; border:1px solid transparent; background:transparent; font-weight:600; }
QDialog#canvasWindow QLineEdit#nameInput:hover { border-color:#c8c8c8; background:#fff; }
QDialog#canvasWindow QLabel#metaLine { color:#5f5f5f; }
QDialog#canvasWindow QLabel#badge { min-height:15px; max-height:15px; padding:0 4px; border:1px solid #c8c8c8; background:#e4e4e4; color:#5f5f5f; font-size:9px; font-weight:700; }
QDialog#canvasWindow QLabel#badgeSystem { min-height:15px; max-height:15px; padding:0 4px; border:1px solid #b58585; background:#f6e9e9; color:#8b1d1d; font-size:9px; font-weight:700; }
QDialog#canvasWindow QLabel#badgeDirty { min-height:15px; max-height:15px; padding:0 4px; border:1px solid #b58585; background:#e4e4e4; color:#8b1d1d; font-size:9px; font-weight:700; }
QDialog#canvasWindow QPushButton#buttonPrimary { min-width:72px; min-height:20px; max-height:22px; padding:0 10px; border:1px solid #6d1616; background:qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #a02525, stop:1 #7c1717); color:#fff; }
QDialog#canvasWindow QPushButton#buttonPrimary:disabled { border-color:#a0a0a0; background:#e4e4e4; color:#9a9a9a; }
QDialog#canvasWindow QPushButton#button { min-width:72px; min-height:20px; max-height:22px; padding:0 10px; border:1px solid #a0a0a0; background:qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #fdfdfd, stop:1 #e8e8e8); color:#1b1b1b; }
QDialog#canvasWindow QPushButton#button:hover { background:qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #ffffff, stop:1 #dcdcdc); }
QDialog#canvasWindow QPushButton#button:disabled { color:#9a9a9a; background:#e4e4e4; }
QDialog#canvasWindow QTabWidget::pane { border:1px solid #c8c8c8; background:#fff; top:-1px; }
QDialog#canvasWindow QTabBar::tab { padding:3px 10px; border:1px solid #c8c8c8; border-bottom:0; background:#e4e4e4; color:#5f5f5f; }
QDialog#canvasWindow QTabBar::tab:selected { background:#fff; color:#1b1b1b; font-weight:600; }
QDialog#canvasWindow QTreeWidget { background:#fff; border:0; }
QDialog#canvasWindow QTreeWidget::item { height:20px; }
QDialog#canvasWindow QTreeWidget::item:selected { background:#8b1d1d; color:#fff; }
QDialog#canvasWindow QWidget#bindRow,
QDialog#canvasWindow QWidget#searchRow { background:#f0f0f0; }
QDialog#canvasWindow QWidget#statusBar { background:#f0f0f0; border-top:1px solid #a0a0a0; color:#5f5f5f; min-height:22px; max-height:22px; }
QDialog#canvasWindow QLabel#statusCell,
QDialog#canvasWindow QLabel#statusStrong { padding:0 8px; border:1px solid; border-color:#c8c8c8 #ffffff #ffffff #c8c8c8; background:rgba(255,255,255,0.5); color:#5f5f5f; }
QDialog#canvasWindow QLabel#statusStrong { color:#1b1b1b; }
QDialog#canvasWindow QToolButton#statusButton { padding:0 8px; border:1px solid transparent; background:transparent; }
QDialog#canvasWindow QToolButton#statusButton:hover { border-color:#c8c8c8; background:qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #ffffff, stop:1 #e6e6e6); }
QDialog#canvasWindow QGraphicsView { background:#6e7377; border:0; }
QDialog#canvasWindow QWidget#rulerCorner { background:#e4e4e4; }
QDialog#canvasWindow QLabel#statusCell[nexTone="dirty"] { color:#8a6100; }
/* Canvas properties panel (its own sheet) */
QDialog#canvasWindow QScrollArea#canvasProperties QWidget#propPanel { background:#ffffff; }
QDialog#canvasWindow QScrollArea#canvasProperties QLabel#panelHead { background:qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #f6f6f6, stop:1 #e2e2e2); border-bottom:1px solid #c8c8c8; padding:0 6px; min-height:20px; max-height:20px; font-size:10px; font-weight:700; color:#5f5f5f; }
QDialog#canvasWindow QScrollArea#canvasProperties QPushButton#sectionHead { text-align:left; padding:0 6px; border:0; border-bottom:1px solid #c8c8c8; background:qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #f2f2f2, stop:1 #e2e2e2); font-weight:700; color:#1b1b1b; min-height:20px; max-height:20px; }
QDialog#canvasWindow QScrollArea#canvasProperties QWidget#propRow { background:#ffffff; border-bottom:1px solid #ececec; }
QDialog#canvasWindow QScrollArea#canvasProperties QWidget#propRowAlt { background:#fafafa; border-bottom:1px solid #ececec; }
QDialog#canvasWindow QScrollArea#canvasProperties QLabel#propName { color:#1b1b1b; padding:0 6px; border-right:1px solid #c8c8c8; }
QDialog#canvasWindow QScrollArea#canvasProperties QLabel#propNameWide { color:#5f5f5f; font-size:10px; padding:0; }
QDialog#canvasWindow QScrollArea#canvasProperties QLineEdit,
QDialog#canvasWindow QScrollArea#canvasProperties QComboBox { min-height:18px; max-height:18px; padding:0 3px; border:1px solid transparent; background:transparent; }
QDialog#canvasWindow QScrollArea#canvasProperties QLineEdit:hover,
QDialog#canvasWindow QScrollArea#canvasProperties QComboBox:hover { border-color:#c8c8c8; background:#fff; }
QDialog#canvasWindow QScrollArea#canvasProperties QLineEdit:focus,
QDialog#canvasWindow QScrollArea#canvasProperties QComboBox:focus { border-color:#8b1d1d; background:#fff; }
QDialog#canvasWindow QScrollArea#canvasProperties QWidget#propRowWideBox QLineEdit,
QDialog#canvasWindow QScrollArea#canvasProperties QWidget#propRowWideBox QComboBox { border-color:#c8c8c8; background:#fff; }
QDialog#canvasWindow QScrollArea#canvasProperties QLineEdit[mono="true"] { font-family:'IBM Plex Mono','DejaVu Sans Mono',monospace; font-size:10px; }
QDialog#canvasWindow QScrollArea#canvasProperties QLineEdit[mixed="true"],
QDialog#canvasWindow QScrollArea#canvasProperties QComboBox[mixed="true"] { border:1px dashed #c8c8c8; color:#5f5f5f; }
QDialog#canvasWindow QScrollArea#canvasProperties QPlainTextEdit { min-height:40px; padding:2px 3px; border:1px solid #c8c8c8; background:#fff; font-family:'IBM Plex Mono','DejaVu Sans Mono',monospace; font-size:10px; }
QDialog#canvasWindow QScrollArea#canvasProperties QPlainTextEdit:focus { border-color:#8b1d1d; }
QDialog#canvasWindow QScrollArea#canvasProperties QPushButton#fxButton { min-width:20px; max-width:20px; min-height:20px; max-height:20px; padding:0; border:1px solid #a0a0a0; background:qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #fdfdfd, stop:1 #e8e8e8); font-family:'IBM Plex Mono','DejaVu Sans Mono',monospace; font-style:italic; font-size:10px; }
QDialog#canvasWindow QScrollArea#canvasProperties QPushButton#fxButton:hover { background:qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #ffffff, stop:1 #dcdcdc); }
QDialog#canvasWindow QScrollArea#canvasProperties QToolButton#toggle { min-width:22px; min-height:20px; max-height:20px; padding:0 4px; border:1px solid transparent; background:transparent; font-family:'IBM Plex Mono','DejaVu Sans Mono',monospace; font-size:12px; }
QDialog#canvasWindow QScrollArea#canvasProperties QToolButton#toggle:hover { border-color:#c8c8c8; background:qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #ffffff, stop:1 #e6e6e6); }
QDialog#canvasWindow QScrollArea#canvasProperties QToolButton#toggle:checked { border-color:#a0a0a0; background:rgba(139,29,29,0.14); }
QDialog#canvasWindow QScrollArea#canvasProperties QToolButton#preset { min-height:20px; padding:0 4px; border:1px solid transparent; background:transparent; }
QDialog#canvasWindow QScrollArea#canvasProperties QToolButton#preset:hover { border-color:#c8c8c8; background:qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #ffffff, stop:1 #e6e6e6); }
QDialog#canvasWindow QScrollArea#canvasProperties QToolButton#swatch { min-width:20px; max-width:20px; min-height:18px; max-height:18px; border:1px solid #c8c8c8; }
QDialog#canvasWindow QScrollArea#canvasProperties QLabel#panelNote { color:#5f5f5f; font-size:10px; padding:3px 6px; }
QDialog#canvasWindow QScrollArea#canvasProperties QLabel#issueLine { color:#8b1d1d; padding:3px 6px; }
QDialog#canvasWindow QScrollArea#canvasProperties QLabel#emptyPanel { color:#5f5f5f; padding:8px; }
QDialog#canvasWindow QScrollArea#canvasProperties QWidget#axisLevel { border-left:2px solid #c8c8c8; margin-left:8px; }
/* Canvas problems panel */
QDialog#canvasWindow QFrame#problemsPanel { background:#fafafa; border:1px solid #a0a0a0; }
QDialog#canvasWindow QFrame#problemsPanel QWidget#panelHead { background:qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #f2f2f2, stop:1 #e2e2e2); border-bottom:1px solid #c8c8c8; }
QDialog#canvasWindow QFrame#problemsPanel QLabel#panelHeadTitle { font-size:10px; font-weight:700; color:#1b1b1b; }
QDialog#canvasWindow QFrame#problemsPanel QToolButton { border:0; background:transparent; }
QDialog#canvasWindow QFrame#problemsPanel QListWidget { background:#fff; border:0; font-size:11px; }
QDialog#canvasWindow QFrame#problemsPanel QListWidget::item { padding:3px 6px; border-bottom:1px solid #ececec; color:#1b1b1b; }
QDialog#canvasWindow QFrame#problemsPanel QListWidget::item:hover { background:#e4e4e4; }
QDialog#canvasWindow QFrame#problemsPanel QListWidget::item:selected { background:#e4e4e4; color:#1b1b1b; }
/* Canvas keyboard shortcuts dialog */
QDialog#canvasShortcuts,
QWidget QDialog#canvasShortcuts,
QDialog#canvasShortcuts QDialog { background:#fafafa; }
QDialog#canvasShortcuts QLabel#group { font-size:10px; font-weight:700; color:#5f5f5f; padding-top:6px; }
QDialog#canvasShortcuts QLabel#keys { font-family:'IBM Plex Mono','DejaVu Sans Mono',monospace; font-size:10px; border:1px solid #c8c8c8; background:#fff; padding:0 4px; }
/* Designer preview dialog */
QDialog#designerPreview,
QWidget QDialog#designerPreview,
QDialog#designerPreview QDialog { background:#fafafa; }
QDialog#designerPreview QWidget#dialogHead { background:qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #f6f6f6, stop:1 #e2e2e2); border-bottom:1px solid #c8c8c8; }
QDialog#designerPreview QLabel#dialogTitle { font-weight:700; }
QDialog#designerPreview QLabel#badge { min-height:15px; max-height:15px; padding:0 4px; border:1px solid #c8c8c8; background:#e4e4e4; color:#5f5f5f; font-size:9px; font-weight:700; }
QDialog#designerPreview QLabel#issueLine { color:#8b1d1d; padding:3px 6px; }
QDialog#designerPreview QLabel#emptyPanel { color:#5f5f5f; padding:8px; }
QDialog#designerPreview QPushButton#buttonPrimary { min-width:72px; padding:2px 10px; border:1px solid #6d1616; color:#fff; background:qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 #a02525, stop:1 #7c1717); }
QDialog#designerPreview QPushButton#buttonPrimary:disabled { border-color:#a0a0a0; background:#e4e4e4; color:#9a9a9a; }
/* Print designer (states set from code) */
QDialog#PrintDesigner QLabel#lblBodyStatus[nexTone="good"] { color:#15803D; }
QDialog#PrintDesigner QLabel#lblBodyStatus[nexTone="bad"] { color:#9F1239; }
QDialog#PrintDesigner QLabel#lblDsLint[nexTone="good"] { color:#15803D; }
QDialog#PrintDesigner QLabel#lblDsLint[nexTone="bad"] { color:#9F1239; }
QDialog#PrintDesigner QLabel#chipPublished[nexTone="published"] { font-size:11px; font-weight:bold; padding:3px 9px; border-radius:9px; color:#15803D; background:#D6F0E0; }
QDialog#PrintDesigner QLabel#chipPublished[nexTone="unpublished"] { font-size:11px; font-weight:bold; padding:3px 9px; border-radius:9px; color:#B45309; background:#FDF0DA; }
QDialog#PrintDesigner QLabel#lblCanvasNote[nexTone="cleared"] { color: palette(window-text); }
QLabel#lblCompareVerdict[nexTone="same"] { color:#15803D; }
QLabel#lblCompareVerdict[nexTone="differ"] { color:#B45309; }
QPlainTextEdit#txtCompareSide,
QPlainTextEdit#txtCompareSide * { font-family:'DejaVu Sans Mono',monospace; font-size:11px; }

/* Canvas expression editor (opens over the canvas: the QWidget prefix keeps
   it level with the canvas's own QWidget { font-size } rule, and later) */
QWidget QPlainTextEdit#txtExpression,
QWidget QPlainTextEdit#txtExpression * { font-family:'DejaVu Sans Mono','Noto Sans Mono',monospace; font-size:12px; }
QWidget QLabel#lblTransformsCaption { color:#5f5f5f; font-size:11px; }
QWidget QLabel#lblExpressionIssues { color:#B91C1C; }
QWidget QLabel#lblExpressionHint { color:#5f5f5f; font-size:10px; }
QWidget QPushButton#btnExpressionApply { background:#8b1d1d; color:#fff; border:1px solid #6e1616; padding:3px 14px; }

/* Designer preview + document preview + print options + assignments */
QWidget QLabel#lblPreviewResult { font-family:'DejaVu Sans Mono',monospace; font-size:11px; padding:6px 8px; background:#F4F8F5; border:1px solid #c8c8c8; }
QWidget QPdfView#pdfPreview,
QWidget QPdfView#pdfPreview * { background-color:#6e7377; }
QWidget QPlainTextEdit#txtPreview,
QWidget QPlainTextEdit#txtPreview * { font-family:'DejaVu Sans Mono','Noto Sans Mono',monospace; font-size:12px; }
QLabel#lblDocPreviewState { color: #6B7280; }
QLabel#lblDocPreviewError { background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; padding: 8px; color: #991B1B; }
QPdfView#pdfDocPreview,
QPdfView#pdfDocPreview * { background-color: #E5E7EB; }
QPlainTextEdit#txtDocPreview,
QPlainTextEdit#txtDocPreview * { font-family:'DejaVu Sans Mono','Noto Sans Mono',monospace; font-size:12px; }
QLabel#lblPrintQuestion { font-weight: 600; }
QLabel#lblPrintStatus { color: #6B7280; }
QLabel#lblPrintFormatLine { color: #6B7280; }
QLabel#lblPrintFormatTitle { font-weight: 600; }
QLabel#lblAssignRung { font-size:11px; font-weight:bold; padding:3px 9px; border-radius:9px; color:#1D4ED8; background:#DCE7FE; }
QLabel#lblAssignDesignNote { color:#6B7280; font-size:11px; }
QLabel#lblAssignProblem { background-color:#FEF2F2; border:1px solid #FECACA; border-radius:6px; padding:8px; color:#991B1B; }
QPushButton#btnTemplateFilter { font-size:11px; font-weight:bold; padding:3px 9px; border-radius:9px; color:#1D4ED8; background:#DCE7FE; border:none; }

/* Print templates list */
QLabel#lblTemplatesTitle { font:22px; font-weight:bold; padding:4px; color:#111827; }
QLabel#lblTemplatesSubtitle { color:#6B7280; padding-left:8px; }
QLabel#lblTemplatesStatus { color:#6B7280; }


/* Module admin */
QLabel#lblModuleAdminSubtitle { color: gray; }

/* Application settings */
QLabel#settingsTitle { font:25px; font-weight:bold; padding:5px; color:#111827; }
QLabel#settingsScopeChip { font:12px; font-weight:bold; padding:4px 8px; border:1px solid #b58900; border-radius:9px; color:#b58900; }
QFrame#scopeBar { background:#FFFFFF; border:1px solid #E5E7EB; }
QLabel#settingsFieldCaption { font-weight:bold; border:none; background:transparent; }
QCheckBox#settingsChangedOnly,
QCheckBox#settingsChangedOnly * { border:none; background:transparent; }
QTreeWidget#settingsTree { background:#FFFFFF; border:1px solid #E5E7EB; }
QTreeWidget#settingsTree::item { height:28px; }
QTreeWidget#settingsTree::item:selected { background:{{primary}}; color:{{on.primary}}; }
QScrollArea#settingsScroll { background:transparent; border:none; }
QScrollArea#settingsScroll > QWidget > QWidget { background:transparent; }
QLabel#settingsHint { color:#6B7280; font-size:11px; }

QLabel#settingsEmpty { color:#6B7280; padding:12px; }
QFrame#settingGroup { background:#FFFFFF; border:1px solid #E5E7EB; }
QLabel#settingGroupHead { background:#F3F4F6; color:#111827; font-weight:bold; font-size:12px; border:none; border-bottom:1px solid #E5E7EB; }
QWidget#settingRow[nexTone="even"] { background:#FFFFFF; border:none; }
QWidget#settingRow[nexTone="odd"] { background:#FAFAFA; border:none; }
QLabel#settingName { font-weight:bold; color:#111827; background:transparent; }
QLabel#settingName[nexTone="locked"] { color:#9CA3AF; }
QLabel#settingDescription { color:#6B7280; font-size:11px; background:transparent; }
QWidget#settingTextWrap,
QWidget#settingTextWrap * { background:transparent; }
QLabel#settingBadge { font-size:10px; font-weight:bold; padding:2px 7px; border-radius:8px; background:#FFFFFF; }
QLabel#settingBadge[nexTone="locked"] { border:1px solid #E5E7EB; color:#9CA3AF; }
QLabel#settingBadge[nexTone="here"] { border:1px solid {{primary}}; color:{{primary}}; }
QLabel#settingBadge[nexTone="from"] { border:1px solid #b58900; color:#b58900; }
QLabel#settingBadge[nexTone="default"] { border:1px solid #E5E7EB; color:#6B7280; }
QPushButton#settingReset,
QPushButton#settingReset * { border:none; background:transparent; padding:0px; color:{{primary}}; font-size:11px; }

/* App Themes — the theme master (menu 266) */
QDialog#AppThemeEntry { background-color: {{surface}}; }
QDialog#AppThemeEntry QLabel#lblFormTitle { font-size: 20px; font-weight: bold; color: {{text}}; }
QDialog#AppThemeEntry Line#lineTitle,
QDialog#AppThemeEntry Line#lineTitle * { color: {{border}}; }
QDialog#AppThemeEntry QLabel[nexRole="sectionCap"] { color: {{primary}}; font-weight: bold; font-size: 12px; }
QDialog#AppThemeEntry QLabel[nexRole="muted"] { color: {{text.muted}}; font-size: 12px; }
QDialog#AppThemeEntry QLabel[nexRole="cap"] { color: {{text.muted}}; }
QDialog#AppThemeEntry QLabel[nexRole="pill"] { background: {{surface.alt}}; color: {{text.muted}}; font-size: 10px; font-weight: bold; padding: 2px 10px; border-radius: 9px; }
QDialog#AppThemeEntry QLabel[nexRole="pill"][nexTone="primary"] { background: {{primary.soft}}; color: {{primary}}; }
QDialog#AppThemeEntry QLabel#lblTplPill { background: {{danger.bg}}; color: {{danger}}; }
QDialog#AppThemeEntry QLabel#lblChangedStrip[nexTone="warning"],
QDialog#AppThemeEntry QLabel#lblTplWarn[nexTone="warning"] { background: {{warning.bg}}; color: {{warning}}; padding: 8px 14px; border-radius: 4px; }
QDialog#AppThemeEntry QLabel#lblValidation[nexTone="danger"] { background: {{danger.bg}}; color: {{danger}}; padding: 8px 14px; border-radius: 4px; }
QDialog#AppThemeEntry QLabel#lblValidation[nexTone="good"] { background: {{success.bg}}; color: {{success}}; padding: 8px 14px; border-radius: 4px; font-weight: 600; }
QDialog#AppThemeEntry QTabWidget#tabs::pane { border: none; border-top: 1px solid {{border}}; }
QDialog#AppThemeEntry QTabWidget#tabs QTabBar::tab { padding: 7px 22px; margin-right: 4px; border: 1px solid {{border}}; border-bottom: none; border-top-left-radius: 4px; border-top-right-radius: 4px; background: {{surface.alt}}; color: {{text.muted}}; }
QDialog#AppThemeEntry QTabWidget#tabs QTabBar::tab:selected { background: {{surface}}; color: {{text}}; font-weight: bold; border-top: 3px solid {{primary}}; }
QDialog#AppThemeEntry QTableWidget { border: 1px solid {{border}}; border-radius: 4px; gridline-color: {{border}}; }
QDialog#AppThemeEntry QTableWidget::item { padding: 2px 6px; }
QDialog#AppThemeEntry QPlainTextEdit#txtTemplate { border: 1px solid {{border}}; border-radius: 4px; background: {{surface}}; color: {{text}}; }
QDialog#AppThemeEntry QWidget#previewCard { background: transparent; }


/* TillMastersEntry — Till Masters (menu 275). The look of the approved mockups
   share/till/till_{counter,safe,reason,denomination}_master_ui_mockup.png:
   a grey page, the tab's list + form on one white card, maroon section
   captions ruled off in the form, chips in the lists, a facts card. */
QDialog#TillMastersEntry,
QWidget QDialog#TillMastersEntry,
QDialog#TillMastersEntry QDialog { background-color: {{surface.alt}}; }
QDialog#TillMastersEntry QLabel[nexRole="title"] { font-size: 22px; font-weight: bold; color: {{text}}; }
QDialog#TillMastersEntry QLabel[nexRole="muted"] { color: {{text.muted}}; font-size: 12px; }
QDialog#TillMastersEntry QLabel[nexRole="sectionCap"] { color: {{primary}}; font-weight: bold; font-size: 12px; }
QDialog#TillMastersEntry QLabel[nexRole="formCap"] { color: {{primary}}; font-weight: bold; font-size: 12px; padding: 6px 0 5px 0; border: 0px solid {{border}}; border-bottom-width: 1px; }
QDialog#TillMastersEntry QLabel[nexRole="cap"] { color: {{text.muted}}; font-size: 11px; }
QDialog#TillMastersEntry QLabel[nexRole="pill"] { background: {{surface.alt}}; color: {{text.muted}}; font-size: 11px; font-weight: bold; padding: 2px 10px; border-radius: 9px; }
QDialog#TillMastersEntry QLabel[nexRole="pill"][nexTone="warning"] { background: {{warning.bg}}; color: {{warning}}; }
QDialog#TillMastersEntry QLabel[nexRole="pill"][nexTone="primary"] { background: {{primary.soft}}; color: {{primary}}; }
QDialog#TillMastersEntry QLabel[nexRole="pill"][nexTone="info"] { background: {{info.bg}}; color: {{info}}; }
QDialog#TillMastersEntry QLabel#lblCtrWarn[nexTone="warning"],
QDialog#TillMastersEntry QLabel#lblSafeWarn[nexTone="warning"],
QDialog#TillMastersEntry QLabel#lblRsnWarn[nexTone="warning"],
QDialog#TillMastersEntry QLabel#lblDenWarn[nexTone="warning"] { background: {{warning.bg}}; color: {{warning}}; border: 1px solid #F5D78E; border-radius: 4px; padding: 7px 12px; }
QDialog#TillMastersEntry QFrame[nexRole="facts"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillMastersEntry QFrame[nexRole="facts"] QLabel { background: transparent; border: none; color: {{text}}; }
QDialog#TillMastersEntry QFrame[nexRole="facts"] QLabel[nexRole="cap"] { color: {{text.muted}}; }
QDialog#TillMastersEntry QFrame[nexRole="facts"] QLabel[nexTone="danger"] { color: {{danger}}; }
QDialog#TillMastersEntry QTabWidget#tabs::pane { background: {{surface}}; border: 1px solid {{border}}; border-radius: 6px; top: -1px; }
QDialog#TillMastersEntry QTabWidget#tabs > QWidget,
QDialog#TillMastersEntry QTabWidget#tabs QStackedWidget > QWidget { background: {{surface}}; }
QDialog#TillMastersEntry QTabWidget#tabs QTabBar::tab { padding: 8px 22px; margin-right: 4px; border: 1px solid {{border}}; border-bottom: none; border-top-left-radius: 6px; border-top-right-radius: 6px; background: {{surface.alt}}; color: {{text.muted}}; }
QDialog#TillMastersEntry QTabWidget#tabs QTabBar::tab:selected { background: {{surface}}; color: {{text}}; font-weight: bold; border-top: 3px solid {{primary}}; }
QDialog#TillMastersEntry QListWidget#lstRsnCategories { border: none; background: {{surface}}; font-family: "DejaVu Sans Mono", "Consolas", monospace; font-size: 11px; outline: 0; }
QDialog#TillMastersEntry QListWidget#lstRsnCategories::item { border-radius: 4px; }
QDialog#TillMastersEntry QListWidget#lstRsnCategories::item:selected { background: {{table.free}}; color: {{text}}; border: 1px solid #F5D78E; }
QDialog#TillMastersEntry QTableWidget { border: 1px solid #CBD0D7; gridline-color: #DCDFE4; }
QDialog#TillMastersEntry QTableWidget#tblDenPreview { selection-background-color: transparent; }

/* TillOpenSessionDialog — S1 Open Till Session (menu 272).
   Mockup share/till/till_open_session_ui_mockup.png: two white cards on a
   grey page, a facts strip, maroon ruled captions, count grids, a summary
   card, the amber approval band, F10 Open primary. */
QDialog#TillOpenSessionDialog,
QWidget QDialog#TillOpenSessionDialog,
QDialog#TillOpenSessionDialog QDialog { background-color: {{surface.alt}}; }
QDialog#TillOpenSessionDialog QFrame[nexRole="card"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 8px; }
QDialog#TillOpenSessionDialog QFrame[nexRole="card"] QLabel,
QDialog#TillOpenSessionDialog QFrame[nexRole="card"] QRadioButton { background: transparent; }
QDialog#TillOpenSessionDialog QLabel[nexRole="dlgTitle"] { font-size: 15px; font-weight: bold; color: {{text}}; }
QDialog#TillOpenSessionDialog QLabel[nexRole="dlgSubTitle"] { font-size: 14px; font-weight: bold; color: {{text}}; }
QDialog#TillOpenSessionDialog QLabel[nexRole="strong"] { font-weight: bold; color: {{text}}; }
QDialog#TillOpenSessionDialog QLabel[nexRole="muted"] { color: {{text.muted}}; font-size: 12px; }
QDialog#TillOpenSessionDialog QLabel[nexRole="cap"] { color: {{text.muted}}; font-size: 11px; }
QDialog#TillOpenSessionDialog QLabel[nexRole="code"] { color: {{text.muted}}; font-family: "DejaVu Sans Mono", "Consolas", monospace; font-size: 11px; }
QDialog#TillOpenSessionDialog QLabel#lblMismatchCode[nexRole="code"] { color: {{warning}}; font-weight: bold; }
QDialog#TillOpenSessionDialog QLabel[nexRole="formCap"] { color: {{primary}}; font-weight: bold; font-size: 12px; padding: 6px 0 5px 0; border: 0px solid {{border}}; border-bottom-width: 1px; }
QDialog#TillOpenSessionDialog QLabel[nexRole="pill"] { background: {{surface.alt}}; color: {{text.muted}}; font-size: 11px; font-weight: bold; padding: 3px 10px; border-radius: 10px; }
QDialog#TillOpenSessionDialog QLabel[nexRole="pill"][nexTone="primary"] { background: {{primary}}; color: {{on.primary}}; }
QDialog#TillOpenSessionDialog QLabel[nexRole="pill"][nexTone="info"] { background: {{info}}; color: {{on.primary}}; }
QDialog#TillOpenSessionDialog QLabel[nexRole="pill"][nexTone="warning"] { background: {{warning}}; color: {{on.primary}}; font-size: 10px; padding: 2px 8px; }
QDialog#TillOpenSessionDialog QFrame[nexRole="facts"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillOpenSessionDialog QFrame[nexRole="facts"] QLabel { background: transparent; border: none; color: {{text}}; }
QDialog#TillOpenSessionDialog QFrame[nexRole="facts"] QLabel[nexRole="cap"] { color: {{text.muted}}; }
QDialog#TillOpenSessionDialog QFrame#frameFacts QLabel[nexRole="cap"] { color: {{text.muted}}; font-size: 12px; }
QDialog#TillOpenSessionDialog QFrame#frameFacts QLabel#valCounter,
QDialog#TillOpenSessionDialog QFrame#frameFacts QLabel#valDate,
QDialog#TillOpenSessionDialog QFrame#frameFacts QLabel#valCashier,
QDialog#TillOpenSessionDialog QFrame#frameFacts QLabel#valSessionNo,
QDialog#TillOpenSessionDialog QFrame#frameFacts QLabel#valDay { background: {{surface}}; border: 1px solid {{border}}; border-radius: 3px; padding: 3px 8px; }
QDialog#TillOpenSessionDialog QLabel[nexRole="figure"] { font-size: 15px; font-weight: bold; color: {{text}}; }
QDialog#TillOpenSessionDialog QLabel[nexRole="figure"][nexTone="danger"] { color: {{danger}}; }
QDialog#TillOpenSessionDialog QLabel[nexRole="figure"][nexTone="warning"] { color: {{warning}}; }
QDialog#TillOpenSessionDialog QLabel[nexRole="figure"][nexTone="success"] { color: {{success}}; }
QDialog#TillOpenSessionDialog QLabel#valLiveGauge[nexTone="warning"] { color: #C2410C; font-weight: bold; }
QDialog#TillOpenSessionDialog QFrame[nexRole="approval"] { background: #FFFBEB; border: 1px solid #F5D78E; border-radius: 6px; }
QDialog#TillOpenSessionDialog QFrame[nexRole="approval"] QLabel { background: transparent; border: none; }
QDialog#TillOpenSessionDialog QFrame[nexRole="approval"] QLabel#valMismatchAmount { color: {{danger}}; font-weight: bold; }
QDialog#TillOpenSessionDialog QFrame[nexRole="approval"] QLabel[nexRole="muted"] { color: #92400E; font-size: 11px; }
QDialog#TillOpenSessionDialog QLabel#lblWarn[nexTone="warning"] { color: {{warning}}; }
QDialog#TillOpenSessionDialog QLabel#lblWarn[nexTone="danger"] { color: {{danger}}; font-weight: bold; }
QDialog#TillOpenSessionDialog QTableWidget { border: 1px solid #CBD0D7; gridline-color: #DCDFE4; background: {{surface}}; }
QDialog#TillOpenSessionDialog QTableWidget QSpinBox { border: 1px solid {{border}}; border-radius: 3px; margin: 2px 4px; background: {{surface}}; }
QDialog#TillOpenSessionDialog QTableWidget QSpinBox:focus { border: 2px solid {{primary}}; }
QDialog#TillOpenSessionDialog QPushButton[nexRole="danger"] { background: {{surface}}; color: {{danger}}; border: 1px solid {{danger}}; border-radius: 4px; padding: 6px 18px; font-weight: bold; }
QDialog#TillOpenSessionDialog QPushButton[nexRole="danger"]:disabled { color: #E3A3A8; border-color: #F1C9CC; }
QDialog#TillOpenSessionDialog QPushButton#btnOpen,
QDialog#TillOpenSessionDialog QPushButton#btnNotNow,
QDialog#TillOpenSessionDialog QPushButton#btnResume { min-width: 130px; padding: 6px 18px; font-weight: bold; }

/* TillEndShiftDialog — S4 End Shift, the blind close (opened from Open Till).
   Mockup share/till/till_end_shift_ui_mockup.png: one white card, four step
   pills, the green step-1 band, ruled captions, the hidden-expected bar, the
   three answers (the one given lit), the close band, F10 Submit primary. */
QDialog#TillEndShiftDialog,
QWidget QDialog#TillEndShiftDialog,
QDialog#TillEndShiftDialog QDialog { background-color: {{surface.alt}}; }
QDialog#TillEndShiftDialog QFrame[nexRole="card"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 8px; }
QDialog#TillEndShiftDialog QFrame[nexRole="card"] QLabel { background: transparent; }
QDialog#TillEndShiftDialog QLabel[nexRole="dlgTitle"] { font-size: 15px; font-weight: bold; color: {{text}}; }
QDialog#TillEndShiftDialog QLabel[nexRole="strong"] { font-weight: bold; color: {{text}}; }
QDialog#TillEndShiftDialog QLabel[nexRole="muted"] { color: {{text.muted}}; font-size: 12px; }
QDialog#TillEndShiftDialog QLabel[nexRole="cap"] { color: {{text.muted}}; font-size: 11px; }
QDialog#TillEndShiftDialog QLabel[nexRole="code"] { color: {{text.muted}}; font-family: "DejaVu Sans Mono", "Consolas", monospace; font-size: 11px; }
QDialog#TillEndShiftDialog QLabel[nexRole="formCap"] { color: {{primary}}; font-weight: bold; font-size: 12px; padding: 6px 0 5px 0; border: 0px solid {{border}}; border-bottom-width: 1px; }
QDialog#TillEndShiftDialog QLabel[nexRole="figure"] { font-size: 15px; font-weight: bold; color: {{text}}; }
QDialog#TillEndShiftDialog QLabel[nexRole="hiddenFigure"] { background: {{border}}; border-radius: 3px; min-height: 12px; max-height: 12px; }
QDialog#TillEndShiftDialog QLabel[nexRole="pill"] { background: {{surface.alt}}; color: {{text.muted}}; font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 9px; }
QDialog#TillEndShiftDialog QLabel[nexRole="pill"][nexTone="success"] { background: {{success}}; color: {{on.primary}}; }
QDialog#TillEndShiftDialog QLabel[nexRole="pill"][nexTone="warning"] { background: #C2410C; color: {{on.primary}}; }
QDialog#TillEndShiftDialog QLabel[nexRole="pill"][nexTone="danger"] { background: {{primary}}; color: {{on.primary}}; }
QDialog#TillEndShiftDialog QLabel[nexRole="step"] { border: 1px solid {{border}}; border-radius: 12px; padding: 6px 16px; font-weight: bold; background: {{surface.alt}}; color: {{text.muted}}; }
QDialog#TillEndShiftDialog QLabel[nexRole="step"][nexTone="done"] { background: {{success.bg}}; border-color: {{success}}; color: {{success}}; }
QDialog#TillEndShiftDialog QLabel[nexRole="step"][nexTone="current"] { background: {{primary.softer}}; border-color: {{primary}}; color: {{primary}}; }
QDialog#TillEndShiftDialog QFrame[nexRole="stepBand"] { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; }
QDialog#TillEndShiftDialog QFrame[nexRole="facts"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillEndShiftDialog QFrame[nexRole="facts"] QLabel { background: transparent; border: none; }
QDialog#TillEndShiftDialog QFrame[nexRole="facts"] QLabel[nexRole="hiddenFigure"] { background: {{border}}; }
QDialog#TillEndShiftDialog QFrame[nexRole="answer"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillEndShiftDialog QFrame[nexRole="answer"] QLabel { background: transparent; border: none; }
QDialog#TillEndShiftDialog QFrame[nexRole="answer"][nexTone="success"][nexState="on"] { background: #F0FDF4; border: 2px solid {{success}}; }
QDialog#TillEndShiftDialog QFrame[nexRole="answer"][nexTone="warning"][nexState="on"] { background: #FFF7ED; border: 2px solid #C2410C; }
QDialog#TillEndShiftDialog QFrame[nexRole="answer"][nexTone="danger"][nexState="on"] { background: #FDF2F2; border: 2px solid {{primary}}; }
QDialog#TillEndShiftDialog QFrame[nexRole="answer"][nexState="off"] QLabel { color: #9CA3AF; }
QDialog#TillEndShiftDialog QFrame[nexRole="approval"] { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; }
QDialog#TillEndShiftDialog QFrame[nexRole="approval"] QLabel { background: transparent; border: none; }
QDialog#TillEndShiftDialog QTableWidget { border: 1px solid #CBD0D7; gridline-color: #DCDFE4; background: {{surface}}; }
QDialog#TillEndShiftDialog QTableWidget QSpinBox,
QDialog#TillEndShiftDialog QTableWidget QDoubleSpinBox,
QDialog#TillEndShiftDialog QTableWidget QLineEdit { border: 1px solid {{border}}; border-radius: 3px; margin: 2px 4px; background: {{surface}}; }
QDialog#TillEndShiftDialog QTableWidget QSpinBox:focus,
QDialog#TillEndShiftDialog QTableWidget QDoubleSpinBox:focus,
QDialog#TillEndShiftDialog QTableWidget QLineEdit:focus { border: 2px solid {{primary}}; }
QDialog#TillEndShiftDialog QPushButton#btnSubmit,
QDialog#TillEndShiftDialog QPushButton#btnBack,
QDialog#TillEndShiftDialog QPushButton#btnCloseSession { min-width: 130px; padding: 6px 18px; font-weight: bold; }
QDialog#TillOpenSessionDialog QPushButton#btnEndShift { min-width: 110px; padding: 6px 14px; font-weight: bold; }

/* TillCashMovementDialog — S3 Cash Movement rev 3 (2026-10-12): header with
   the session line + a direction pill, four equal mode tiles, the form beside
   a summary card (big amount), the count grids below, Close / Post right. */
QDialog#TillCashMovementDialog,
QWidget QDialog#TillCashMovementDialog,
QDialog#TillCashMovementDialog QDialog { background-color: {{surface.alt}}; }
QDialog#TillCashMovementDialog QFrame[nexRole="card"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 8px; }
QDialog#TillCashMovementDialog QFrame[nexRole="card"] QLabel { background: transparent; }
QDialog#TillCashMovementDialog QLabel[nexRole="dlgTitle"] { font-size: 16px; font-weight: bold; color: {{text}}; }
QDialog#TillCashMovementDialog QLabel[nexRole="muted"] { color: {{text.muted}}; font-size: 12px; }
QDialog#TillCashMovementDialog QLabel[nexRole="cap"] { color: {{text.muted}}; font-size: 12px; }
QDialog#TillCashMovementDialog QLabel[nexRole="sectionCap"] { color: {{text.muted}}; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; }
QDialog#TillCashMovementDialog QLabel[nexRole="figure"] { font-size: 26px; font-weight: bold; color: {{text}}; }
QDialog#TillCashMovementDialog QLabel[nexRole="pill"] { background: {{surface.alt}}; color: {{text.muted}}; font-size: 11px; font-weight: bold; padding: 4px 12px; border-radius: 11px; }
QDialog#TillCashMovementDialog QLabel[nexRole="pill"][nexTone="success"] { background: #0F766E; color: {{on.primary}}; }
QDialog#TillCashMovementDialog QLabel[nexRole="pill"][nexTone="info"] { background: {{info}}; color: {{on.primary}}; }
QDialog#TillCashMovementDialog QFrame[nexRole="facts"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 8px; }
QDialog#TillCashMovementDialog QFrame[nexRole="facts"] QLabel { background: transparent; border: none; }
QDialog#TillCashMovementDialog QFrame[nexRole="facts"] QFrame#lineSummary { border: none; border-top: 1px solid {{border}}; max-height: 1px; }
QDialog#TillCashMovementDialog QFrame#lineFoot { border: none; border-top: 1px solid {{border}}; max-height: 1px; }
QDialog#TillCashMovementDialog QPushButton[nexRole="mode"] { min-height: 44px; padding: 6px 14px; text-align: left; font-weight: bold; }
QDialog#TillCashMovementDialog QLabel#lblWarn[nexTone="warning"] { color: {{warning}}; }
QDialog#TillCashMovementDialog QTableWidget { border: 1px solid #CBD0D7; gridline-color: #DCDFE4; background: {{surface}}; }
QDialog#TillCashMovementDialog QTableWidget QSpinBox { border: 1px solid {{border}}; border-radius: 3px; margin: 2px 4px; background: {{surface}}; }
QDialog#TillCashMovementDialog QTableWidget QSpinBox:focus { border: 2px solid {{primary}}; }
QDialog#TillCashMovementDialog QPushButton#btnPost,
QDialog#TillCashMovementDialog QPushButton#btnEsc { padding: 7px 18px; font-weight: bold; }
QDialog#TillOpenSessionDialog QPushButton#btnCashMovement { min-width: 120px; padding: 6px 14px; font-weight: bold; }

/* TillSessionCockpit — S5 Session Cockpit (Enter on Till Sessions, menu 273).
   Mockup share/till/till_session_cockpit_ui_mockup.png: one white card, big
   title + status pill, a boxed facts strip, the count tiles, the tender
   reconciliation, doc tabs + timeline, the amber approval band, the verb bar. */
QDialog#TillSessionCockpit,
QWidget QDialog#TillSessionCockpit,
QDialog#TillSessionCockpit QDialog { background-color: {{surface.alt}}; }
QDialog#TillSessionCockpit QFrame[nexRole="card"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 8px; }
QDialog#TillSessionCockpit QFrame[nexRole="card"] QLabel { background: transparent; }
QDialog#TillSessionCockpit QLabel[nexRole="title"] { font-size: 20px; font-weight: bold; color: {{text}}; }
QDialog#TillSessionCockpit QLabel[nexRole="muted"] { color: {{text.muted}}; font-size: 12px; }
QDialog#TillSessionCockpit QLabel[nexRole="cap"] { color: {{text.muted}}; font-size: 11px; }
QDialog#TillSessionCockpit QLabel[nexRole="code"] { color: {{text.muted}}; font-family: "DejaVu Sans Mono", "Consolas", monospace; font-size: 11px; }
QDialog#TillSessionCockpit QLabel[nexRole="formCap"] { color: {{primary}}; font-weight: bold; font-size: 12px; padding: 6px 0 5px 0; border: 0px solid {{border}}; border-bottom-width: 1px; }
QDialog#TillSessionCockpit QLabel[nexRole="pill"] { background: {{surface.alt}}; color: {{text.muted}}; font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; }
QDialog#TillSessionCockpit QLabel[nexRole="pill"][nexTone="danger"] { background: {{primary}}; color: {{on.primary}}; }
QDialog#TillSessionCockpit QLabel[nexRole="pill"][nexTone="success"] { background: {{success}}; color: {{on.primary}}; }
QDialog#TillSessionCockpit QLabel[nexRole="pill"][nexTone="warning"] { background: #C2410C; color: {{on.primary}}; font-size: 10px; padding: 2px 8px; }
QDialog#TillSessionCockpit QLabel[nexRole="pill"][nexTone="info"] { background: {{info}}; color: {{on.primary}}; }
QDialog#TillSessionCockpit QFrame[nexRole="facts"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillSessionCockpit QFrame[nexRole="facts"] QLabel { background: transparent; border: none; }
QDialog#TillSessionCockpit QFrame[nexRole="facts"] QLabel[nexRole="factValue"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 3px; padding: 3px 8px; color: {{text}}; }
QDialog#TillSessionCockpit QFrame[nexRole="tile"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; min-width: 76px; }
QDialog#TillSessionCockpit QFrame[nexRole="tile"] QLabel { background: transparent; border: none; }
QDialog#TillSessionCockpit QLabel[nexRole="figure"] { font-size: 15px; font-weight: bold; color: {{text}}; }
QDialog#TillSessionCockpit QLabel[nexRole="figure"][nexTone="warning"] { color: #C2410C; }
QDialog#TillSessionCockpit QFrame[nexRole="approval"] { background: #FFFBEB; border: 1px solid #F5D78E; border-radius: 6px; }
QDialog#TillSessionCockpit QFrame[nexRole="approval"] QLabel { background: transparent; border: none; }
QDialog#TillSessionCockpit QFrame[nexRole="approval"] QLabel#lblApprovalCode { color: {{warning}}; font-weight: bold; }
QDialog#TillSessionCockpit QFrame[nexRole="approval"] QLabel#valApprovalAmount { color: {{danger}}; font-weight: bold; }
QDialog#TillSessionCockpit QFrame[nexRole="approval"] QLabel[nexRole="muted"] { color: #92400E; font-size: 11px; }
QDialog#TillSessionCockpit QTableWidget { border: 1px solid #CBD0D7; gridline-color: #DCDFE4; background: {{surface}}; }
QDialog#TillSessionCockpit QTabWidget#tabsDocs::pane { border: none; border-top: 1px solid {{border}}; }
QDialog#TillSessionCockpit QTabWidget#tabsDocs QTabBar::tab { padding: 6px 16px; border: none; background: transparent; color: {{text.muted}}; }
QDialog#TillSessionCockpit QTabWidget#tabsDocs QTabBar::tab:selected { color: {{primary}}; font-weight: bold; border-bottom: 2px solid {{primary}}; }
QDialog#TillSessionCockpit QPushButton[nexRole="accent"] { color: #6D28D9; border: 1px solid #A78BFA; background: {{surface}}; }
QDialog#TillSessionCockpit QPushButton[nexRole="danger"] { color: {{danger}}; border: 1px solid {{danger}}; background: {{surface}}; }
QDialog#TillSessionCockpit QPushButton[nexRole="accent"]:disabled { color: #C4B5FD; border-color: #DDD6FE; }
QDialog#TillSessionCockpit QPushButton[nexRole="danger"]:disabled { color: #E3A3A8; border-color: #F1C9CC; }
QDialog#TillSessionCockpit QPushButton { min-width: 96px; padding: 6px 14px; font-weight: bold; }

/* TillBusinessDayEntry — Business Day (menu 274): Day Open, the day's
   checklist (client reading), sessions of the day, the day in numbers.
   Mockup share/till/till_day_close_ui_mockup.png. */
QDialog#TillBusinessDayEntry,
QWidget QDialog#TillBusinessDayEntry,
QDialog#TillBusinessDayEntry QDialog { background-color: {{surface.alt}}; }
QDialog#TillBusinessDayEntry QFrame[nexRole="card"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 8px; }
QDialog#TillBusinessDayEntry QFrame[nexRole="card"] QLabel { background: transparent; }
QDialog#TillBusinessDayEntry QLabel[nexRole="title"] { font-size: 20px; font-weight: bold; color: {{text}}; }
QDialog#TillBusinessDayEntry QLabel[nexRole="muted"] { color: {{text.muted}}; font-size: 12px; }
QDialog#TillBusinessDayEntry QLabel[nexRole="strong"] { font-weight: bold; color: {{text}}; }
QDialog#TillBusinessDayEntry QLabel[nexRole="cap"] { color: {{text.muted}}; font-size: 11px; }
QDialog#TillBusinessDayEntry QLabel[nexRole="code"] { color: {{text.muted}}; font-family: "DejaVu Sans Mono", "Consolas", monospace; font-size: 11px; }
QDialog#TillBusinessDayEntry QLabel[nexRole="formCap"] { color: {{primary}}; font-weight: bold; font-size: 12px; padding: 6px 0 5px 0; border: 0px solid {{border}}; border-bottom-width: 1px; }
QDialog#TillBusinessDayEntry QLabel[nexRole="pill"] { background: {{surface.alt}}; color: {{text.muted}}; font-size: 10px; font-weight: bold; padding: 3px 10px; border-radius: 9px; }
QDialog#TillBusinessDayEntry QLabel[nexRole="pill"][nexTone="info"] { background: {{info}}; color: {{on.primary}}; }
QDialog#TillBusinessDayEntry QLabel[nexRole="pill"][nexTone="success"],
QDialog#TillBusinessDayEntry QLabel[nexRole="pill"][nexTone="green"] { background: {{success}}; color: {{on.primary}}; }
QDialog#TillBusinessDayEntry QLabel[nexRole="pill"][nexTone="warning"],
QDialog#TillBusinessDayEntry QLabel[nexRole="pill"][nexTone="amber"] { background: #C2410C; color: {{on.primary}}; }
QDialog#TillBusinessDayEntry QLabel[nexRole="pill"][nexTone="danger"],
QDialog#TillBusinessDayEntry QLabel[nexRole="pill"][nexTone="red"] { background: {{danger}}; color: {{on.primary}}; }
QDialog#TillBusinessDayEntry QLabel[nexRole="pill"][nexTone="grey"] { background: #9CA3AF; color: {{on.primary}}; }
QDialog#TillBusinessDayEntry QFrame[nexRole="facts"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillBusinessDayEntry QFrame[nexRole="facts"] QLabel { background: transparent; border: none; }
QDialog#TillBusinessDayEntry QFrame[nexRole="facts"] QLabel[nexRole="factValue"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 3px; padding: 3px 8px; color: {{text}}; }
QDialog#TillBusinessDayEntry QFrame[nexRole="check"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillBusinessDayEntry QFrame[nexRole="check"][nexTone="amber"] { background: #FFF7ED; border-color: #FBD5B5; }
QDialog#TillBusinessDayEntry QFrame[nexRole="check"][nexTone="red"] { background: #FEF2F2; border-color: #FECACA; }
QDialog#TillBusinessDayEntry QFrame[nexRole="check"][nexTone="info"] { background: {{info.bg}}; border-color: #BFDBFE; }
QDialog#TillBusinessDayEntry QFrame[nexRole="check"][nexTone="grey"] { background: #F9FAFB; }
QDialog#TillBusinessDayEntry QFrame[nexRole="check"] QLabel { background: transparent; border: none; }
QDialog#TillBusinessDayEntry QFrame[nexRole="check"] QLabel[nexRole="pill"] { padding: 3px 4px; }
QDialog#TillBusinessDayEntry QPushButton[nexRole="checkAction"] { color: #C2410C; border: 1px solid #C2410C; background: {{surface}}; min-width: 130px; padding: 5px 12px; font-weight: bold; }
QDialog#TillBusinessDayEntry QFrame[nexTone="red"] QPushButton[nexRole="checkAction"] { color: {{danger}}; border-color: {{danger}}; }
QDialog#TillBusinessDayEntry QPushButton[nexRole="checkAction"]:disabled { color: #F2B78F; border-color: #FBD5B5; }
QDialog#TillBusinessDayEntry QFrame[nexRole="numbers"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillBusinessDayEntry QFrame[nexRole="numbers"] QLabel { background: transparent; border: none; }
QDialog#TillBusinessDayEntry QLabel[nexRole="numSection"] { color: {{primary}}; font-weight: bold; font-size: 11px; padding-top: 8px; }
QDialog#TillBusinessDayEntry QLabel[nexRole="numName"] { color: {{text.muted}}; }
QDialog#TillBusinessDayEntry QLabel[nexRole="numValue"] { color: {{text}}; font-weight: bold; }
QDialog#TillBusinessDayEntry QLabel[nexRole="numValue"][nexTone="danger"] { color: {{danger}}; }
QDialog#TillBusinessDayEntry QLabel[nexRole="numValue"][nexTone="success"] { color: {{success}}; }
QDialog#TillBusinessDayEntry QLabel[nexRole="numValue"][nexTone="warning"] { color: #C2410C; }
QDialog#TillBusinessDayEntry QFrame[nexRole="approval"] { background: #FFFBEB; border: 1px solid #F5D78E; border-radius: 6px; }
QDialog#TillBusinessDayEntry QFrame[nexRole="approval"][nexTone="success"] { background: #F0FDF4; border-color: #BBF7D0; }
QDialog#TillBusinessDayEntry QFrame[nexRole="approval"][nexTone="danger"] { background: #FEF2F2; border-color: #FECACA; }
QDialog#TillBusinessDayEntry QFrame[nexRole="approval"] QLabel { background: transparent; border: none; }
QDialog#TillBusinessDayEntry QPushButton[nexRole="warn"] { color: #C2410C; border: 1px solid #C2410C; background: {{surface}}; }
QDialog#TillBusinessDayEntry QPushButton[nexRole="warn"]:disabled { color: #F2B78F; border-color: #FBD5B5; }
QDialog#TillBusinessDayEntry QPushButton { min-width: 110px; padding: 6px 14px; font-weight: bold; }
QDialog#TillBusinessDayEntry QTabWidget#tabsMain::pane { border: none; border-top: 1px solid {{border}}; }
QDialog#TillBusinessDayEntry QTabWidget#tabsMain QTabBar::tab { padding: 6px 16px; border: none; background: transparent; color: {{text.muted}}; }
QDialog#TillBusinessDayEntry QTabWidget#tabsMain QTabBar::tab:selected { color: {{primary}}; font-weight: bold; border-bottom: 2px solid {{primary}}; }

/* TillSafeOffice — Cash Office (menu 287, till notes 118): the safe's
   balance, count, remittance to the bank. The Business Day block's look
   (mockup share/till/till_cash_office_ui_mockup.png). */
QDialog#TillSafeOffice,
QWidget QDialog#TillSafeOffice,
QDialog#TillSafeOffice QDialog { background-color: {{surface.alt}}; }
QDialog#TillSafeOffice QFrame[nexRole="card"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 8px; }
QDialog#TillSafeOffice QFrame[nexRole="card"] QLabel { background: transparent; }
QDialog#TillSafeOffice QLabel[nexRole="title"] { font-size: 20px; font-weight: bold; color: {{text}}; }
QDialog#TillSafeOffice QLabel[nexRole="muted"] { color: {{text.muted}}; font-size: 12px; }
QDialog#TillSafeOffice QLabel[nexRole="strong"] { font-weight: bold; color: {{text}}; }
QDialog#TillSafeOffice QLabel[nexRole="cap"] { color: {{text.muted}}; font-size: 11px; }
QDialog#TillSafeOffice QLabel[nexRole="code"] { color: {{text.muted}}; font-family: "DejaVu Sans Mono", "Consolas", monospace; font-size: 11px; }
QDialog#TillSafeOffice QLabel[nexRole="formCap"] { color: {{primary}}; font-weight: bold; font-size: 12px; padding: 6px 0 5px 0; border: 0px solid {{border}}; border-bottom-width: 1px; }
QDialog#TillSafeOffice QLabel[nexRole="pill"] { background: {{surface.alt}}; color: {{text.muted}}; font-size: 10px; font-weight: bold; padding: 3px 10px; border-radius: 9px; }
QDialog#TillSafeOffice QLabel[nexRole="pill"][nexTone="info"] { background: {{info}}; color: {{on.primary}}; }
QDialog#TillSafeOffice QLabel[nexRole="pill"][nexTone="success"],
QDialog#TillSafeOffice QLabel[nexRole="pill"][nexTone="green"] { background: {{success}}; color: {{on.primary}}; }
QDialog#TillSafeOffice QLabel[nexRole="pill"][nexTone="warning"],
QDialog#TillSafeOffice QLabel[nexRole="pill"][nexTone="amber"] { background: #C2410C; color: {{on.primary}}; }
QDialog#TillSafeOffice QLabel[nexRole="pill"][nexTone="danger"],
QDialog#TillSafeOffice QLabel[nexRole="pill"][nexTone="red"] { background: {{danger}}; color: {{on.primary}}; }
QDialog#TillSafeOffice QLabel[nexRole="pill"][nexTone="grey"] { background: #9CA3AF; color: {{on.primary}}; }
QDialog#TillSafeOffice QFrame[nexRole="facts"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillSafeOffice QFrame[nexRole="facts"] QLabel { background: transparent; border: none; }
QDialog#TillSafeOffice QFrame[nexRole="facts"] QLabel[nexRole="factValue"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 3px; padding: 3px 8px; color: {{text}}; }
QDialog#TillSafeOffice QFrame[nexRole="check"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillSafeOffice QFrame[nexRole="check"][nexTone="amber"] { background: #FFF7ED; border-color: #FBD5B5; }
QDialog#TillSafeOffice QFrame[nexRole="check"][nexTone="red"] { background: #FEF2F2; border-color: #FECACA; }
QDialog#TillSafeOffice QFrame[nexRole="check"][nexTone="info"] { background: {{info.bg}}; border-color: #BFDBFE; }
QDialog#TillSafeOffice QFrame[nexRole="check"][nexTone="grey"] { background: #F9FAFB; }
QDialog#TillSafeOffice QFrame[nexRole="check"] QLabel { background: transparent; border: none; }
QDialog#TillSafeOffice QFrame[nexRole="check"] QLabel[nexRole="pill"] { padding: 3px 4px; }
QDialog#TillSafeOffice QPushButton[nexRole="checkAction"] { color: #C2410C; border: 1px solid #C2410C; background: {{surface}}; min-width: 130px; padding: 5px 12px; font-weight: bold; }
QDialog#TillSafeOffice QFrame[nexTone="red"] QPushButton[nexRole="checkAction"] { color: {{danger}}; border-color: {{danger}}; }
QDialog#TillSafeOffice QPushButton[nexRole="checkAction"]:disabled { color: #F2B78F; border-color: #FBD5B5; }
QDialog#TillSafeOffice QFrame[nexRole="numbers"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillSafeOffice QFrame[nexRole="numbers"] QLabel { background: transparent; border: none; }
QDialog#TillSafeOffice QLabel[nexRole="numSection"] { color: {{primary}}; font-weight: bold; font-size: 11px; padding-top: 8px; }
QDialog#TillSafeOffice QLabel[nexRole="numName"] { color: {{text.muted}}; }
QDialog#TillSafeOffice QLabel[nexRole="numValue"] { color: {{text}}; font-weight: bold; }
QDialog#TillSafeOffice QLabel[nexRole="numValue"][nexTone="danger"] { color: {{danger}}; }
QDialog#TillSafeOffice QLabel[nexRole="numValue"][nexTone="success"] { color: {{success}}; }
QDialog#TillSafeOffice QLabel[nexRole="numValue"][nexTone="warning"] { color: #C2410C; }
QDialog#TillSafeOffice QFrame[nexRole="approval"] { background: #FFFBEB; border: 1px solid #F5D78E; border-radius: 6px; }
QDialog#TillSafeOffice QFrame[nexRole="approval"][nexTone="success"] { background: #F0FDF4; border-color: #BBF7D0; }
QDialog#TillSafeOffice QFrame[nexRole="approval"][nexTone="danger"] { background: #FEF2F2; border-color: #FECACA; }
QDialog#TillSafeOffice QFrame[nexRole="approval"] QLabel { background: transparent; border: none; }
QDialog#TillSafeOffice QPushButton[nexRole="warn"] { color: #C2410C; border: 1px solid #C2410C; background: {{surface}}; }
QDialog#TillSafeOffice QPushButton[nexRole="warn"]:disabled { color: #F2B78F; border-color: #FBD5B5; }
QDialog#TillSafeOffice QPushButton { min-width: 110px; padding: 6px 14px; font-weight: bold; }
QDialog#TillSafeOffice QTabWidget#tabsLeft::pane,
QDialog#TillSafeOffice QTabWidget#tabsRight::pane { border: none; border-top: 1px solid {{border}}; }
QDialog#TillSafeOffice QTabWidget#tabsLeft QTabBar::tab,
QDialog#TillSafeOffice QTabWidget#tabsRight QTabBar::tab { padding: 6px 16px; border: none; background: transparent; color: {{text.muted}}; }
QDialog#TillSafeOffice QTabWidget#tabsLeft QTabBar::tab:selected,
QDialog#TillSafeOffice QTabWidget#tabsRight QTabBar::tab:selected { color: {{primary}}; font-weight: bold; border-bottom: 2px solid {{primary}}; }
QDialog#TillSafeOffice QLabel[nexRole="strong"][nexTone="success"] { color: {{success}}; }
QDialog#TillSafeOffice QLabel[nexRole="strong"][nexTone="warning"] { color: #C2410C; }
QDialog#TillSafeOffice QLabel[nexRole="factValue"][nexTone="danger"] { color: {{danger}}; font-weight: bold; }

/* TillApprovalSetupEntry — Till Approval Setup (menu 276): rules (WHEN) and
   authority (WHO). Mockups share/till/till_approval_rules_ui_mockup.png and
   till_approval_authority_ui_mockup.png. */
QDialog#TillApprovalSetupEntry,
QWidget QDialog#TillApprovalSetupEntry,
QDialog#TillApprovalSetupEntry QDialog { background-color: {{surface.alt}}; }
QDialog#TillApprovalSetupEntry QLabel[nexRole="title"] { font-size: 22px; font-weight: bold; color: {{text}}; }
QDialog#TillApprovalSetupEntry QLabel[nexRole="muted"] { color: {{text.muted}}; font-size: 12px; }
QDialog#TillApprovalSetupEntry QLabel[nexRole="sectionCap"] { color: {{primary}}; font-weight: bold; font-size: 12px; }
QDialog#TillApprovalSetupEntry QLabel[nexRole="code"] { color: {{text.muted}}; font-family: "DejaVu Sans Mono", "Consolas", monospace; font-size: 11px; }
QDialog#TillApprovalSetupEntry QLabel[nexRole="pill"] { background: {{surface.alt}}; color: {{text.muted}}; font-size: 10px; font-weight: bold; padding: 2px 9px; border-radius: 9px; }
QDialog#TillApprovalSetupEntry QLabel[nexRole="pill"][nexTone="info"] { background: {{info.bg}}; color: {{info}}; }
QDialog#TillApprovalSetupEntry QLabel[nexRole="pill"][nexTone="branch"] { background: #EDE9FE; color: #6D28D9; }
QDialog#TillApprovalSetupEntry QLabel[nexRole="pill"][nexTone="warning"] { background: #C2410C; color: {{on.primary}}; }
QDialog#TillApprovalSetupEntry QFrame[nexRole="layer"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillApprovalSetupEntry QFrame[nexRole="layer"][nexTone="effective"] { border: 2px solid #7C3AED; background: #FAF5FF; }
QDialog#TillApprovalSetupEntry QFrame[nexRole="layer"] QLabel { background: transparent; border: none; }
QDialog#TillApprovalSetupEntry QLabel[nexRole="layerMark"] { color: #6D28D9; font-size: 10px; font-weight: bold; }
QDialog#TillApprovalSetupEntry QLabel#lblRuleWarn { background: {{warning.bg}}; color: {{warning}}; border: 1px solid #F5D78E; border-radius: 4px; padding: 7px 12px; }
QDialog#TillApprovalSetupEntry QFrame[nexRole="approval"] { background: #FFFBEB; border: 1px solid #F5D78E; border-radius: 6px; }
QDialog#TillApprovalSetupEntry QFrame[nexRole="approval"] QLabel { background: transparent; border: none; }
QDialog#TillApprovalSetupEntry QTableWidget { border: 1px solid #CBD0D7; gridline-color: #DCDFE4; background: {{surface}}; }
QDialog#TillApprovalSetupEntry QTabWidget#tabs::pane { background: {{surface}}; border: 1px solid {{border}}; border-radius: 6px; top: -1px; }
QDialog#TillApprovalSetupEntry QTabWidget#tabs > QWidget,
QDialog#TillApprovalSetupEntry QTabWidget#tabs QStackedWidget > QWidget { background: {{surface}}; }
QDialog#TillApprovalSetupEntry QTabWidget#tabs QTabBar::tab { padding: 8px 22px; margin-right: 4px; border: 1px solid {{border}}; border-bottom: none; border-top-left-radius: 6px; border-top-right-radius: 6px; background: {{surface.alt}}; color: {{text.muted}}; }
QDialog#TillApprovalSetupEntry QTabWidget#tabs QTabBar::tab:selected { background: {{surface}}; color: {{text}}; font-weight: bold; border-top: 3px solid {{primary}}; }
QDialog#TillApprovalSetupEntry QPushButton[nexRole="danger"] { color: {{danger}}; border: 1px solid {{danger}}; background: {{surface}}; }
QDialog#TillApprovalSetupEntry QPushButton[nexRole="danger"]:disabled { color: #E3A3A8; border-color: #F1C9CC; }

/* ExpenseVoucherEntry — Expense Voucher (ExpV, menu 277): lines vs tenders,
   GST bill panel, the server's validate shown as is. Mockup
   share/till/till_expense_voucher_ui_mockup.png. */
QDialog#ExpenseVoucherEntry,
QWidget QDialog#ExpenseVoucherEntry,
QDialog#ExpenseVoucherEntry QDialog { background-color: {{surface.alt}}; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="card"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 8px; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="card"] QLabel { background: transparent; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="title"] { font-size: 20px; font-weight: bold; color: {{text}}; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="muted"] { color: {{text.muted}}; font-size: 12px; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="strong"] { font-weight: bold; color: {{text}}; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="strong"][nexTone="success"] { color: {{success}}; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="strong"][nexTone="danger"] { color: {{danger}}; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="cap"] { color: {{text.muted}}; font-size: 12px; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="code"] { color: {{text.muted}}; font-family: "DejaVu Sans Mono", "Consolas", monospace; font-size: 11px; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="formCap"] { color: {{primary}}; font-weight: bold; font-size: 12px; padding: 6px 0 5px 0; border: 0px solid {{border}}; border-bottom-width: 1px; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="figure"] { font-size: 15px; font-weight: bold; color: {{text}}; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="figure"][nexTone="success"] { color: {{success}}; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="figure"][nexTone="danger"] { color: {{danger}}; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="pill"] { background: {{surface.alt}}; color: {{text.muted}}; font-size: 10px; font-weight: bold; padding: 3px 10px; border-radius: 9px; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="pill"][nexTone="warning"] { background: #FEF3C7; color: #B45309; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="pill"][nexTone="success"] { background: {{success.bg}}; color: {{success}}; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="pill"][nexTone="danger"] { background: {{danger.bg}}; color: {{danger}}; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="pill"][nexTone="info"] { background: {{info}}; color: {{on.primary}}; }
QDialog#ExpenseVoucherEntry QFrame#frameApproval QLabel[nexRole="pill"] { background: #C2410C; color: {{on.primary}}; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="strip"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="strip"] QLabel#lblMoneyDot { color: {{success}}; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="facts"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="facts"] QLabel[nexRole="factValue"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 3px; padding: 3px 8px; color: {{text.muted}}; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="gst"] { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="gst"] QLabel { background: transparent; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="balance"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="balance"][nexTone="success"] { background: #F0FDF4; border-color: #BBF7D0; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="balance"][nexTone="danger"] { background: #FEF2F2; border-color: #FECACA; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="info"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="approval"] { background: #FFFBEB; border: 1px solid #F5D78E; border-radius: 6px; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="approval"] QLabel#lblApprovalCode { color: #B45309; font-weight: bold; }
QDialog#ExpenseVoucherEntry QFrame[nexRole="approval"] QLabel#valApprovalAmount { color: #B45309; font-weight: bold; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="refusals"] { background: {{danger.bg}}; color: {{danger}}; border: 1px solid #FECACA; border-radius: 4px; padding: 7px 12px; }
QDialog#ExpenseVoucherEntry QLabel[nexRole="legSide"] { color: {{primary}}; font-family: "DejaVu Sans Mono", "Consolas", monospace; font-weight: bold; }
QDialog#ExpenseVoucherEntry QTableWidget { border: 1px solid #CBD0D7; gridline-color: #DCDFE4; background: {{surface}}; }
QDialog#ExpenseVoucherEntry QTableWidget QComboBox,
QDialog#ExpenseVoucherEntry QTableWidget QLineEdit,
QDialog#ExpenseVoucherEntry QTableWidget QDoubleSpinBox { margin: 2px 3px; }
QDialog#ExpenseVoucherEntry QPushButton[nexRole="danger"] { color: {{danger}}; border: 1px solid {{danger}}; background: {{surface}}; }
QDialog#ExpenseVoucherEntry QPushButton#btnSaveDraft,
QDialog#ExpenseVoucherEntry QPushButton#btnPost,
QDialog#ExpenseVoucherEntry QPushButton#btnNew { min-width: 120px; padding: 6px 16px; font-weight: bold; }

/* SettlementReconciliationEntry — Settlement Reconciliation (menu 278): payouts
   matched to tender rows, the exceptions, one TSet per payout. Mockups
   share/till/till_settlement_{match,exceptions,import}_ui_mockup.png. */
QDialog#SettlementReconciliationEntry,
QWidget QDialog#SettlementReconciliationEntry,
QDialog#SettlementReconciliationEntry QDialog { background-color: {{surface.alt}}; }
QDialog#SettlementReconciliationEntry QLabel[nexRole="title"] { font-size: 22px; font-weight: bold; color: {{text}}; }
QDialog#SettlementReconciliationEntry QLabel[nexRole="muted"] { color: {{text.muted}}; font-size: 12px; }
QDialog#SettlementReconciliationEntry QLabel[nexRole="sectionCap"] { color: {{primary}}; font-weight: bold; font-size: 12px; }
QDialog#SettlementReconciliationEntry QLabel[nexRole="code"] { color: {{text.muted}}; font-family: "DejaVu Sans Mono", "Consolas", monospace; font-size: 11px; }
QDialog#SettlementReconciliationEntry QLabel[nexRole="cap"] { color: {{text.muted}}; font-size: 11px; }
QDialog#SettlementReconciliationEntry QFrame[nexRole="facts"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#SettlementReconciliationEntry QFrame[nexRole="facts"] QLabel { background: transparent; border: none; font-weight: bold; }
QDialog#SettlementReconciliationEntry QFrame[nexRole="facts"] QLabel[nexRole="cap"],
QDialog#SettlementReconciliationEntry QFrame[nexRole="facts"] QLabel[nexRole="muted"] { font-weight: normal; }
QDialog#SettlementReconciliationEntry QFrame[nexRole="facts"] QLabel#valNet[nexTone="success"] { color: {{success}}; }
QDialog#SettlementReconciliationEntry QFrame[nexRole="panel"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#SettlementReconciliationEntry QFrame[nexRole="panel"] QLabel { background: transparent; border: none; }
QDialog#SettlementReconciliationEntry QFrame[nexRole="suggest"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#SettlementReconciliationEntry QFrame[nexRole="suggest"][nexTone="warning"] { background: #FFFBEB; border: 2px solid #F5D78E; }
QDialog#SettlementReconciliationEntry QFrame[nexRole="suggest"][nexTone="danger"] { background: #FEF2F2; border: 1px solid #FECACA; }
QDialog#SettlementReconciliationEntry QFrame[nexRole="suggest"] QLabel { background: transparent; border: none; }
QDialog#SettlementReconciliationEntry QLabel[nexRole="suggestCap"] { color: #B45309; font-weight: bold; }
QDialog#SettlementReconciliationEntry QLabel[nexRole="why"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 4px; padding: 6px 10px; color: {{success}}; }
QDialog#SettlementReconciliationEntry QPushButton[nexRole="chip"] { border: 1px solid {{border}}; border-radius: 12px; padding: 3px 12px; background: {{surface.alt}}; color: {{text.muted}}; min-width: 0px; }
QDialog#SettlementReconciliationEntry QPushButton[nexRole="chip"]:checked { background: {{primary.soft}}; color: {{primary}}; border-color: {{primary.soft.border}}; font-weight: bold; }
QDialog#SettlementReconciliationEntry QPushButton[nexRole="danger"] { color: {{danger}}; border: 1px solid {{danger}}; background: {{surface}}; }
QDialog#SettlementReconciliationEntry QPushButton[nexRole="danger"]:disabled { color: #E3A3A8; border-color: #F1C9CC; }
QDialog#SettlementReconciliationEntry QTableWidget { border: 1px solid #CBD0D7; gridline-color: #DCDFE4; background: {{surface}}; }
QDialog#SettlementReconciliationEntry QTabWidget#tabs::pane { background: {{surface}}; border: 1px solid {{border}}; border-radius: 6px; top: -1px; }
QDialog#SettlementReconciliationEntry QTabWidget#tabs > QWidget,
QDialog#SettlementReconciliationEntry QTabWidget#tabs QStackedWidget > QWidget { background: {{surface}}; }
QDialog#SettlementReconciliationEntry QTabWidget#tabs QTabBar::tab { padding: 8px 20px; margin-right: 4px; border: 1px solid {{border}}; border-bottom: none; border-top-left-radius: 6px; border-top-right-radius: 6px; background: {{surface.alt}}; color: {{text.muted}}; }
QDialog#SettlementReconciliationEntry QTabWidget#tabs QTabBar::tab:selected { background: {{surface}}; color: {{text}}; font-weight: bold; border-top: 3px solid {{primary}}; }

/* SettlementImportDialog / SettlementFormatDialog — the import and the column map. */
QDialog#SettlementImportDialog,
QDialog#SettlementFormatDialog { background-color: {{surface}}; }
QDialog#SettlementImportDialog QLabel[nexRole="dlgTitle"],
QDialog#SettlementFormatDialog QLabel[nexRole="dlgTitle"] { font-size: 18px; font-weight: bold; color: {{text}}; }
QDialog#SettlementImportDialog QLabel[nexRole="muted"],
QDialog#SettlementFormatDialog QLabel[nexRole="muted"] { color: {{text.muted}}; font-size: 12px; }
QDialog#SettlementImportDialog QLabel[nexRole="formCap"],
QDialog#SettlementFormatDialog QLabel[nexRole="formCap"] { color: {{primary}}; font-weight: bold; font-size: 12px; padding: 6px 0 5px 0; border: 0px solid {{border}}; border-bottom-width: 1px; }
QDialog#SettlementImportDialog QFrame[nexRole="facts"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#SettlementImportDialog QFrame[nexRole="facts"] QLabel { background: transparent; border: none; font-weight: bold; }
QDialog#SettlementImportDialog QFrame[nexRole="facts"] QLabel[nexRole="cap"] { color: {{text.muted}}; font-size: 11px; font-weight: normal; }
QDialog#SettlementFormatDialog QLabel[nexRole="problems"] { color: {{danger}}; }
QDialog#SettlementFormatDialog QTableWidget { border: 1px solid #CBD0D7; gridline-color: #DCDFE4; background: {{surface}}; }

/* TillSlipCheckDialog — Slip check (from the Session Cockpit): a card
   terminal's rows ticked against the paper slips. Mockup
   share/till/till_slip_check_ui_mockup.png. */
QDialog#TillSlipCheckDialog,
QWidget QDialog#TillSlipCheckDialog,
QDialog#TillSlipCheckDialog QDialog { background-color: {{surface.alt}}; }
QDialog#TillSlipCheckDialog QLabel[nexRole="title"] { font-size: 20px; font-weight: bold; color: {{text}}; }
QDialog#TillSlipCheckDialog QLabel[nexRole="muted"] { color: {{text.muted}}; font-size: 12px; }
QDialog#TillSlipCheckDialog QLabel[nexRole="strong"] { font-weight: bold; color: {{text}}; }
QDialog#TillSlipCheckDialog QLabel[nexRole="cap"] { color: {{text.muted}}; font-size: 11px; }
QDialog#TillSlipCheckDialog QFrame[nexRole="facts"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillSlipCheckDialog QFrame[nexRole="facts"] QLabel { background: transparent; border: none; }
QDialog#TillSlipCheckDialog QFrame[nexRole="facts"] QLabel[nexRole="factValue"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 3px; padding: 3px 8px; color: {{text}}; }
QDialog#TillSlipCheckDialog QFrame[nexRole="facts"] QLabel[nexRole="factValue"][nexTone="danger"] { border: 2px solid {{danger}}; color: {{danger}}; font-weight: bold; }
QDialog#TillSlipCheckDialog QFrame[nexRole="facts"] QLabel[nexRole="code"] { background: {{surface.alt}}; border: 1px solid {{border}}; border-radius: 3px; padding: 3px 8px; color: {{text.muted}}; font-family: "DejaVu Sans Mono", "Consolas", monospace; font-size: 11px; }
QDialog#TillSlipCheckDialog QFrame[nexRole="panel"] { background: #F8FAFC; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillSlipCheckDialog QFrame[nexRole="panel"] QLabel { background: transparent; border: none; }
QDialog#TillSlipCheckDialog QFrame[nexRole="panel"] QLabel[nexTone="danger"] { color: {{danger}}; }
QDialog#TillSlipCheckDialog QFrame[nexRole="approval"] { background: #FFFBEB; border: 1px solid #F5D78E; border-radius: 6px; }
QDialog#TillSlipCheckDialog QFrame[nexRole="approval"] QLabel { background: transparent; border: none; }
QDialog#TillSlipCheckDialog QFrame[nexRole="approval"] QLabel[nexRole="pill"] { background: #C2410C; color: {{on.primary}}; font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 9px; }
QDialog#TillSlipCheckDialog QFrame[nexRole="approval"] QLabel#lblApprovalCode { color: {{warning}}; font-weight: bold; font-family: "DejaVu Sans Mono", "Consolas", monospace; }
QDialog#TillSlipCheckDialog QFrame[nexRole="approval"] QLabel#valApprovalAmount { color: #C2410C; font-weight: bold; }
QDialog#TillSlipCheckDialog QFrame[nexRole="approval"] QLabel[nexRole="muted"] { color: #92400E; font-size: 11px; }
QDialog#TillSlipCheckDialog QTableWidget { border: 1px solid #CBD0D7; gridline-color: #DCDFE4; background: {{surface}}; }
QDialog#TillSlipCheckDialog QHeaderView::section { background: #E2E5EA; color: {{text}}; font-weight: bold; border: none; border-right: 1px solid #CBD0D7; border-bottom: 1px solid #CBD0D7; padding: 5px 8px; }
QDialog#TillSlipCheckDialog QPushButton { min-width: 110px; padding: 6px 14px; font-weight: bold; }
QDialog#TillSlipCheckDialog QPushButton#btnAddSlip,
QDialog#TillSlipCheckDialog QPushButton#btnRemoveSlip { min-width: 80px; font-weight: normal; }

/* ── Part C: shared widgets (sweep step 2) ──────────────────────────────
   Every rule here used to be a setStyleSheet() call on the widget. Each
   selector carries an id, role or tone so it out-ranks Part A's generic
   rules (QPushButton:focus, QLineEdit:focus, ...) the way the widget-level
   sheet used to. */

/* AppMessage — one look per tone (accent, tint, accent darker(115)) */
AppMessage#appMessage QLabel#msgTitle { color: #1a1a2e; font-size: 15px; font-weight: bold; }
AppMessage#appMessage QLabel#msgText { color: #4a4a6a; }
AppMessage#appMessage QLabel#msgDetail { color: #8a8aa8; font-size: 11px; }

AppMessage#appMessage[nexTone="critical"] { background-color: #fff5f5; border: 2px solid #e53935; border-radius: 12px; }
AppMessage#appMessage[nexTone="critical"] QLabel#msgIcon { background-color: #e53935; color: #ffffff; border-radius: 20px; font-size: 20px; font-weight: bold; }
AppMessage#appMessage[nexTone="critical"] QLabel#msgDivider { background-color: #e53935; }
AppMessage#appMessage[nexTone="critical"] QComboBox#msgPreset,
AppMessage#appMessage[nexTone="critical"] QLineEdit#msgInput { background-color: #ffffff; color: #1a1a2e; border: 2px solid #e53935; border-radius: 6px; padding: 6px 8px; font-size: 13px; }
AppMessage#appMessage[nexTone="critical"] QLineEdit#msgInput:read-only { background-color: #f1f1f5; color: #4a4a6a; }
AppMessage#appMessage[nexTone="critical"] QPushButton { background-color: #ffffff; color: #e53935; border: 2px solid #e53935; border-radius: 6px; font-size: 13px; font-weight: bold; }
AppMessage#appMessage[nexTone="critical"] QPushButton:hover { background-color: #f5f5f5; }
AppMessage#appMessage[nexTone="critical"] QPushButton:pressed { background-color: #c7322e; color: #ffffff; }
AppMessage#appMessage[nexTone="critical"] QPushButton:focus { background-color: #e53935; color: #ffffff; }

AppMessage#appMessage[nexTone="warning"] { background-color: #fffbeb; border: 2px solid #f59e0b; border-radius: 12px; }
AppMessage#appMessage[nexTone="warning"] QLabel#msgIcon { background-color: #f59e0b; color: #ffffff; border-radius: 20px; font-size: 20px; font-weight: bold; }
AppMessage#appMessage[nexTone="warning"] QLabel#msgDivider { background-color: #f59e0b; }
AppMessage#appMessage[nexTone="warning"] QComboBox#msgPreset,
AppMessage#appMessage[nexTone="warning"] QLineEdit#msgInput { background-color: #ffffff; color: #1a1a2e; border: 2px solid #f59e0b; border-radius: 6px; padding: 6px 8px; font-size: 13px; }
AppMessage#appMessage[nexTone="warning"] QLineEdit#msgInput:read-only { background-color: #f1f1f5; color: #4a4a6a; }
AppMessage#appMessage[nexTone="warning"] QPushButton { background-color: #ffffff; color: #f59e0b; border: 2px solid #f59e0b; border-radius: 6px; font-size: 13px; font-weight: bold; }
AppMessage#appMessage[nexTone="warning"] QPushButton:hover { background-color: #f5f5f5; }
AppMessage#appMessage[nexTone="warning"] QPushButton:pressed { background-color: #d5890a; color: #ffffff; }
AppMessage#appMessage[nexTone="warning"] QPushButton:focus { background-color: #f59e0b; color: #ffffff; }

AppMessage#appMessage[nexTone="info"] { background-color: #eff6ff; border: 2px solid #3b82f6; border-radius: 12px; }
AppMessage#appMessage[nexTone="info"] QLabel#msgIcon { background-color: #3b82f6; color: #ffffff; border-radius: 20px; font-size: 20px; font-weight: bold; }
AppMessage#appMessage[nexTone="info"] QLabel#msgDivider { background-color: #3b82f6; }
AppMessage#appMessage[nexTone="info"] QComboBox#msgPreset,
AppMessage#appMessage[nexTone="info"] QLineEdit#msgInput { background-color: #ffffff; color: #1a1a2e; border: 2px solid #3b82f6; border-radius: 6px; padding: 6px 8px; font-size: 13px; }
AppMessage#appMessage[nexTone="info"] QLineEdit#msgInput:read-only { background-color: #f1f1f5; color: #4a4a6a; }
AppMessage#appMessage[nexTone="info"] QPushButton { background-color: #ffffff; color: #3b82f6; border: 2px solid #3b82f6; border-radius: 6px; font-size: 13px; font-weight: bold; }
AppMessage#appMessage[nexTone="info"] QPushButton:hover { background-color: #f5f5f5; }
AppMessage#appMessage[nexTone="info"] QPushButton:pressed { background-color: #3371d6; color: #ffffff; }
AppMessage#appMessage[nexTone="info"] QPushButton:focus { background-color: #3b82f6; color: #ffffff; }

AppMessage#appMessage[nexTone="confirm"] { background-color: #f5f3ff; border: 2px solid #8b5cf6; border-radius: 12px; }
AppMessage#appMessage[nexTone="confirm"] QLabel#msgIcon { background-color: #8b5cf6; color: #ffffff; border-radius: 20px; font-size: 20px; font-weight: bold; }
AppMessage#appMessage[nexTone="confirm"] QLabel#msgDivider { background-color: #8b5cf6; }
AppMessage#appMessage[nexTone="confirm"] QComboBox#msgPreset,
AppMessage#appMessage[nexTone="confirm"] QLineEdit#msgInput { background-color: #ffffff; color: #1a1a2e; border: 2px solid #8b5cf6; border-radius: 6px; padding: 6px 8px; font-size: 13px; }
AppMessage#appMessage[nexTone="confirm"] QLineEdit#msgInput:read-only { background-color: #f1f1f5; color: #4a4a6a; }
AppMessage#appMessage[nexTone="confirm"] QPushButton { background-color: #ffffff; color: #8b5cf6; border: 2px solid #8b5cf6; border-radius: 6px; font-size: 13px; font-weight: bold; }
AppMessage#appMessage[nexTone="confirm"] QPushButton:hover { background-color: #f5f5f5; }
AppMessage#appMessage[nexTone="confirm"] QPushButton:pressed { background-color: #7950d6; color: #ffffff; }
AppMessage#appMessage[nexTone="confirm"] QPushButton:focus { background-color: #8b5cf6; color: #ffffff; }

/* Status badges (NexWarningStrip; TxnBadgePalette buckets, its computed colours) */
QLabel[nexRole="badgePill"][nexBadge="neutral"] { background: #ececec; color: #565656; border-radius: 7px; padding: 1px 8px; font-weight: 600; font-size: 10px; }
QLabel[nexRole="badgeText"][nexBadge="neutral"] { color: #565656; font-weight: 600; }
QLabel[nexRole="badgeHead"][nexBadge="neutral"] { background: #ececec; color: #565656; border-radius: 6px; padding: 6px 10px; font-weight: 600; }
QLabel[nexRole="badgePill"][nexBadge="progress"] { background: #e5ecf3; color: #20528c; border-radius: 7px; padding: 1px 8px; font-weight: 600; font-size: 10px; }
QLabel[nexRole="badgeText"][nexBadge="progress"] { color: #20528c; font-weight: 600; }
QLabel[nexRole="badgeHead"][nexBadge="progress"] { background: #e5ecf3; color: #20528c; border-radius: 6px; padding: 6px 10px; font-weight: 600; }
QLabel[nexRole="badgePill"][nexBadge="success"] { background: #e5f3ea; color: #208c48; border-radius: 7px; padding: 1px 8px; font-weight: 600; font-size: 10px; }
QLabel[nexRole="badgeText"][nexBadge="success"] { color: #208c48; font-weight: 600; }
QLabel[nexRole="badgeHead"][nexBadge="success"] { background: #e5f3ea; color: #208c48; border-radius: 6px; padding: 6px 10px; font-weight: 600; }
QLabel[nexRole="badgePill"][nexBadge="warning"] { background: #f3eee5; color: #8c6420; border-radius: 7px; padding: 1px 8px; font-weight: 600; font-size: 10px; }
QLabel[nexRole="badgeText"][nexBadge="warning"] { color: #8c6420; font-weight: 600; }
QLabel[nexRole="badgeHead"][nexBadge="warning"] { background: #f3eee5; color: #8c6420; border-radius: 6px; padding: 6px 10px; font-weight: 600; }
QLabel[nexRole="badgePill"][nexBadge="danger"] { background: #f3e6e5; color: #8c2420; border-radius: 7px; padding: 1px 8px; font-weight: 600; font-size: 10px; }
QLabel[nexRole="badgeText"][nexBadge="danger"] { color: #8c2420; font-weight: 600; }
QLabel[nexRole="badgeHead"][nexBadge="danger"] { background: #f3e6e5; color: #8c2420; border-radius: 6px; padding: 6px 10px; font-weight: 600; }
QLabel[nexRole="badgePill"][nexBadge="locked"] { background: #e9ebef; color: #424f6a; border-radius: 7px; padding: 1px 8px; font-weight: 600; font-size: 10px; }
QLabel[nexRole="badgeText"][nexBadge="locked"] { color: #424f6a; font-weight: 600; }
QLabel[nexRole="badgeHead"][nexBadge="locked"] { background: #e9ebef; color: #424f6a; border-radius: 6px; padding: 6px 10px; font-weight: 600; }
QLabel[nexRole="noteCode"] { font-family: monospace; font-size: 10px; }
QLabel[nexRole="noteHint"] { color: #6B7280; font-size: 10px; }

/* Captions and hints (master lists, transaction lists) */
QLabel[nexRole="caption"] { font-weight: 600; }
QLabel[nexRole="hintBar"] { color: #666; padding: 2px 4px; }
QFrame[nexRole="toolbarRule"] { color: #e0e0e8; }

/* Pager buttons (NexCrudMasterPage); the current page is nexTone="active" */
QPushButton[nexRole="pager"] {
    background: #fff; color: #444; padding: 0px;
    border: 1px solid #e0e0e8; border-radius: 5px;
    font-size: 13px;
    padding: 0; margin: 0;
    min-width: 32px; max-width: 32px; min-height: 32px; max-height: 32px;
}
QPushButton[nexRole="pager"]:hover { background: #f5f5fa; border-color: #8b1a1a; color: #8b1a1a; }
QPushButton[nexRole="pager"][nexTone="active"],
QPushButton[nexRole="pager"][nexTone="active"]:hover {
    background: #8b1a1a; color: #fff;
    border: 1px solid #8b1a1a; border-radius: 5px;
    font-size: 13px; font-weight: 700;
}

/* Multi-select dropdown: the token frame and its chips */
QFrame#nexTokenFrame { border: 1px solid #E5E7EB; background: #FFFFFF; }
QFrame#nexTokenFrame QLineEdit { border: none; background: transparent; }
QFrame#nexChip { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; }
QFrame#nexChip QLabel { background: transparent; color: #1E3A8A; }
QFrame#nexChip QPushButton { border: none; background: transparent; padding: 0px; color: #1E3A8A; font-weight: bold; }
QFrame#nexChip QPushButton:hover { color: {{primary}}; }

/* Dropdown's arrow button */
QToolButton#nexDropButton {
    width: 28px;
    border: none;
    border-left: 1px solid #E5E7EB;
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
    background-color: transparent;
    padding: 0px;
}
QToolButton#nexDropButton:hover { background-color: #F8FAFC; }
QToolButton#nexDropButton:pressed { background-color: #F1F5F9; }

/* Grid header right-click menu (NexTable) */
QMenu#nexHeaderMenu::item { padding: 5px; border-left: 0px solid #dfdfdf; }
QMenu#nexHeaderMenu::item:selected { border: 1px solid white; }

/* Popup picker window */
NexPopupWindow { border: 1px solid gray; }
NexPopupWindow QLineEdit#popupSearch { border: 1px solid black; padding: 1px; }

/* CRUD form section heading + rule */
QLabel#sectionHeading { color: #2563EB; font-weight: bold; letter-spacing: 0.3px; }
QFrame#sectionRule { color: #E5E7EB; }

/* Fetch line-edit and combo clear buttons */
QToolButton#fetchButton { border: none; background: transparent; padding: 0px; color: black; }
QToolButton#fetchButton:hover { color: #991B1E; }
QToolButton#fetchButton:pressed { color: #5F0D0F; }
QToolButton#fetchButton:disabled { color: #CBD5E1; }
QToolButton#comboClear { border: none; background: transparent; color: #94A3B8; font-size: 11px; font-weight: bold; }
QToolButton#comboClear:hover { color: {{primary}}; }
QToolButton#comboClear:pressed { color: #5F0D0F; }

/* Image field */
QLabel#imgThumb { border: 1px solid #E5E7EB; border-radius: 4px; background: #FFFFFF; }
QLabel#lblImageHint { color: #6B7280; }

/* Transport band (title / hint, by state) */
QLabel#bandTitle { font-weight: bold; color: #444; }
QLabel#bandTitle[nexTone="danger"] { color: #c01c28; }
QLabel#bandHint { color: #666; font-size: 11px; }
QLabel#bandHint[nexTone="info"] { color: #1a5fb4; }
QLabel#bandHint[nexTone="danger"] { color: #c01c28; font-weight: bold; }

/* Party adjustment panel */
QLabel#adjustHeading { font-weight: bold; }
QLabel#adjustTotal { font: 12pt; padding: 2px 6px; font-weight: bold; color: white; border-radius: 3px; background: #8E24AA; }
QLabel#adjustHint { color: #616161; }

/* Shipping dialog (was its .ui sheet) + its state strip */
QDialog#TxnShippingDialog[nexRole="shipping"] { background-color: #FBF2F2; }
QDialog#TxnShippingDialog[nexRole="shipping"] QGroupBox { border: 1px solid #E5D5D5; border-radius: 8px; margin-top: 10px; padding: 8px 6px 6px 6px; }
QDialog#TxnShippingDialog[nexRole="shipping"] QGroupBox::title { subcontrol-origin: margin; subcontrol-position: top left; left: 10px; padding: 0 4px; color: #2563EB; font-weight: bold; }
QDialog#TxnShippingDialog[nexRole="shipping"] QLineEdit[readOnly="true"] { background: #F3F4F6; color: #374151; }
QDialog#TxnShippingDialog[nexRole="shipping"] QLabel#lblFromNote { color: #6B7280; font-size: 11px; }
QLabel#lblState[nexTone="required"] { background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; border-radius: 4px; padding: 4px 8px; font-weight: bold; }
QLabel#lblState[nexTone="declared"] { background: #DBEAFE; color: #1E40AF; border: 1px solid #93C5FD; border-radius: 4px; padding: 4px 8px; }
QLabel#lblState[nexTone="posted"]   { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; border-radius: 4px; padding: 4px 8px; }
QLabel#lblState[nexTone="readonly"] { background: #F3F4F6; color: #374151; border: 1px solid #D1D5DB; border-radius: 4px; padding: 4px 8px; }

/* Login window (was its .ui sheet), scoped by its id */
QWidget#LoginWindow { background: #f4f8ff; font-family: "Noto Sans", "Segoe UI", Arial; color: #0f172a; }
QWidget#LoginWindow QFrame#loginCard { background: #ffffff; border: 1px solid #dce5f2; border-radius: 16px; }
QWidget#LoginWindow QLabel#lblWelcome { font-size: 20px; font-weight: 800; color: #101828; }
QWidget#LoginWindow QLabel#lblSubTitle { font-size: 11px; color: #667085; }
QWidget#LoginWindow QLabel.formLabel { font-size: 10px; font-weight: 700; color: #111827; }
QWidget#LoginWindow QFrame.inputBox { background: #ffffff; border: 1px solid #d5deea; border-radius: 6px; }
QWidget#LoginWindow QFrame.inputBox:focus-within { border: 1px solid #2563eb; }
QWidget#LoginWindow QLineEdit { border: none; background: transparent; font-size: 12px; color: #111827; padding: 0px; }
QWidget#LoginWindow QLineEdit::placeholder { color: #8b96a8; }
QWidget#LoginWindow QPushButton#btnLogin { background: #1f67e8; color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: 800; }
QWidget#LoginWindow QPushButton#btnLogin:hover { background: #185bd4; }
QWidget#LoginWindow QPushButton#btnLogin:pressed { background: #164eb7; }
QWidget#LoginWindow QFrame#dateCard { background: #f1f6ff; border: none; border-radius: 8px; }
QWidget#LoginWindow QLabel#lblDate { font-size: 13px; font-weight: 800; color: #111827; }
QWidget#LoginWindow QLabel#lblTime { font-size: 23px; font-weight: 900; color: #07377f; }
QWidget#LoginWindow QLabel#lblAmPm { font-size: 13px; font-weight: 800; color: #1f67e8; }
QWidget#LoginWindow QLabel#lblProductive { font-size: 10px; color: #717b8c; }

/* TxnHistoryDialog (shared, src/shared/ui/txn/txn_history_dialog.cpp) — one document's
   status trail; opened by History / Ctrl+H on every transaction list and entry screen */
QDialog#TxnHistoryDialog,
QWidget QDialog#TxnHistoryDialog { background-color: #FFFFFF; }
QDialog#TxnHistoryDialog QLabel#lblHistoryTitle { font-size: 18px; font-weight: bold; color: #111827; }
QDialog#TxnHistoryDialog QLabel#lblHistorySubtitle { color: #6B7280; font-size: 12px; }
QDialog#TxnHistoryDialog QFrame#lineHistoryTitle { border: none; border-top: 1px solid #E5E7EB; max-height: 1px; }
QDialog#TxnHistoryDialog QLabel#lblHistorySummary { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 12px; color: #374151; font-size: 12px; }
QDialog#TxnHistoryDialog QLabel#lblHistoryEmpty { color: #6B7280; font-size: 13px; }

/* LoyaltyStatusEntry (menu 79, src/modules/sales/report/loyalty_status) — the Loyalty
   Status report, to share/loyalty/loyalty_status_ui_mockup_*.png. v17 = v16 + this block. */
QDialog#LoyaltyStatusEntry,
QWidget QDialog#LoyaltyStatusEntry,
QDialog#LoyaltyStatusEntry QDialog { background-color: #FFFFFF; }
QDialog#LoyaltyStatusEntry QLabel#lblFormTitle { font-size: 20px; font-weight: bold; color: #111827; }
QDialog#LoyaltyStatusEntry QLabel#lblSubtitle { color: #6B7280; font-size: 12px; }
QDialog#LoyaltyStatusEntry QLabel#lblStatisticalPill { background: #E8EEFC; color: #1D4ED8; font-weight: 600; font-size: 11px; padding: 3px 12px; border-radius: 10px; }
QDialog#LoyaltyStatusEntry Line#lineTitle,
QDialog#LoyaltyStatusEntry Line#lineTitle * { color: #E5E7EB; }
QDialog#LoyaltyStatusEntry QFrame[filterStrip="true"] { background: #FAFAFB; border: 1px solid #E5E7EB; border-radius: 6px; }
QDialog#LoyaltyStatusEntry QFrame[filterStrip="true"] QLabel { background: transparent; }
QDialog#LoyaltyStatusEntry QFrame[filterBar="true"] { background: #FAFAFB; border: 1px solid #E5E7EB; border-radius: 6px; }
QDialog#LoyaltyStatusEntry QFrame[filterBar="true"] QLabel { background: transparent; }
QDialog#LoyaltyStatusEntry QLabel[filterSummary="true"] { color: #111827; font-weight: 600; padding-left: 6px; }
QDialog#LoyaltyStatusEntry QLabel[cap="true"] { color: #6B7280; }
QDialog#LoyaltyStatusEntry QLabel[note="true"] { color: #6B7280; font-size: 11px; }
QDialog#LoyaltyStatusEntry QFrame[tile="true"] { background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; }
QDialog#LoyaltyStatusEntry QFrame[tile="true"] QLabel { background: transparent; border: none; }
QDialog#LoyaltyStatusEntry QLabel[figureCaption="true"] { color: #6B7280; font-size: 11px; }
QDialog#LoyaltyStatusEntry QLabel[figureValue="true"] { color: #111827; font-size: 17px; font-weight: bold; }
QDialog#LoyaltyStatusEntry QLabel[figureCount="true"] { color: #6B7280; font-size: 11px; }
QDialog#LoyaltyStatusEntry QLabel#tileOutstandingValue,
QDialog#LoyaltyStatusEntry QLabel#tileExpValueValue { color: {{primary}}; }
QDialog#LoyaltyStatusEntry QLabel#tileEarnedValue { color: #15803D; }
QDialog#LoyaltyStatusEntry QLabel#tileRedeemedValue { color: #1D4ED8; }
QDialog#LoyaltyStatusEntry QLabel#tileEligibleValue { color: #0F766E; }
QDialog#LoyaltyStatusEntry QLabel#tileExpiringValue,
QDialog#LoyaltyStatusEntry QLabel#tileExp2Value { color: #B45309; }
QDialog#LoyaltyStatusEntry QLabel#tileExp1Value { color: #B91C1C; }
QDialog#LoyaltyStatusEntry QLabel[sectionHeading="true"] { color: {{primary}}; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; }
QDialog#LoyaltyStatusEntry QFrame[card="true"] { background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; }
QDialog#LoyaltyStatusEntry QFrame[card="true"] QLabel { background: transparent; border: none; }
QDialog#LoyaltyStatusEntry QLabel[cardTitle="true"] { color: {{primary}}; font-size: 11px; font-weight: bold; }
QDialog#LoyaltyStatusEntry QLabel[factValue="true"] { color: #111827; font-weight: 600; }
QDialog#LoyaltyStatusEntry QLabel#lblFactStatus[nexTone="good"] { color: #15803D; font-weight: bold; }
QDialog#LoyaltyStatusEntry QLabel#lblFactStatus[nexTone="warning"] { color: #B45309; font-weight: bold; }
QDialog#LoyaltyStatusEntry QLabel#lblGiftNow[nexTone="good"] { color: #0F766E; font-weight: 600; }
QDialog#LoyaltyStatusEntry QLabel#lblUnlotted[nexTone="warning"] { background: #FDF3E3; color: #B45309; padding: 4px 8px; border-radius: 4px; }
QDialog#LoyaltyStatusEntry QLabel#lblMonthlyTotals { font-weight: 600; color: #111827; }
QDialog#LoyaltyStatusEntry QSplitter::handle { background: transparent; }
QDialog#LoyaltyStatusEntry QFrame#frameButtons { background: #F8FAFC; border-top: 1px solid #E5E7EB; }

/* TillCashPositionEntry — Cash Position (S11, till notes 134): the tiles and
   the flags band under the store grid (mockup
   share/till/till_ho_cash_position_rev2_ui_mockup.png). */
QDialog#TillCashPositionEntry QFrame[nexRole="facts"] { background: #F9FAFB; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#TillCashPositionEntry QFrame[nexRole="facts"] QLabel { background: transparent; border: none; }
QDialog#TillCashPositionEntry QFrame[nexRole="facts"] QLabel[nexRole="cap"] { color: {{text.muted}}; font-size: 10px; font-weight: bold; }
QDialog#TillCashPositionEntry QFrame[nexRole="facts"] QLabel[nexRole="factValue"] { color: {{text}}; font-size: 15px; font-weight: bold; }
QDialog#TillCashPositionEntry QFrame[nexRole="facts"] QLabel[nexRole="factValue"][nexTone="danger"] { color: {{danger}}; }
QDialog#TillCashPositionEntry QFrame[nexRole="facts"] QLabel[nexRole="factValue"][nexTone="warning"] { color: #C2410C; }
QDialog#TillCashPositionEntry QFrame[nexRole="facts"] QLabel[nexRole="factValue"][nexTone="success"] { color: {{success}}; }
QDialog#TillCashPositionEntry QLabel[nexRole="refusals"] { background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 6px; padding: 6px 10px; color: {{text}}; }
QDialog#TillCashPositionEntry QLabel[nexRole="sectionCap"] { color: {{primary}}; font-weight: bold; font-size: 11px; }

/* GodownTransferEntry v36 (2026-10-26): godown_transfer_entry.ui — the Sept mockup + 3.0 Loading / Unloading */
QDialog#GodownTransferEntry,
QWidget QDialog#GodownTransferEntry,
QDialog#GodownTransferEntry QDialog { background-color: #FFFFFF; }
QDialog#GodownTransferEntry QLabel[cap="true"] { color:#6B7280; }
QDialog#GodownTransferEntry QFrame[card="true"] { background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; }
QDialog#GodownTransferEntry QLabel[cardTitle="true"] { color:#7B1113; font-weight:bold; }
QDialog#GodownTransferEntry QLabel#lblFormTitle { font-size:20px; font-weight:bold; color:#111827; }
QDialog#GodownTransferEntry QLabel#lblScope { color:#6B7280; font-size:12px; }
QDialog#GodownTransferEntry QLabel#lblAudit { color:#6B7280; font-size:11px; }
QDialog#GodownTransferEntry QLineEdit#txtVoucherNo,
QDialog#GodownTransferEntry QLineEdit#txtVoucherNo * { background:#F3F4F6; color:#6B7280; }
QDialog#GodownTransferEntry QLabel#lblShapeNote { background:#E8EEFC; color:#1D4ED8; padding:8px 14px; border-radius:4px; }
QDialog#GodownTransferEntry QLabel#lblLinesHint { color:#6B7280; }
QDialog#GodownTransferEntry QLabel#lblCostNote { color:#7B1113; font-size:11px; }
QDialog#GodownTransferEntry QLabel#lblTotalValue { font-size:16px; font-weight:bold; color:#111827; }
QDialog#GodownTransferEntry QLabel#lblLines,
QDialog#GodownTransferEntry QLabel#lblTotalQty,
QDialog#GodownTransferEntry QLabel#lblCharges { font-weight:bold; color:#111827; }
QDialog#GodownTransferEntry QLabel#lblTotalsNote { color:#6B7280; font-family:monospace; font-size:11px; }
QDialog#GodownTransferEntry QGroupBox { background:#FFFFFF; border:1px solid #E5E7EB; border-radius:6px; margin-top:14px; padding-top:8px; font-weight:600; color:#374151; }
QDialog#GodownTransferEntry QGroupBox::title { subcontrol-origin: margin; left:10px; padding:0 4px; color:#7B1113; }
QDialog#GodownTransferEntry QGroupBox QLabel { font-weight:normal; }
QDialog#GodownTransferEntry QLineEdit#txtLoadCharge,
QDialog#GodownTransferEntry QLineEdit#txtUnloadCharge { background:#F3F4F6; color:#111827; font-weight:bold; }
QDialog#GodownTransferEntry QLabel#lblHandlingNote { color:#9CA3AF; font-style:italic; font-size:11px; }
QDialog#GodownTransferEntry QLabel#lblCancelNote { color:#6B7280; }
QDialog#GodownTransferEntry QLabel#lblValidation { background:#FDECEC; color:#B42318; padding:8px 14px; border-radius:4px; font-weight:600; }
QDialog#GodownTransferEntry QLabel#lblHint { color:#8b1a1a; }
QDialog#GodownTransferEntry QFrame#frameButtons { background:#F8FAFC; border-top:1px solid #E5E7EB; }
QDialog#GodownTransferEntry QFrame#frameGodown[nexTone="missing"] NexDropdownSingle,
QDialog#GodownTransferEntry QFrame#frameToGodown[nexTone="missing"] NexDropdownSingle { border:1px solid #F87171; border-radius:4px; }
QDialog#GodownTransferEntry QLabel#lblStatus[nexTone="posted"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #15803D; background: #E8F5EA; }
QDialog#GodownTransferEntry QLabel#lblStatus[nexTone="cancelled"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #B42318; background: #FDE8E8; }
QDialog#GodownTransferEntry QLabel#lblStatus[nexTone="draft"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #B45309; background: #FEF3E2; }

/* v37 (2026-10-26): Branch Outward (GodownTransferEntry in branch mode) — the IN TRANSIT pill + the transit panel */
QDialog#GodownTransferEntry QLabel#lblStatus[nexTone="transit"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #1D4ED8; background: #E8EEFC; }
QDialog#GodownTransferEntry QFrame#frameToBranch[nexTone="missing"] NexDropdownSingle { border:1px solid #F87171; border-radius:4px; }

/* BranchInwardEntry v37 (2026-10-26): branch_inward_entry.ui — "Transfer In — receive" + 3.0 Unloading */
QDialog#BranchInwardEntry,
QWidget QDialog#BranchInwardEntry,
QDialog#BranchInwardEntry QDialog { background-color: #FFFFFF; }
QDialog#BranchInwardEntry QLabel[cap="true"] { color:#6B7280; }
QDialog#BranchInwardEntry QFrame[card="true"] { background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; }
QDialog#BranchInwardEntry QLabel[cardTitle="true"] { color:#7B1113; font-weight:bold; }
QDialog#BranchInwardEntry QLabel#lblFormTitle { font-size:20px; font-weight:bold; color:#111827; }
QDialog#BranchInwardEntry QLabel#lblScope { color:#6B7280; font-size:12px; }
QDialog#BranchInwardEntry QLabel#lblAudit { color:#6B7280; font-size:11px; }
QDialog#BranchInwardEntry QLabel#lblInboundHint,
QDialog#BranchInwardEntry QLabel#lblLinesHint { color:#6B7280; }
QDialog#BranchInwardEntry QLineEdit#txtVoucherNo, QDialog#BranchInwardEntry QLineEdit#txtAgainst,
QDialog#BranchInwardEntry QLineEdit#txtFromBranch, QDialog#BranchInwardEntry QLineEdit#txtToGodown { background:#F3F4F6; color:#374151; }
QDialog#BranchInwardEntry QLabel#lblLinesNote { color:#6B7280; font-size:11px; }
QDialog#BranchInwardEntry QGroupBox { background:#FFFFFF; border:1px solid #E5E7EB; border-radius:6px; margin-top:14px; padding-top:8px; font-weight:600; color:#374151; }
QDialog#BranchInwardEntry QGroupBox::title { subcontrol-origin: margin; left:10px; padding:0 4px; color:#7B1113; }
QDialog#BranchInwardEntry QGroupBox QLabel { font-weight:normal; }
QDialog#BranchInwardEntry QLineEdit#txtUnloadCharge { background:#F3F4F6; color:#111827; font-weight:bold; }
QDialog#BranchInwardEntry QLabel#lblHandlingNote { color:#9CA3AF; font-style:italic; font-size:11px; }
QDialog#BranchInwardEntry QFrame#frameOutcome[nexTone="warn"] { background:#FEF3E2; border:1px solid #F5D9A8; border-radius:6px; }
QDialog#BranchInwardEntry QFrame#frameOutcome[nexTone="warn"] QLabel#lblOutcomeTitle { color:#B45309; font-weight:bold; }
QDialog#BranchInwardEntry QFrame#frameOutcome[nexTone="good"] { background:#E8F5EA; border:1px solid #B7E0C0; border-radius:6px; }
QDialog#BranchInwardEntry QFrame#frameOutcome[nexTone="good"] QLabel#lblOutcomeTitle { color:#15803D; font-weight:bold; }
QDialog#BranchInwardEntry QFrame#frameOutcome QLabel#lblOutcome { color:#374151; }
QDialog#BranchInwardEntry QLabel#lblCancelNote { color:#6B7280; }
QDialog#BranchInwardEntry QLabel#lblValidation { background:#FDECEC; color:#B42318; padding:8px 14px; border-radius:4px; font-weight:600; }
QDialog#BranchInwardEntry QLabel#lblHint { color:#8b1a1a; }
QDialog#BranchInwardEntry QFrame#frameButtons { background:#F8FAFC; border-top:1px solid #E5E7EB; }
QDialog#BranchInwardEntry QLabel#lblStatus[nexTone="posted"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #15803D; background: #E8F5EA; }
QDialog#BranchInwardEntry QLabel#lblStatus[nexTone="draft"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #B45309; background: #FEF3E2; }
/* v38 (2026-10-26): Branch Inward outcome title carries its own tone (a child is not repolished with its frame) */
QDialog#BranchInwardEntry QLabel#lblOutcomeTitle[nexTone="warn"] { color:#B45309; font-weight:bold; }
QDialog#BranchInwardEntry QLabel#lblOutcomeTitle[nexTone="good"] { color:#15803D; font-weight:bold; }

/* v39 (2026-10-26): the grid popup says what is being picked (NexPopupWindow title / hint / records) */
NexPopupWindow { border: 1px solid {{primary}}; background: {{surface}}; }
NexPopupWindow QLabel#popupTitle { color: {{primary}}; font-weight: bold; font-size: 14px; padding: 4px 2px; }
NexPopupWindow QLabel#popupHint { color: #9CA3AF; font-size: 11px; }
NexPopupWindow QLabel#popupRecords { color: {{text.muted}}; font-size: 11px; font-weight: normal; }
NexPopupWindow QLineEdit#popupSearch { border: 1px solid {{border}}; border-radius: 4px; padding: 4px 6px; }
NexPopupWindow QLineEdit#popupSearch:focus { border: 1px solid {{primary}}; }

/* v39: Item list extra actions styled like Add / Edit / Delete — Scheduled amber, Qty price teal, Change rate indigo */
QToolButton[nexRole="masterActionButton"][nexAction="scheduled"] { background-color: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; }
QToolButton[nexRole="masterActionButton"][nexAction="scheduled"]:hover { background-color: #FEF3C7; border: 1px solid #FCD34D; color: #92400E; }
QToolButton[nexRole="masterActionButton"][nexAction="scheduled"]:pressed { background-color: #FDE68A; border: 1px solid #F59E0B; color: #78350F; }
QToolButton[nexRole="masterActionButton"][nexAction="qtyPrice"] { background-color: #F0FDFA; color: #0F766E; border: 1px solid #99F6E4; }
QToolButton[nexRole="masterActionButton"][nexAction="qtyPrice"]:hover { background-color: #CCFBF1; border: 1px solid #5EEAD4; color: #115E59; }
QToolButton[nexRole="masterActionButton"][nexAction="qtyPrice"]:pressed { background-color: #99F6E4; border: 1px solid #2DD4BF; color: #134E4A; }
QToolButton[nexRole="masterActionButton"][nexAction="changeRate"] { background-color: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; }
QToolButton[nexRole="masterActionButton"][nexAction="changeRate"]:hover { background-color: #E0E7FF; border: 1px solid #A5B4FC; color: #3730A3; }
QToolButton[nexRole="masterActionButton"][nexAction="changeRate"]:pressed { background-color: #C7D2FE; border: 1px solid #818CF8; color: #312E81; }

/* v39: Price Change Log — the filters popup (F4) and the summary line under the bar */
QDialog#priceLogFilterDialog { background-color: #FFFFFF; }
QDialog#priceLogFilterDialog QLabel#lblFilterTitle { color: {{primary}}; font-weight: bold; font-size: 14px; }
QDialog#PriceChangeLog QLabel#lblFilterSummary { color: {{text.muted}}; font-size: 11px; }
QDialog#PriceChangeLog QPushButton#btnFilters[nexTone="active"] { background: {{primary.soft}}; border: 1px solid {{primary.soft.border}}; color: {{primary}}; font-weight: bold; }

/* v40 (2026-10-26): Ageing Slabs — the ladder editor (menu 294) */
QDialog#AgeingSlabEntry { background-color: #FFFFFF; }
QDialog#AgeingSlabEntry QLabel#lblFormTitle { font-size: 20px; font-weight: bold; color: {{text}}; }
QDialog#AgeingSlabEntry QLabel#lblScope { color: {{text.muted}}; font-size: 12px; }
QDialog#AgeingSlabEntry QLabel[cardTitle="true"] { color: {{primary}}; font-weight: bold; }
QDialog#AgeingSlabEntry QLabel#lblInfo { background: #E8EEFC; color: #1D4ED8; padding: 8px 14px; border-radius: 4px; }
QDialog#AgeingSlabEntry QLabel#lblStatus[nexTone="default"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: #1D4ED8; background: #E8EEFC; }
QDialog#AgeingSlabEntry QLabel#lblStatus[nexTone="own"] { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: {{primary}}; background: {{primary.soft}}; }
QDialog#AgeingSlabEntry QLabel#lblCheck[nexTone="good"] { background: #E8F5EA; color: #15803D; padding: 8px 14px; border-radius: 4px; font-weight: 600; }
QDialog#AgeingSlabEntry QLabel#lblCheck[nexTone="bad"] { background: #FDECEC; color: #B42318; padding: 8px 14px; border-radius: 4px; font-weight: 600; }
QDialog#AgeingSlabEntry QFrame#frameButtons { background: #F8FAFC; border-top: 1px solid #E5E7EB; }
QDialog#AgeingSlabEntry QLabel#lblFootNote { color: {{text.muted}}; font-size: 11px; }

/* v41 (2026-10-28): Purchase Entry (menu 24) — B9 supplier chips under the header, the item strip under the lines */
QDialog#PurchaseInvoiceEntry QWidget#supplierChips QLabel[nexRole="pill"] { background: {{surface}}; border: 1px solid {{border}}; color: {{text}}; font-size: 11px; font-weight: bold; padding: 2px 10px; border-radius: 10px; }
QDialog#PurchaseInvoiceEntry QWidget#supplierChips QLabel[nexRole="pill"][nexTone] { border: none; padding: 3px 10px; }
QDialog#PurchaseInvoiceEntry QWidget#supplierChips QLabel[nexRole="pill"][nexTone="neutral"] { border: 1px solid {{border}}; padding: 2px 10px; }
QDialog#PurchaseInvoiceEntry QWidget#supplierChips QLabel[nexRole="pill"][nexTone="warning"] { background: {{warning.bg}}; color: {{warning}}; }
QDialog#PurchaseInvoiceEntry QWidget#supplierChips QLabel[nexRole="pill"][nexTone="info"] { background: {{info.bg}}; color: {{info}}; }
QDialog#PurchaseInvoiceEntry QWidget#supplierChips QLabel[nexRole="pill"][nexTone="success"] { background: {{success.bg}}; color: {{success}}; }
QDialog#PurchaseInvoiceEntry QWidget#supplierChips QLabel[nexRole="pill"][nexTone="danger"] { background: {{danger.bg}}; color: {{danger}}; }
QDialog#PurchaseInvoiceEntry QLabel#lblItemContext { background: {{surface.alt}}; color: {{text}}; font-size: 12px; padding: 6px 12px; border-radius: 4px; }
QDialog#PurchaseInvoiceEntry QLabel#lblItemContext[nexTone="empty"] { color: {{text.muted}}; }
/* ── Purchase Invoice (menu 24) — the approved mockup frame (share/purchase/purchase_invoice_ui_mockup.png), v42 ── */
QDialog#PurchaseInvoiceEntry,
QWidget QDialog#PurchaseInvoiceEntry,
QDialog#PurchaseInvoiceEntry QDialog { background-color: {{surface}}; }
QDialog#PurchaseInvoiceEntry QScrollArea#scrollBody,
QDialog#PurchaseInvoiceEntry QWidget#invoiceBody { background: {{surface}}; border: none; }
QDialog#PurchaseInvoiceEntry QLabel#lblFormTitle { font-size: 20px; font-weight: bold; color: {{text}}; }
QDialog#PurchaseInvoiceEntry QLabel#lblSubtitle { color: {{text.muted}}; font-size: 12px; }
QDialog#PurchaseInvoiceEntry QLabel#lblStatus { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: {{warning}}; background: {{warning.bg}}; }
QDialog#PurchaseInvoiceEntry QLabel#lblStatus[nexTone="posted"] { color: {{success}}; background: {{success.bg}}; }
QDialog#PurchaseInvoiceEntry QLabel#lblStatus[nexTone="cancelled"] { color: {{danger}}; background: {{danger.bg}}; }
QDialog#PurchaseInvoiceEntry QLabel#lblStatus[nexTone="hold"] { color: {{danger}}; background: {{warning.bg}}; }
QDialog#PurchaseInvoiceEntry QLabel[nexRole="sectionTitle"] { color: {{primary}}; font-weight: bold; font-size: 12px; }
QDialog#PurchaseInvoiceEntry QLabel[nexRole="sectionHint"] { color: {{text.muted}}; font-family: monospace; font-size: 10px; }
QDialog#PurchaseInvoiceEntry QFrame#sectionRule { color: {{border}}; max-height: 1px; }
QDialog#PurchaseInvoiceEntry QLabel[cap="true"] { color: {{text.muted}}; }
QDialog#PurchaseInvoiceEntry QLineEdit:read-only { background: {{surface.alt}}; color: {{text.muted}}; }
QDialog#PurchaseInvoiceEntry QLineEdit#txtTransport:read-only { background: {{surface}}; color: {{text}}; }
QDialog#PurchaseInvoiceEntry QLabel#lblDue { color: {{text}}; }
QDialog#PurchaseInvoiceEntry QLabel#lblPriceKept { color: {{warning}}; font-size: 12px; }
QDialog#PurchaseInvoiceEntry QLabel#lblHint { color: {{text.muted}}; }
/* More columns */
QDialog#PurchaseInvoiceEntry QLabel[nexRole="moreCaption"] { color: {{text.muted}}; font-size: 11px; }
QDialog#PurchaseInvoiceEntry QPushButton[nexRole="moreChip"] { background: {{surface.alt}}; color: {{text}}; border: 1px solid {{border}}; border-radius: 10px; padding: 2px 10px; font-size: 10px; font-weight: bold; min-height: 16px; }
QDialog#PurchaseInvoiceEntry QPushButton[nexRole="moreChip"]:checked { background: {{primary.soft}}; color: {{primary}}; border: 1px solid {{primary.soft.border}}; }
QDialog#PurchaseInvoiceEntry QPushButton[nexRole="moreChip"]:disabled { color: {{text.muted}}; border: 1px dashed {{border}}; }
/* F12 panels */
QDialog#PurchaseInvoiceEntry QDialog#PurchaseAllocDialog { background: {{surface}}; }
/* TOTALS */
QDialog#PurchaseInvoiceEntry QFrame#totalsBox { background: {{surface.alt}}; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#PurchaseInvoiceEntry QFrame#totalsBox QLabel[nexRole="totalCap"] { color: {{text.muted}}; }
QDialog#PurchaseInvoiceEntry QFrame#totalsBox QLabel[nexRole="totalCapStrong"] { color: {{text}}; }
QDialog#PurchaseInvoiceEntry QFrame#totalsBox QLabel[nexRole="totalValue"] { color: {{text}}; }
QDialog#PurchaseInvoiceEntry QFrame#totalsBox QLabel[nexRole="totalValueStrong"] { color: {{text}}; font-weight: bold; }
QDialog#PurchaseInvoiceEntry QFrame#totalsBox QLabel[nexTone="muted"] { color: {{text.muted}}; }
QDialog#PurchaseInvoiceEntry QFrame#totalsBox QLabel[nexTone="good"] { color: {{success}}; font-weight: bold; }
QDialog#PurchaseInvoiceEntry QFrame#totalsBox QLabel[nexTone="bad"] { color: {{danger}}; }
QDialog#PurchaseInvoiceEntry QFrame#totalsBox QLabel[nexTone="warn"] { color: {{warning}}; }
QDialog#PurchaseInvoiceEntry QFrame#totalsBox QFrame#totalsRule { color: {{border}}; max-height: 1px; }
QDialog#PurchaseInvoiceEntry QFrame#totalsBox QLineEdit[nexRole="totalEdit"] { background: {{surface}}; border: 1px solid {{border}}; border-radius: 3px; padding: 1px 4px; }
/* WARN / REFUSE strip */
QDialog#PurchaseInvoiceEntry QFrame#warnStrip { background: {{warning.bg}}; border: 1px solid {{warning}}; border-radius: 6px; }
QDialog#PurchaseInvoiceEntry QFrame#warnStrip QLabel[nexRole="issuePill"] { font-size: 10px; font-weight: bold; border-radius: 8px; padding: 2px 6px; color: {{on.primary}}; background: {{warning}}; }
QDialog#PurchaseInvoiceEntry QFrame#warnStrip QLabel[nexRole="issuePill"][nexTone="refuse"] { background: {{danger}}; }
QDialog#PurchaseInvoiceEntry QFrame#warnStrip QLabel[nexRole="issueCode"] { font-family: monospace; font-weight: bold; font-size: 11px; color: {{warning}}; }
QDialog#PurchaseInvoiceEntry QFrame#warnStrip QLabel[nexRole="issueCode"][nexTone="refuse"] { color: {{danger}}; }
QDialog#PurchaseInvoiceEntry QFrame#warnStrip QLabel[nexRole="issueText"] { color: {{text}}; }
QDialog#PurchaseInvoiceEntry QFrame#warnStrip QCheckBox#chkOverride { color: {{text.muted}}; }
/* the foot under the page */
QDialog#PurchaseInvoiceEntry QWidget#frameButtons { background: {{surface}}; border-top: 1px solid {{border}}; }
/* ── Purchase Order (menu 23) — the approved mockup frame (share/purchase/purchase_order_ui_mockup.png), v43 ── */
QDialog#PurchaseOrderEntry,
QWidget QDialog#PurchaseOrderEntry { background-color: {{surface}}; }
QDialog#PurchaseOrderEntry QScrollArea#scrollBody,
QDialog#PurchaseOrderEntry QWidget#orderBody { background: {{surface}}; border: none; }
QDialog#PurchaseOrderEntry QLabel#lblFormTitle { font-size: 20px; font-weight: bold; color: {{text}}; }
QDialog#PurchaseOrderEntry QLabel#lblSubtitle { color: {{text.muted}}; font-size: 12px; }
/* the status pill: draft / confirmed / part_received / received / closed / awaiting_approval / not_approved / cancelled / amending */
QDialog#PurchaseOrderEntry QLabel#lblStatus { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: {{warning}}; background: {{warning.bg}}; }
QDialog#PurchaseOrderEntry QLabel#lblStatus[nexTone="confirmed"] { color: {{primary}}; background: {{primary.soft}}; }
QDialog#PurchaseOrderEntry QLabel#lblStatus[nexTone="part_received"] { color: {{info}}; background: {{info.bg}}; }
QDialog#PurchaseOrderEntry QLabel#lblStatus[nexTone="received"] { color: {{success}}; background: {{success.bg}}; }
QDialog#PurchaseOrderEntry QLabel#lblStatus[nexTone="closed"] { color: {{text.muted}}; background: {{surface.alt}}; }
QDialog#PurchaseOrderEntry QLabel#lblStatus[nexTone="cancelled"],
QDialog#PurchaseOrderEntry QLabel#lblStatus[nexTone="not_approved"] { color: {{danger}}; background: {{danger.bg}}; }
/* section headings: THE HEADER / THE LINES / ESTIMATED CHARGES */
QDialog#PurchaseOrderEntry QLabel[nexRole="sectionTitle"] { color: {{primary}}; font-weight: bold; font-size: 12px; }
QDialog#PurchaseOrderEntry QLabel[nexRole="sectionHint"] { color: {{text.muted}}; font-family: monospace; font-size: 10px; }
QDialog#PurchaseOrderEntry QFrame#sectionRule { color: {{border}}; max-height: 1px; }
QDialog#PurchaseOrderEntry QLabel[cap="true"] { color: {{text.muted}}; }
QDialog#PurchaseOrderEntry QLineEdit:read-only { background: {{surface.alt}}; color: {{text.muted}}; }
QDialog#PurchaseOrderEntry QLabel#lblCreditNote { color: {{text.muted}}; }
QDialog#PurchaseOrderEntry QLabel#lblHint { color: {{text.muted}}; }
/* the totals strip: Lines · Ordered value · Received · Pending · Short-closed · PO total */
QDialog#PurchaseOrderEntry QFrame#totalsStrip { background: {{surface.alt}}; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#PurchaseOrderEntry QFrame#totalsStrip QLabel[nexRole="stripCap"] { color: {{text.muted}}; font-size: 11px; }
QDialog#PurchaseOrderEntry QFrame#totalsStrip QLabel[nexRole="stripValue"] { color: {{text}}; }
QDialog#PurchaseOrderEntry QFrame#totalsStrip QLabel[nexRole="stripValueStrong"] { color: {{text}}; font-weight: bold; font-size: 15px; }
QDialog#PurchaseOrderEntry QFrame#totalsStrip QLabel[nexTone="good"] { color: {{success}}; }
QDialog#PurchaseOrderEntry QFrame#totalsStrip QLabel[nexTone="warn"] { color: {{warning}}; }
QDialog#PurchaseOrderEntry QFrame#totalsStrip QLabel[nexTone="bad"] { color: {{danger}}; }
QDialog#PurchaseOrderEntry QFrame#totalsStrip QLabel[nexTone="muted"] { color: {{text.muted}}; }
/* the foot under the page */
QDialog#PurchaseOrderEntry QWidget#frameButtons { background: {{surface}}; border-top: 1px solid {{border}}; }
/* ── GRN (menu 196) — the approved mockup frame (share/purchase/purchase_grn_ui_mockup.png), v44 ── */
QDialog#GrnEntry,
QWidget QDialog#GrnEntry,
QDialog#GrnEntry QDialog { background-color: {{surface}}; }
QDialog#GrnEntry QScrollArea#scrollBody,
QDialog#GrnEntry QWidget#grnBody { background: {{surface}}; border: none; }
QDialog#GrnEntry QLabel#lblFormTitle { font-size: 20px; font-weight: bold; color: {{text}}; }
QDialog#GrnEntry QLabel#lblSubtitle { color: {{text.muted}}; font-size: 12px; }
/* the status pill: draft / posted / billed / part / cancelled */
QDialog#GrnEntry QLabel#lblStatus { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: {{warning}}; background: {{warning.bg}}; }
QDialog#GrnEntry QLabel#lblStatus[nexTone="posted"] { color: {{primary}}; background: {{primary.soft}}; }
QDialog#GrnEntry QLabel#lblStatus[nexTone="part"] { color: {{info}}; background: {{info.bg}}; }
QDialog#GrnEntry QLabel#lblStatus[nexTone="billed"] { color: {{success}}; background: {{success.bg}}; }
QDialog#GrnEntry QLabel#lblStatus[nexTone="cancelled"] { color: {{danger}}; background: {{danger.bg}}; }
/* section headings: THE HEADER / WHAT ARRIVED / F12 — BATCH SPLIT / CHARGES */
QDialog#GrnEntry QLabel[nexRole="sectionTitle"] { color: {{primary}}; font-weight: bold; font-size: 12px; }
QDialog#GrnEntry QLabel[nexRole="sectionHint"] { color: {{text.muted}}; font-family: monospace; font-size: 10px; }
QDialog#GrnEntry QFrame#sectionRule { color: {{border}}; max-height: 1px; }
QDialog#GrnEntry QLabel[cap="true"] { color: {{text.muted}}; }
QDialog#GrnEntry QLineEdit:read-only { background: {{surface.alt}}; color: {{text.muted}}; }
QDialog#GrnEntry QLineEdit#txtTransport:read-only,
QDialog#GrnEntry QLineEdit#txtReceivedBy:read-only { background: {{surface}}; color: {{text}}; }
QDialog#GrnEntry QLabel#lblHint { color: {{text.muted}}; }
QDialog#GrnEntry QLabel#lblAllocPlaceholder { color: {{text.muted}}; font-size: 12px; }
/* F12 inline under the lines (the shared alloc panel) */
QDialog#GrnEntry QDialog#PurchaseAllocDialog { background: {{surface}}; }
/* the totals strip: Lines · Received (base) · Damaged · Short (vs challan) · Off-bill charges · Provisional value */
QDialog#GrnEntry QFrame#totalsStrip { background: {{surface.alt}}; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#GrnEntry QFrame#totalsStrip QLabel[nexRole="stripCap"] { color: {{text.muted}}; font-size: 11px; }
QDialog#GrnEntry QFrame#totalsStrip QLabel[nexRole="stripValue"] { color: {{text}}; }
QDialog#GrnEntry QFrame#totalsStrip QLabel[nexRole="stripValueStrong"] { color: {{text}}; font-weight: bold; font-size: 15px; }
QDialog#GrnEntry QFrame#totalsStrip QLabel[nexTone="good"] { color: {{success}}; }
QDialog#GrnEntry QFrame#totalsStrip QLabel[nexTone="warn"] { color: {{warning}}; }
QDialog#GrnEntry QFrame#totalsStrip QLabel[nexTone="bad"] { color: {{danger}}; }
QDialog#GrnEntry QFrame#totalsStrip QLabel[nexTone="muted"] { color: {{text.muted}}; }
/* the WARN / REFUSE strip over the buttons, with "override (logged)" */
QDialog#GrnEntry QFrame#warnStrip { background: {{warning.bg}}; border: 1px solid {{warning}}; border-radius: 6px; }
QDialog#GrnEntry QFrame#warnStrip QLabel[nexRole="issuePill"] { font-size: 10px; font-weight: bold; border-radius: 8px; padding: 2px 6px; color: {{on.primary}}; background: {{warning}}; }
QDialog#GrnEntry QFrame#warnStrip QLabel[nexRole="issuePill"][nexTone="refuse"] { background: {{danger}}; }
QDialog#GrnEntry QFrame#warnStrip QLabel[nexRole="issueCode"] { font-family: monospace; font-weight: bold; font-size: 11px; color: {{warning}}; }
QDialog#GrnEntry QFrame#warnStrip QLabel[nexRole="issueCode"][nexTone="refuse"] { color: {{danger}}; }
QDialog#GrnEntry QFrame#warnStrip QLabel[nexRole="issueText"] { color: {{text}}; }
QDialog#GrnEntry QFrame#warnStrip QCheckBox#chkOverride { color: {{text.muted}}; }
/* the foot under the page */
QDialog#GrnEntry QWidget#frameButtons { background: {{surface}}; border-top: 1px solid {{border}}; }
/* ── Purchase Return (menu 25) — the approved mockup frame (share/purchase/purchase_return_ui_mockup.png), v45 ── */
QDialog#PurchaseReturnEntry,
QWidget QDialog#PurchaseReturnEntry,
QDialog#PurchaseReturnEntry QDialog { background-color: {{surface}}; }
QDialog#PurchaseReturnEntry QScrollArea#scrollBody,
QDialog#PurchaseReturnEntry QWidget#returnBody { background: {{surface}}; border: none; }
QDialog#PurchaseReturnEntry QLabel#lblFormTitle { font-size: 20px; font-weight: bold; color: {{text}}; }
QDialog#PurchaseReturnEntry QLabel#lblSubtitle { color: {{text.muted}}; font-size: 12px; }
/* the status pill: draft / posted / cancelled */
QDialog#PurchaseReturnEntry QLabel#lblStatus { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: {{warning}}; background: {{warning.bg}}; }
QDialog#PurchaseReturnEntry QLabel#lblStatus[nexTone="posted"] { color: {{primary}}; background: {{primary.soft}}; }
QDialog#PurchaseReturnEntry QLabel#lblStatus[nexTone="cancelled"] { color: {{danger}}; background: {{danger.bg}}; }
/* section headings: THE HEADER / THE ROWS / THE FOUR OUTCOMES */
QDialog#PurchaseReturnEntry QLabel[nexRole="sectionTitle"] { color: {{primary}}; font-weight: bold; font-size: 12px; }
QDialog#PurchaseReturnEntry QLabel[nexRole="sectionHint"] { color: {{text.muted}}; font-family: monospace; font-size: 10px; }
QDialog#PurchaseReturnEntry QFrame#sectionRule { color: {{border}}; max-height: 1px; }
QDialog#PurchaseReturnEntry QLabel[cap="true"] { color: {{text.muted}}; }
QDialog#PurchaseReturnEntry QLineEdit:read-only { background: {{surface.alt}}; color: {{text.muted}}; }
QDialog#PurchaseReturnEntry QLineEdit#txtTransport:read-only { background: {{surface}}; color: {{text}}; }
QDialog#PurchaseReturnEntry QLabel#lblHint { color: {{text.muted}}; }
/* the totals strip: Rows · Return now (debit note) · Claims raised · Replace qty due · ITC reversed · Supplier balance now */
QDialog#PurchaseReturnEntry QFrame#totalsStrip { background: {{surface.alt}}; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#PurchaseReturnEntry QFrame#totalsStrip QLabel[nexRole="stripCap"] { color: {{text.muted}}; font-size: 11px; }
QDialog#PurchaseReturnEntry QFrame#totalsStrip QLabel[nexRole="stripValue"] { color: {{text}}; }
QDialog#PurchaseReturnEntry QFrame#totalsStrip QLabel[nexRole="stripValueStrong"] { color: {{text}}; font-weight: bold; font-size: 15px; }
QDialog#PurchaseReturnEntry QFrame#totalsStrip QLabel[nexTone="good"] { color: {{success}}; }
QDialog#PurchaseReturnEntry QFrame#totalsStrip QLabel[nexTone="warn"] { color: {{warning}}; }
QDialog#PurchaseReturnEntry QFrame#totalsStrip QLabel[nexTone="bad"] { color: {{danger}}; }
QDialog#PurchaseReturnEntry QFrame#totalsStrip QLabel[nexTone="muted"] { color: {{text.muted}}; }
QDialog#PurchaseReturnEntry QFrame#totalsStrip QLabel[nexTone="info"] { color: {{info}}; }
/* THE FOUR OUTCOMES — the fixed legend (Outcome · Goods · Money · ITC · Closes when) */
QDialog#PurchaseReturnEntry QFrame#outcomeLegend { border: 1px solid {{border}}; background: {{border}}; }
QDialog#PurchaseReturnEntry QFrame#outcomeLegend QLabel { padding: 5px 8px; background: {{surface}}; color: {{text}}; }
QDialog#PurchaseReturnEntry QFrame#outcomeLegend QLabel[nexRole="legendHead"] { background: {{surface.alt}}; color: {{text}}; font-weight: bold; }
QDialog#PurchaseReturnEntry QFrame#outcomeLegend QLabel[nexRole="legendName"] { font-weight: bold; }
/* the WARN / REFUSE strip over the buttons, (no override on a return) */
QDialog#PurchaseReturnEntry QFrame#warnStrip { background: {{warning.bg}}; border: 1px solid {{warning}}; border-radius: 6px; }
QDialog#PurchaseReturnEntry QFrame#warnStrip QLabel[nexRole="issuePill"] { font-size: 10px; font-weight: bold; border-radius: 8px; padding: 2px 6px; color: {{on.primary}}; background: {{warning}}; }
QDialog#PurchaseReturnEntry QFrame#warnStrip QLabel[nexRole="issuePill"][nexTone="refuse"] { background: {{danger}}; }
QDialog#PurchaseReturnEntry QFrame#warnStrip QLabel[nexRole="issueCode"] { font-family: monospace; font-weight: bold; font-size: 11px; color: {{warning}}; }
QDialog#PurchaseReturnEntry QFrame#warnStrip QLabel[nexRole="issueCode"][nexTone="refuse"] { color: {{danger}}; }
QDialog#PurchaseReturnEntry QFrame#warnStrip QLabel[nexRole="issueText"] { color: {{text}}; }
QDialog#PurchaseReturnEntry QFrame#warnStrip QCheckBox#chkOverride { color: {{text.muted}}; }
/* the foot under the page */
QDialog#PurchaseReturnEntry QWidget#frameButtons { background: {{surface}}; border-top: 1px solid {{border}}; }
/* ── Supplier Dues (menu 297) — the approved mockup (share/purchase/purchase_claims_shortage_ui_mockup.png, "Supplier dues"), v46 ── */
QDialog#SupplierDuesPage,
QWidget QDialog#SupplierDuesPage,
QDialog#SupplierDuesPage QDialog { background-color: {{surface}}; }
QDialog#SupplierDuesPage QScrollArea#scrollBody,
QDialog#SupplierDuesPage QWidget#duesBody { background: {{surface}}; border: none; }
QDialog#SupplierDuesPage QLabel#lblFormTitle { font-size: 20px; font-weight: bold; color: {{text}}; }
QDialog#SupplierDuesPage QLabel#lblSubtitle { color: {{text.muted}}; font-size: 12px; }
/* the "3 OPEN" chip (amber) / NOTHING OPEN */
QDialog#SupplierDuesPage QLabel#lblStatus { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: {{warning}}; background: {{warning.bg}}; }
QDialog#SupplierDuesPage QLabel#lblStatus[nexTone="clear"] { color: {{success}}; background: {{success.bg}}; }
/* section headings: A. CLAIMS — money expected / B. SHORTAGES & REPLACEMENTS — goods expected */
QDialog#SupplierDuesPage QLabel[nexRole="sectionTitle"] { color: {{primary}}; font-weight: bold; font-size: 12px; }
QDialog#SupplierDuesPage QLabel[nexRole="sectionHint"] { color: {{text.muted}}; font-family: monospace; font-size: 10px; }
QDialog#SupplierDuesPage QFrame#sectionRule { color: {{border}}; max-height: 1px; }
QDialog#SupplierDuesPage QLabel[cap="true"] { color: {{text.muted}}; }
QDialog#SupplierDuesPage QLabel#lblHint { color: {{text.muted}}; }
/* the Settle claim box (grey inset) and the What Settle writes box (white) */
QDialog#SupplierDuesPage QFrame#settlePanel { background: {{surface.alt}}; border: 1px solid {{border}}; border-radius: 8px; }
QDialog#SupplierDuesPage QFrame#previewPanel { background: {{surface}}; border: 1px solid {{border}}; border-radius: 8px; }
QDialog#SupplierDuesPage QFrame#settlePanel QLabel#lblSettleTitle,
QDialog#SupplierDuesPage QFrame#previewPanel QLabel#lblPreviewTitle { color: {{text}}; font-weight: bold; }
QDialog#SupplierDuesPage QFrame#settlePanel QLineEdit#txtAmount:enabled { border: 1px solid {{primary}}; }
QDialog#SupplierDuesPage QFrame#settlePanel QLabel#lblSettleNote { color: {{text.muted}}; font-size: 11px; }
/* the voucher legs, mono as the mockup: Dr … · Cr … · amount */
QDialog#SupplierDuesPage QFrame#previewPanel QLabel[nexRole="previewDr"],
QDialog#SupplierDuesPage QFrame#previewPanel QLabel[nexRole="previewCr"] { font-family: monospace; font-size: 11px; color: {{text}}; }
QDialog#SupplierDuesPage QFrame#previewPanel QLabel[nexRole="previewAmount"] { font-family: monospace; font-size: 11px; font-weight: bold; color: {{text}}; }
QDialog#SupplierDuesPage QFrame#previewPanel QLabel#lblPreviewMsg { color: {{text.muted}}; }
QDialog#SupplierDuesPage QFrame#previewPanel QLabel#lblPreviewMsg[nexTone="danger"] { color: {{danger}}; }
QDialog#SupplierDuesPage QFrame#previewPanel QLabel#lblPreviewTotals { color: {{text}}; font-weight: bold; }
QDialog#SupplierDuesPage QFrame#previewPanel QLabel[nexRole="previewNote"] { color: {{text.muted}}; font-size: 11px; }
QDialog#SupplierDuesPage QFrame#previewPanel QLabel#lblCashNote { color: {{info}}; font-size: 11px; }
QDialog#SupplierDuesPage QFrame#previewPanel QLabel#lnkReceipt { color: {{primary}}; font-size: 11px; }
/* the totals strip: Claims · Money open · Credited · written off · Shortages · Goods value open · GST held */
QDialog#SupplierDuesPage QFrame#totalsStrip { background: {{surface.alt}}; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#SupplierDuesPage QFrame#totalsStrip QLabel[nexRole="stripCap"] { color: {{text.muted}}; font-size: 11px; }
QDialog#SupplierDuesPage QFrame#totalsStrip QLabel[nexRole="stripValue"] { color: {{text}}; }
QDialog#SupplierDuesPage QFrame#totalsStrip QLabel[nexRole="stripValueStrong"] { color: {{text}}; font-weight: bold; font-size: 15px; }
QDialog#SupplierDuesPage QFrame#totalsStrip QLabel[nexTone="good"] { color: {{success}}; }
QDialog#SupplierDuesPage QFrame#totalsStrip QLabel[nexTone="warn"] { color: {{warning}}; }
QDialog#SupplierDuesPage QFrame#totalsStrip QLabel[nexTone="bad"] { color: {{danger}}; }
QDialog#SupplierDuesPage QFrame#totalsStrip QLabel[nexTone="muted"] { color: {{text.muted}}; }
QDialog#SupplierDuesPage QFrame#totalsStrip QLabel[nexTone="info"] { color: {{info}}; }
/* the foot under the page */
QDialog#SupplierDuesPage QWidget#frameButtons { background: {{surface}}; border-top: 1px solid {{border}}; }
/* Close row… popup (QDialog#ShortageCloseDialog) */
QDialog#ShortageCloseDialog { background-color: {{surface}}; }
QDialog#ShortageCloseDialog QLabel#lblDialogTitle { color: {{text}}; font-weight: bold; font-size: 13px; }
QDialog#ShortageCloseDialog QLabel[cap="true"] { color: {{text.muted}}; }
QDialog#ShortageCloseDialog QLabel#lblHint { color: {{text.muted}}; font-size: 11px; }
/* ── Shortage Receipt (menu 195) — the approved mockup (share/purchase/purchase_claims_shortage_ui_mockup.png, "SHORTAGES & REPLACEMENTS"), v47 ── */
QDialog#ShortageReceiptEntry,
QWidget QDialog#ShortageReceiptEntry,
QDialog#ShortageReceiptEntry QDialog { background-color: {{surface}}; }
QDialog#ShortageReceiptEntry QScrollArea#scrollBody,
QDialog#ShortageReceiptEntry QWidget#shortageBody { background: {{surface}}; border: none; }
QDialog#ShortageReceiptEntry QLabel#lblFormTitle { font-size: 20px; font-weight: bold; color: {{text}}; }
QDialog#ShortageReceiptEntry QLabel#lblSubtitle { color: {{text.muted}}; font-size: 12px; }
/* the pill: "3 OPEN" (amber) on a new receipt / NOTHING OPEN; draft / posted / cancelled once saved */
QDialog#ShortageReceiptEntry QLabel#lblStatus { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: {{warning}}; background: {{warning.bg}}; }
QDialog#ShortageReceiptEntry QLabel#lblStatus[nexTone="clear"] { color: {{success}}; background: {{success.bg}}; }
QDialog#ShortageReceiptEntry QLabel#lblStatus[nexTone="posted"] { color: {{primary}}; background: {{primary.soft}}; }
QDialog#ShortageReceiptEntry QLabel#lblStatus[nexTone="cancelled"] { color: {{danger}}; background: {{danger.bg}}; }
/* the section heading: SHORTAGES & REPLACEMENTS — goods expected (+ the grey mono hint) */
QDialog#ShortageReceiptEntry QLabel[nexRole="sectionTitle"] { color: {{primary}}; font-weight: bold; font-size: 12px; }
QDialog#ShortageReceiptEntry QLabel[nexRole="sectionHint"] { color: {{text.muted}}; font-family: monospace; font-size: 10px; }
QDialog#ShortageReceiptEntry QFrame#sectionRule { color: {{border}}; max-height: 1px; }
QDialog#ShortageReceiptEntry QLabel[cap="true"] { color: {{text.muted}}; }
/* Receipt No: the grey given-on-save box */
QDialog#ShortageReceiptEntry QLineEdit:read-only { background: {{surface.alt}}; color: {{text.muted}}; }
QDialog#ShortageReceiptEntry QLabel#lblHint { color: {{text.muted}}; }
/* F12 inline under the lines (the shared alloc panel) */
QDialog#ShortageReceiptEntry QDialog#PurchaseAllocDialog { background: {{surface}}; }
/* the strip: Ticked rows · Receive now (base) · Stock in at original cost · ITC released (green) · Still open after this (amber) */
QDialog#ShortageReceiptEntry QFrame#totalsStrip { background: {{surface.alt}}; border: 1px solid {{border}}; border-radius: 6px; }
QDialog#ShortageReceiptEntry QFrame#totalsStrip QLabel[nexRole="stripCap"] { color: {{text.muted}}; font-size: 11px; }
QDialog#ShortageReceiptEntry QFrame#totalsStrip QLabel[nexRole="stripValue"] { color: {{text}}; }
QDialog#ShortageReceiptEntry QFrame#totalsStrip QLabel[nexRole="stripValueStrong"] { color: {{text}}; font-weight: bold; font-size: 15px; }
QDialog#ShortageReceiptEntry QFrame#totalsStrip QLabel[nexTone="good"] { color: {{success}}; }
QDialog#ShortageReceiptEntry QFrame#totalsStrip QLabel[nexTone="warn"] { color: {{warning}}; }
QDialog#ShortageReceiptEntry QFrame#totalsStrip QLabel[nexTone="bad"] { color: {{danger}}; }
QDialog#ShortageReceiptEntry QFrame#totalsStrip QLabel[nexTone="muted"] { color: {{text.muted}}; }
/* the WARN / REFUSE strip over the buttons (no override on a shortage receipt) */
QDialog#ShortageReceiptEntry QFrame#warnStrip { background: {{warning.bg}}; border: 1px solid {{warning}}; border-radius: 6px; }
QDialog#ShortageReceiptEntry QFrame#warnStrip QLabel[nexRole="issuePill"] { font-size: 10px; font-weight: bold; border-radius: 8px; padding: 2px 6px; color: {{on.primary}}; background: {{warning}}; }
QDialog#ShortageReceiptEntry QFrame#warnStrip QLabel[nexRole="issuePill"][nexTone="refuse"] { background: {{danger}}; }
QDialog#ShortageReceiptEntry QFrame#warnStrip QLabel[nexRole="issueCode"] { font-family: monospace; font-weight: bold; font-size: 11px; color: {{warning}}; }
QDialog#ShortageReceiptEntry QFrame#warnStrip QLabel[nexRole="issueCode"][nexTone="refuse"] { color: {{danger}}; }
QDialog#ShortageReceiptEntry QFrame#warnStrip QLabel[nexRole="issueText"] { color: {{text}}; }
QDialog#ShortageReceiptEntry QFrame#warnStrip QCheckBox#chkOverride { color: {{text.muted}}; }
/* the foot under the page */
QDialog#ShortageReceiptEntry QWidget#frameButtons { background: {{surface}}; border-top: 1px solid {{border}}; }

/* ── Purchase Order (menu 23) on a .ui (sale-bill frame) — DRAFT v48, additions to the v43 block (DRAFT: not published) ──
   New in v48: the Revision and Approval pills beside the status pill, the one-row audit label, the quick icon strip
   under the title, the section rules by name (two on one screen, so no shared id), the header grid with no row gap.
   Kept from v43 (same objectNames): lblFormTitle, lblSubtitle, lblStatus, lblHint, lblCreditNote, frameFields caps,
   the sectionTitle / sectionHint roles, totalsStrip, frameButtons. orderBody / scrollBody no longer exist (no scroll page). */
QDialog#PurchaseOrderEntry QFrame#frameHeader { background: transparent; border: none; }
QDialog#PurchaseOrderEntry QLabel#lblAudit { color: {{text.muted}}; font-size: 11px; padding: 5px; }
/* the pills: Revision, Approval (the status pill is the v43 rule) */
QDialog#PurchaseOrderEntry QLabel#lblRevision,
QDialog#PurchaseOrderEntry QLabel#lblApproval { font-size: 11px; font-weight: bold; padding: 3px 12px; border-radius: 10px; color: {{text.muted}}; background: {{surface.alt}}; }
QDialog#PurchaseOrderEntry QLabel#lblRevision { color: {{info}}; background: {{info.bg}}; }
QDialog#PurchaseOrderEntry QLabel#lblApproval[nexTone="awaiting"] { color: {{warning}}; background: {{warning.bg}}; }
QDialog#PurchaseOrderEntry QLabel#lblApproval[nexTone="approved"] { color: {{success}}; background: {{success.bg}}; }
QDialog#PurchaseOrderEntry QLabel#lblApproval[nexTone="rejected"] { color: {{danger}}; background: {{danger.bg}}; }
/* the quick icon strip (as the sale bill's frameQuick) */
QDialog#PurchaseOrderEntry QFrame#frameQuick QToolButton { border: 1px solid {{border}}; border-radius: 6px; padding: 3px 8px; background: {{surface}}; }
QDialog#PurchaseOrderEntry QFrame#frameQuick QToolButton:hover { background: {{surface.alt}}; }
QDialog#PurchaseOrderEntry QFrame#frameQuick QToolButton:disabled { background: {{surface.alt}}; }
/* the section rules (THE LINES / ESTIMATED CHARGES) */
QDialog#PurchaseOrderEntry QFrame#ruleLines,
QDialog#PurchaseOrderEntry QFrame#ruleCharges { color: {{border}}; max-height: 1px; }
$qss_v48$;
    v_id    integer;
    v_cur   text;
    v_known text[] := ARRAY[
        'b13900f3463118fc83c3a79f0f19a1ae',   -- migration 20261001140000 seed (v1)
        'ec418bdccb8a324a7c3803d2a4d0b921',   -- seed-template-v2.qss
        'bb7e9a98dd9b2881365aa72a977972b1',   -- seed-template-v3.qss
        '054ff2cfb628a4db10f15d05c6857c60',   -- seed-template-v4.qss
        'dbb96edb35d77baae2433baf6922ea07',   -- seed-template-v5.qss
        '6ebd6689e50e3b1d17d5d4d4e99848df',   -- seed-template-v6.qss
        '5093b4f7b372e4d8378a9ea820d24175',   -- seed-template-v7.qss
        '1ad8d3f35eeacfe6ed7eab6991a22850',   -- seed-template-v8.qss
        '5ffcd4b88cb5377a12b45e36305e074e',   -- seed-template-v9.qss
        'bf46af8edfaaeda80084770d40247b79',   -- seed-template-v10.qss
        '06eb30b6b2860a158524783d91a2e35d',   -- seed-template-v11.qss
        '140d8d57a9af3314ce83c30e3cf99268',   -- seed-template-v12.qss
        'dab6223a3a881b798d6ae934ebcd0649',   -- seed-template-v13.qss
        '0522089eadf55f7361f36dcd9336a16a',   -- seed-template-v14.qss
        '273fcd91d9ff1366fbc0b1624196378e',   -- seed-template-v15.qss
        '000c3791a1f71a776678f3bdfbec5bd3',   -- seed-template-v16.qss
        '0c8e10ea7aa05cb6edff757e98fdcbee',   -- seed-template-v17.qss
        '248b1016aae06f9f1031d4e754e3e6d5',   -- seed-template-v18.qss
        '59a12061f1b44c021a31365b3317ff89',   -- seed-template-v18c.qss
        'e827b29ebbb9fda413c664fe28ffc5b3',   -- seed-template-v19.qss
        'c47df50c180f1e7d8445d4b6ea2ab262',   -- seed-template-v20.qss
        '770dd78a7a66af93d952b02e0b3a821b',   -- seed-template-v21.qss
        '48eaf8c9caeb5030bb2e5be52828747b',   -- seed-template-v22.qss
        '824ad7722e57d6a845502175372d36ac',   -- seed-template-v23.qss
        '64a1a2e006c7ce14e078079d06e9637e',   -- seed-template-v24.qss
        '97d88098f41fb83e31c99a0e921cb227',   -- seed-template-v25.qss
        '32bf64345a3b85e571b086c933b4de21',   -- seed-template-v26.qss
        'de94eb2c0101e938b10087607292ebdd',   -- seed-template-v27.qss
        '8d0e43ad918965df365911236650d4c0',   -- seed-template-v28.qss
        'f8af6d8699069b86e2e76fd278782b3c',   -- seed-template-v29.qss
        '033b327814f1ebe048ba1e6007db134a',   -- seed-template-v30.qss
        '199230d0d2b8c715efb68a68235fe792',   -- seed-template-v31.qss
        '57365cb671daecb251e66dc89acb82ad',   -- seed-template-v32.qss
        'a28d7b39b3349d17c4ffb1b93bdf0bd3',   -- seed-template-v33.qss
        '7eabc35b8c4501a10d351e8fbc23e66e',   -- seed-template-v34.qss
        'd11e7f4dfc3be03990f4f699ffe91fa6',   -- seed-template-v35.qss
        '3cfd946a122325278c0e21d849c96dcf',   -- seed-template-v36.qss
        '88e6bda502c8e868bd779c16858f5cc8',   -- seed-template-v37.qss
        'e5bee3a0a0954d36b25f910dae0f1394',   -- seed-template-v38.qss
        'd70c433f551754d9e227e9e8b9df79a4',   -- seed-template-v39.qss
        '71dd0c46ad7d472b5c4a9f41dcf03809',   -- seed-template-v40.qss
        'e34e777ccda62433d08006dcd854a33b',   -- seed-template-v41.qss
        '269cfac5220929355c478fbee91cd120',   -- seed-template-v42.qss
        '5680992be9542f3965d111dd750f8550',   -- seed-template-v43.qss
        '8d13a5e8f5e53cb1ebda19bc9d58e887',   -- seed-template-v44.qss
        '113a1ba9b99644276dde40f0db86aa37',   -- seed-template-v45.qss
        'c0ff4bb1d951225f9b0963f205509ac8',   -- seed-template-v46.qss
        'deaa86170a5184c46d5255258a2b19f5'    -- seed-template-v47.qss
    ];
BEGIN
    IF to_regclass('public.app_theme_template') IS NULL THEN
        RAISE NOTICE 'app theme v48: no app_theme_template table, nothing to do';
        RETURN;
    END IF;

    SELECT tpl_id, tpl_qss INTO v_id, v_cur
      FROM public.app_theme_template
     WHERE tpl_is_active = true AND tpl_is_deleted = false
     ORDER BY tpl_id
     LIMIT 1;

    IF v_id IS NULL THEN
        RAISE NOTICE 'app theme v48: no active template row, nothing to do';
        RETURN;
    END IF;

    IF md5(v_cur) = md5(v_new) THEN
        RAISE NOTICE 'app theme v48: template % already holds v48', v_id;
        RETURN;
    END IF;

    IF NOT (md5(v_cur) = ANY (v_known)) THEN
        RAISE NOTICE 'app theme v48: template % was changed on this server (md5 %), left alone — publish v48 from share/theme/seed-template-v48.qss by hand if wanted', v_id, md5(v_cur);
        RETURN;
    END IF;

    UPDATE public.app_theme_template
       SET tpl_qss         = v_new,
           tpl_remarks     = 'v48: Purchase Order (menu 23) on a .ui — Revision / Approval pills, audit row, quick icon strip, header with no row gap',
           tpl_modified_on = now()
     WHERE tpl_id = v_id;

    RAISE NOTICE 'app theme v48: template % updated (was md5 %)', v_id, md5(v_cur);
END $mig$;
