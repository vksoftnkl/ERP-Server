-- ═══════════════════════════════════════════════════════════════════════════
--  Loose search: fixed.fn_search_norm(text)                        2026-10-02
--
--  The report: typing "chillipowder" found nothing. Every list and picker
--  search ran `value ILIKE '%chillipowder%'` against the stored
--  "CHILLI POWDER" — one space, no match. The same for "SM-SAUCE" against
--  "SMSAUCE", or "200g" against "200 g".
--
--  This function is the one normalisation BOTH sides of a search go through:
--  lower-case, then every run of white space and punctuation removed, so
--  "Chilli  Powder - 200 g" and "chillipowder200g" are the same string.
--  Letters of any script survive (a regional name is searchable as typed);
--  only [[:space:]] and [[:punct:]] go, and with them LIKE's own % and _, so
--  a normalised term needs no escaping. The typed term is normalised by this
--  same function inside the query — never in TypeScript — so the two sides
--  cannot drift (glibc's [[:punct:]] and JavaScript's \p{P} disagree on some
--  combining marks).
--
--  Callers: ConfiguredGridSqlService.buildSearchSql (every configured grid and
--  dropdown, i.e. every master list and picker in both clients) and
--  src/common/search/loose-search.ts (the hand-written SQL searches). They
--  split the typed text on spaces and require every piece to be found, so
--  "powder chilli" still finds CHILLI POWDER.
--
--  IMMUTABLE and PARALLEL SAFE so it may sit in an expression index later
--  (a pg_trgm GIN over fn_search_norm(item_name_en), should the item list
--  need one). Re-runnable: CREATE OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fixed.fn_search_norm(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT regexp_replace(lower(txt), '[[:space:][:punct:]]+', '', 'g');
$$;

COMMENT ON FUNCTION fixed.fn_search_norm(text) IS
  'Search normalisation: lower-case with every run of white space and punctuation removed. '
  'Apply to the stored value AND the typed term; see src/common/search/loose-search.ts.';
