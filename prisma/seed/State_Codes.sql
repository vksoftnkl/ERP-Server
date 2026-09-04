-- Seed: fixed.state_codes -- the GST state codes of India (40 rows).
--
-- The two-digit code that opens every GSTIN, and the value place-of-supply is decided
-- on: sales.sale_quotation, sale_bill and sale_order (twice -- place of supply and
-- ship-to) all carry a foreign key to state_code, so a document stamped '33' has to
-- mean Tamil Nadu in every environment. Without these rows no sales document saves.
--
-- state_code is the primary key and is issued by the GST department, not by a
-- sequence, so the codes are written out verbatim and there is no setval.
--
-- state_ut marks a Union Territory (UTGST applies instead of SGST on an intra-UT
-- supply). tin_code is the legacy VAT TIN prefix, which matches the GST code for
-- every state. is_active = false retires a code without deleting it -- 25 (Daman and
-- Diu) was merged into 26 in 2020, and old documents still have to resolve its label.
-- 97 (Other Territory) and 99 (Centre Jurisdiction) are the department's own
-- pseudo-states, not geography.
--
-- state_sync_date is left NULL: it records when a site last reconciled the list
-- against the GST portal, which is per-environment and not a property of the data.
--
-- Idempotent: ON CONFLICT (state_code) DO NOTHING -- a code already present keeps its
-- locally edited name and flags.
-- Regenerate with: npm run seed:export:masters
-- Run: psql "$DATABASE_URL" -f prisma/seed/State_Codes.sql
--      or: npm run seed:run -- --only=State_Codes.sql

BEGIN;

INSERT INTO fixed.state_codes
    (state_code, state_name, state_ut, tin_code, is_active, is_deleted, created_by, modified_by)
VALUES
     ('01'::char(2), 'Jammu and Kashmir'::varchar, true::boolean, '01'::varchar, true::boolean, false::boolean, 'system'::varchar, 'system'::varchar)
    ,('02', 'Himachal Pradesh', false, '02', true , false, 'system', 'system')
    ,('03', 'Punjab', false, '03', true , false, 'system', 'system')
    ,('04', 'Chandigarh', true , '04', true , false, 'system', 'system')
    ,('05', 'Uttarakhand', false, '05', true , false, 'system', 'system')
    ,('06', 'Haryana', false, '06', true , false, 'system', 'system')
    ,('07', 'Delhi', true , '07', true , false, 'system', 'system')
    ,('08', 'Rajasthan', false, '08', true , false, 'system', 'system')
    ,('09', 'Uttar Pradesh', false, '09', true , false, 'system', 'system')
    ,('10', 'Bihar', false, '10', true , false, 'system', 'system')
    ,('11', 'Sikkim', false, '11', true , false, 'system', 'system')
    ,('12', 'Arunachal Pradesh', false, '12', true , false, 'system', 'system')
    ,('13', 'Nagaland', false, '13', true , false, 'system', 'system')
    ,('14', 'Manipur', false, '14', true , false, 'system', 'system')
    ,('15', 'Mizoram', false, '15', true , false, 'system', 'system')
    ,('16', 'Tripura', false, '16', true , false, 'system', 'system')
    ,('17', 'Meghalaya', false, '17', true , false, 'system', 'system')
    ,('18', 'Assam', false, '18', true , false, 'system', 'system')
    ,('19', 'West Bengal', false, '19', true , false, 'system', 'system')
    ,('20', 'Jharkhand', false, '20', true , false, 'system', 'system')
    ,('21', 'Odisha', false, '21', true , false, 'system', 'system')
    ,('22', 'Chhattisgarh', false, '22', true , false, 'system', 'system')
    ,('23', 'Madhya Pradesh', false, '23', true , false, 'system', 'system')
    ,('24', 'Gujarat', false, '24', true , false, 'system', 'system')
    ,('25', 'Daman and Diu (Legacy)', true , '25', false, false, 'system', 'system')
    ,('26', 'Dadra and Nagar Haveli and Daman and Diu', true , '26', true , false, 'system', 'system')
    ,('27', 'Maharashtra', false, '27', true , false, 'system', 'system')
    ,('28', 'Andhra Pradesh (Before Division)', false, '28', true , false, 'system', 'system')
    ,('29', 'Karnataka', false, '29', true , false, 'system', 'system')
    ,('30', 'Goa', false, '30', true , false, 'system', 'system')
    ,('31', 'Lakshadweep', true , '31', true , false, 'system', 'system')
    ,('32', 'Kerala', false, '32', true , false, 'system', 'system')
    ,('33', 'Tamil Nadu', false, '33', true , false, 'system', 'system')
    ,('34', 'Puducherry', true , '34', true , false, 'system', 'system')
    ,('35', 'Andaman and Nicobar Islands', true , '35', true , false, 'system', 'system')
    ,('36', 'Telangana', false, '36', true , false, 'system', 'system')
    ,('37', 'Andhra Pradesh', false, '37', true , false, 'system', 'system')
    ,('38', 'Ladakh', true , '38', true , false, 'system', 'system')
    ,('97', 'Other Territory', false, '97', true , false, 'system', 'system')
    ,('99', 'Centre Jurisdiction', false, '99', true , false, 'system', 'system')
ON CONFLICT (state_code) DO NOTHING;

COMMIT;
