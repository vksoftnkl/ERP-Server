-- Drop chk_ipm_profit_type. The constraint pinned ipm_profit_type to
-- ('BY_PERCENT', 'BY_AMOUNT', 'MANUAL') (added in 20260324130000, recreated in
-- 20260324140000), which no longer matches the values the client sends
-- ('By %', 'By Rs', 'By User'). SaveItemPriceDto's @IsIn list stays the single
-- place the allowed values are enforced.
ALTER TABLE "inventory"."item_price_master"
  DROP CONSTRAINT IF EXISTS "chk_ipm_profit_type";
