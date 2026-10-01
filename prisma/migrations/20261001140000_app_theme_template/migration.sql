-- ═══════════════════════════════════════════════════════════════════════════
--  44 — the app theme TEMPLATE: the stylesheet rules, once, in the database.
--  2026-10-01. theme/plan-app-theme-template.md §2 (part 2 of plan-app-theme.md).
--
--  The user's rule: no app.qss, no stylesheet in any .ui — styling comes from
--  the theme master only. The RULES live here, once, as QSS with {{key}}
--  placeholders; each app_theme_master row (MAROON / BLUE / YELLOW) supplies
--  the colours; the client fills one with the other and applies the result.
--  One template, not a stylesheet per theme: a rule is written once, a theme
--  is only a palette (3.0 stored a full sheet per company and every rule
--  existed N times).
--
--  * Shared — no company column, like app_theme_master.
--  * Exactly ONE live active row (ux_tpl_active): the one every client applies.
--    A second template would bring the 3.0 problem back.
--  * tpl_sync_date rides the cloud push; the sync triggers are installed here
--    when the sync functions exist, else at the next boot as for any table.
--  * Seeded with the share's theme/seed-template-v1.qss (sweep step 1: the
--    former app.qss + the main window's sheet), as tpl_name 'NEXERP', only
--    when no live template exists — so re-running, or a database that already
--    holds a newer version saved through /app-themes/template/save, is left
--    alone. Its placeholders are all v1 / v2 token keys; the v2 keys
--    (primary.soft …) are API-side only (APP_THEME_TOKEN_KEYS), no DDL.
--
--  Re-runnable: IF NOT EXISTS everywhere, the seed guarded.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.app_theme_template (
    tpl_id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tpl_name        varchar(100) NOT NULL,
    tpl_qss         text         NOT NULL,
    tpl_is_active   boolean      NOT NULL DEFAULT true,
    tpl_is_deleted  boolean      NOT NULL DEFAULT false,
    tpl_remarks     varchar(250),
    tpl_sync_date   timestamptz,
    tpl_created_on  timestamptz  NOT NULL DEFAULT now(),
    tpl_created_by  varchar(100),
    tpl_modified_on timestamptz,
    tpl_modified_by varchar(100)
);

COMMENT ON TABLE public.app_theme_template IS
    'The stylesheet rules every client applies: QSS with {{key}} placeholders filled from app_theme_master.thm_tokens. One live active row.';
COMMENT ON COLUMN public.app_theme_template.tpl_qss IS
    'QSS with {{token}} / {{size.font|icon|header}} placeholders; validated by POST /app-themes/template/save.';

-- exactly one live template: the one every client applies
CREATE UNIQUE INDEX IF NOT EXISTS ux_tpl_active ON public.app_theme_template (tpl_is_active)
    WHERE tpl_is_active = true AND tpl_is_deleted = false;

INSERT INTO public.app_theme_template (tpl_name, tpl_qss, tpl_remarks, tpl_created_by)
SELECT 'NEXERP',
       $qss$/* ═══════════════════════════════════════════════════════════════════════
   NEXERP theme template — seed v1 (2026-10-01)
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
    background: transparent;
    border: none;
    padding: 0px 0px;
    margin: 0px;
    color: #222222;
}

QTableWidget QLineEdit:focus {
    background: transparent;
    border: 0px solid {{primary}};
    outline: none;
}

QTableWidget QSpinBox {
    background: transparent;
    border: none;
    padding: 0px;
    margin: 0px;
    color: #222222;
}

QTableWidget QSpinBox:focus {
    background: transparent;
    border: none;
    outline: none;
}


QLineEdit,
QPlainTextEdit,
QTextEdit,
QSpinBox,
QDateEdit,
QTimeEdit
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
QTimeEdit:focus
{
    border: 1px solid {{primary}};
}

QDateEdit::down-arrow {
    image: url(:/resources/assets/icons/down_arrow.svg);
    width: 12px;
    height: 12px;
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


QPushButton[class="action"] {
    background-color: {{surface}};
    color: {{text}};

    padding: 7px 16px;
}

/* Hover - light maroon */
QPushButton:hover,
QPushButton:focus {
    background-color: {{primary.soft}};
    color: {{primary}};
}

/* Click / Pressed - maroon */
QPushButton:pressed {
    background-color: {{primary}};
    color: {{on.primary}};
}

/* Disabled */
QPushButton:disabled {
    background-color: {{surface.alt}};
    color: #9CA3AF;
}



QTableView {
    background-color: {{table.row}};
    alternate-background-color: {{table.row.alt}};

    border: 1px solid {{border}};
    border-radius: 8px;

    gridline-color: #eef0f3;

    color: #1f2937;
    font-size: 13px;

    selection-background-color: {{table.selected}};
    selection-color: {{table.selected.fg}};

    outline: 0;
}

