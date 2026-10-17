import {
  MAX_SEARCH_TOKENS,
  looseSearchPredicateSql,
  looseSearchSql,
  normalizeSearchText,
  splitSearchTokens,
} from './loose-search';

describe('loose-search', () => {
  describe('normalizeSearchText', () => {
    it('lower-cases and drops white space and punctuation', () => {
      expect(normalizeSearchText('Chilli  Powder - 200 g, SM-SAUCE_00012')).toBe(
        'chillipowder200gsmsauce00012',
      );
    });

    it('keeps letters of other scripts', () => {
      expect(normalizeSearchText('மிளகாய் தூள்')).toBe('மிளகாய்தூள்');
    });

    it('removes the LIKE metacharacters as punctuation', () => {
      expect(normalizeSearchText('50% off_now\\')).toBe('50offnow');
    });

    it('is empty for nothing, blanks and punctuation', () => {
      expect(normalizeSearchText(undefined)).toBe('');
      expect(normalizeSearchText('   ')).toBe('');
      expect(normalizeSearchText(' - / . ')).toBe('');
    });
  });

  describe('splitSearchTokens', () => {
    it('splits on white space and keeps the raw words', () => {
      expect(splitSearchTokens('  Chilli   POWDER ')).toEqual(['Chilli', 'POWDER']);
    });

    it('drops words that are only punctuation and repeated words', () => {
      expect(splitSearchTokens('chilli - Chilli, CHILLI powder')).toEqual(['chilli', 'powder']);
    });

    it('is empty for nothing to search', () => {
      expect(splitSearchTokens(undefined)).toEqual([]);
      expect(splitSearchTokens(' ')).toEqual([]);
      expect(splitSearchTokens(' - ')).toEqual([]);
    });

    it(`stops after ${MAX_SEARCH_TOKENS} pieces`, () => {
      const words = Array.from({ length: MAX_SEARCH_TOKENS + 3 }, (_, i) => `w${i}`);
      expect(splitSearchTokens(words.join(' '))).toHaveLength(MAX_SEARCH_TOKENS);
    });
  });

  describe('looseSearchPredicateSql', () => {
    it('normalises both the column and the bound term in SQL', () => {
      expect(looseSearchPredicateSql('grid_kv.value', '$2')).toBe(
        "fixed.fn_search_norm(grid_kv.value) LIKE '%' || fixed.fn_search_norm($2::text) || '%'",
      );
    });
  });

  describe('looseSearchSql', () => {
    it('is TRUE when there is nothing to search for', () => {
      expect(looseSearchSql(['itm.item_name_en'], undefined).text).toBe('TRUE');
      expect(looseSearchSql(['itm.item_name_en'], ' - ').text).toBe('TRUE');
      expect(looseSearchSql([], 'chilli').text).toBe('TRUE');
    });

    it('ORs the columns inside each piece and ANDs the pieces', () => {
      const sql = looseSearchSql(['itm.item_name_en', 'itm.item_code'], 'chilli powder');
      expect(sql.text).toBe(
        '((' +
          "fixed.fn_search_norm(itm.item_name_en) LIKE '%' || fixed.fn_search_norm($1::text) || '%'" +
          ' OR ' +
          "fixed.fn_search_norm(itm.item_code) LIKE '%' || fixed.fn_search_norm($2::text) || '%'" +
          ') AND (' +
          "fixed.fn_search_norm(itm.item_name_en) LIKE '%' || fixed.fn_search_norm($3::text) || '%'" +
          ' OR ' +
          "fixed.fn_search_norm(itm.item_code) LIKE '%' || fixed.fn_search_norm($4::text) || '%'" +
          '))',
      );
      expect(sql.values).toEqual(['chilli', 'chilli', 'powder', 'powder']);
    });

    it('binds the raw word, leaving normalisation to the database', () => {
      expect(looseSearchSql(['l.led_name'], 'Chilli-Powder').values).toEqual(['Chilli-Powder']);
    });

    it('refuses a column expression that is not an identifier chain', () => {
      expect(() => looseSearchSql(["itm.item_name_en) OR 1=1 --"], 'x')).toThrow(
        /not a column identifier/,
      );
      expect(() => looseSearchSql(['itm.item_name_en; drop'], 'x')).toThrow();
    });
  });
});