QTableView::item {
    padding: 8px 10px;
    border: none;
}

QTableView::item:selected {
    background-color: {{table.selected}};
    color: {{table.selected.fg}};
}


/* Horizontal Header */
QHeaderView::section:horizontal {
    background-color: {{table.header.bg}};
    color: {{table.header.fg}};

    font-size: 12px;
    font-weight: 700;

    padding: 8px 10px;

    border: none;
    border-bottom: 2px solid #ebebf0;
    border-right: 1px solid #f0f0f5;
}

QHeaderView::section:horizontal:first {
    border-top-left-radius: 8px;
}


/* Vertical Header / Row Numbers */
QHeaderView::section:vertical {
    background-color: {{table.row}};
    color: {{text}};

    font-size: 10px;
    font-weight: 500;

    padding: 4px 4px;

    border: none;
    border-right: 1px solid #eef0f3;
    border-bottom: 1px solid #eef0f3;
}


/* Top-left corner */
QTableCornerButton::section {
    background-color: {{table.header.bg}};
    border: none;
    border-bottom: 2px solid #ebebf0;
    border-right: 1px solid #f0f0f5;
    border-top-left-radius: 8px;
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
    min-width: 70px;
    max-width: 70px;

    background-color: {{surface}};
    color: #1F2937;

    border: 1px solid {{border}};
    border-radius: 10px;



    font-size: 11px;
    font-weight: 600;

    qproperty-iconSize: 28px 28px;
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

/* ── Part B: the main window (MenuWindow) ─────────────────────────────── */

/* ═══════════════════════════════════════════════════════════
   Menu bar shell
   ═══════════════════════════════════════════════════════════ */
MenuWindow QMenuBar {
    background-color: {{menu.bg}};
    min-height:  64px;
    max-height:  64px;
    padding:     0 8px;
    border:      none;
    spacing:     2px;
}

MenuWindow QMenuBar::item {
    background:    transparent;
    color:         {{menu.fg}};
    padding:       0 14px;
    margin:        0 2px;
    border-bottom: 3px solid transparent;
    font-size:     14px;
}

MenuWindow QMenuBar::item:selected,
MenuWindow QMenuBar::item:pressed {
    background-color: rgba(255,255,255, 0.10);
    border-bottom:    3px solid {{menu.fg}};
    border-radius:    0px;
}

/* ═══════════════════════════════════════════════════════════
   Drop-down menus
   ═══════════════════════════════════════════════════════════ */
MenuWindow QMenu {
    background-color: #1E1E1E;
    color:            #F0F0F0;
    border:           1px solid rgba(255,255,255,0.10);
    border-radius:    6px;
    padding:          6px 0;
    font-size:        13px;
    font-family:      "Segoe UI", sans-serif;
}

MenuWindow QMenu::item {
    padding:    9px 36px 9px 16px;
    background: transparent;
    color:      #E8E8E8;
}

MenuWindow QMenu::item:selected {
    background-color: {{primary}};
    color:            {{on.primary}};
    border-radius:    0;
}

MenuWindow QMenu::item:disabled {
    color: rgba(255,255,255,0.35);
}

MenuWindow QMenu::separator {
    height:     1px;
    background: rgba(255,255,255,0.12);
    margin:     5px 14px;
}

/* Submenu arrow */
MenuWindow QMenu::right-arrow {
    width:  8px;
    height: 8px;
    right:  12px;
    image:  url(:/icons/chevron_right_white.png);
}

MenuWindow QMenu::right-arrow:selected {
    image: url(:/icons/chevron_right_white.png);
}





/* ═══════════════════════════════════════════════════════════
   Tool bar (hosts the combo boxes + user avatar)
   ═══════════════════════════════════════════════════════════ */
MenuWindow QToolBar#topToolBar {
    background:  {{menu.bg}};
    border:      none;
    spacing:     8px;
    padding:     0 12px;
}

/* Add to your existing QSS */
MenuWindow QMenuBar {
    background-color: {{menu.bg}};
    min-height: 64px;
    max-height: 64px;
    padding: 0;
    spacing: 0;
}

MenuWindow QMenuBar::item {
    background:   transparent;
    color:        {{menu.fg}};
    padding:      0 16px;
    margin:       0;
    border:       none;
    height:       64px;
    font-size:    14px;
    font-family:  "Segoe UI", "Ubuntu", sans-serif;
}

MenuWindow QMenuBar::item:selected {
    background-color: rgba(255, 255, 255, 0.12);
    border-bottom:    3px solid {{menu.fg}};
}

MenuWindow QMenuBar::item:pressed {
    background-color: rgba(255, 255, 255, 0.18);
    border-bottom:    3px solid {{menu.fg}};
}




/* ── Toolbar acts as menu bar ─────────────────────────── */
MenuWindow QToolBar {
    background-color: {{menu.bg}};
    border:           none;
    padding:          0;
    spacing:          0;
}

/* ── Each menu button ─────────────────────────────────── */
MenuWindow QToolButton[class="menuButton"] {
    background:       transparent;
    color:            {{menu.fg}};
    border:           none;
    border-bottom:    3px solid transparent;
    padding:          6px 14px 4px 14px;
    font-size:        14px;
    font-family:      "Segoe UI", "Ubuntu", sans-serif;
    min-width:        64px;
    height:           64px;
font-weight: 700;
}

MenuWindow QToolButton[class="menuButton"]:hover,
MenuWindow QToolButton[class="menuButton"]:pressed,
MenuWindow QToolButton[class="menuButton"][popupMode="1"]:pressed {
    background-color: rgba(255, 255, 255, 0.12);
    border-bottom:    3px solid {{menu.fg}};
}

/* ── Dropdown arrow — hide the default one ────────────── */
MenuWindow QToolButton[class="menuButton"]::menu-indicator {
    image:  none;
    width:  0;
    height: 0;
}

/* ── Drop-down menus ──────────────────────────────────── */
MenuWindow QMenu {
    background-color: #1E1E1E;
    color:            #F0F0F0;
    border:           1px solid rgba(255,255,255,0.10);
    border-radius:    6px;
    padding:          6px 0;
    font-size:        13px;
}

MenuWindow QMenu::item {
    padding:    9px 36px 9px 16px;
    background: transparent;
    color:      #E8E8E8;
}

MenuWindow QMenu::item:selected {
    background-color: {{primary}};
    color:            {{on.primary}};
}

MenuWindow QMenu::separator {
    height:     1px;
    background: rgba(255,255,255,0.12);
    margin:     5px 14px;
}

/**/


MenuWindow QFrame#frameBrand {
    background-color: transparent;
    border: none;
}

MenuWindow QLabel#lblLogoBox {
    background-color: #E22B2B;
    color: #FFFFFF;
    border-radius: 8px;
    font-size: 20px;
    font-weight: 800;
}

MenuWindow QLabel#lblAppName {
    color: {{menu.fg}};
    font-size: 23px;
    font-weight: 800;
}


MenuWindow QFrame#frameRightSelectors {
    background-color: transparent;
    border: none;
}

MenuWindow QFrame[class="selectorCard"] {
    background-color: {{surface}};
    border: 1px solid {{border}};
    border-radius: 9px;
}

MenuWindow QLabel[class="selectorLabel"] {
    color: {{text.muted}};
    font-size: 11px;
    font-weight: 600;
}

MenuWindow QFrame#userBox {
    background: transparent;
    border: 0px;
}

MenuWindow QLabel#userName {
    color: {{menu.fg}};
    font-size: 13px;
    font-weight: 800;
}

MenuWindow QLabel#userRole {
    color: rgba(255,255,255,0.88);
    font-size: 11px;
    font-weight: 700;
}

MenuWindow QLabel#avatarIcon {
    border-radius: 25px;
}

MenuWindow QLabel#userArrow {
    color: {{menu.fg}};
    font-size: 14px;
    font-weight: 800;
}


MenuWindow QFrame#footerFrame {
    background: {{surface}};
    border-top: 1px solid #eef2f7;
}

MenuWindow QLabel[class="footerText"] {
    color: {{text}};
    font-size: 13px;
    font-weight: 600;
}

MenuWindow QLabel[class="footerValue"] {
    color: #e11d2e;
    font-size: 13px;
    font-weight: 800;
}

MenuWindow QLabel[class="footerSeparator"] {
    color: #cbd5e1;
    font-size: 20px;
    font-weight: 300;
}

MenuWindow QLabel#footerStatus {
    color: {{text}};
    background: transparent;
    border: 0px;
    padding: 0px;
    font-size: 14px;
    font-weight: 700;
}

MenuWindow QLabel#footerDot {
    color: #16a34a;
    font-size: 18px;
    font-weight: 900;
}
$qss$,
       'Seed v1 (theme/seed-template-v1.qss): app.qss + the main window sheet',
       'MIGRATION'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_theme_template WHERE tpl_is_deleted = false);

DO $$
BEGIN
    IF to_regprocedure('public.sync_install_triggers()') IS NOT NULL THEN
        PERFORM public.sync_install_triggers();
    END IF;
END $$;
