-- Seed: fixed.dropdown_columns -- the column layout of every configured lookup popup (134 rows).
--
-- Runs after Dropdown_Details.sql -- dropdown_columns_dropdown_id is a foreign key
-- into it, ON DELETE CASCADE.
--
-- Same two-part idempotency as Grid_Columns.sql: the exported uuid primary key makes
-- a re-run a no-op, and a dropdown that already has any column is skipped entirely so
-- an independently configured popup is never duplicated.
--
-- dropdown_columns_sql_name is the field the dropdown SQL returns;
-- dropdown_columns_name is the heading, _alias the label the client shows.
-- Regenerate with: npm run seed:export:ui-config
-- Run: psql "$DATABASE_URL" -f prisma/seed/Dropdown_Columns.sql
--      or: npm run seed:run -- --only=Dropdown_Columns.sql

BEGIN;

INSERT INTO fixed.dropdown_columns
    (dropdown_columns_id, dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_name, dropdown_columns_sql_name, dropdown_columns_alias, dropdown_columns_data_type, dropdown_columns_width, dropdown_columns_allignment, dropdown_columns_visiblity, dropdown_columns_filter, dropdown_columns_created_by)
SELECT v.* FROM (VALUES
    -- ============ state dropdown (id 2) ============
     ('019ebb95-1a0f-7aba-8f46-319e5049e42e'::uuid, 2::integer, 1::integer, 'state id'::varchar, 'stm_id'::text, 'state id'::varchar, 'Text'::varchar, 20.00::numeric, 'Left'::varchar, true::boolean, false::boolean, 'system'::text)
    ,('019ebb95-1a0f-7abf-84b0-a3980b73ec7b', 2 , 2, 'state name'          , 'stm_name'          , 'state name'          , 'Text', 20.00 , 'Left', true , true , 'system')
    -- ============ customerGroups (id 3) ============
    ,('019ebb95-1a0f-7a7c-b24d-9784f93a8a44', 3 , 1, 'cgr_name'            , 'cgr_name'          , 'Customer Group Name' , 'Text', 20.00 , 'Left', true , true , 'system')
    ,('019ebb95-1a0f-7a82-9567-b6254048f40d', 3 , 2, 'cgr_alias'           , NULL                , 'Customer Group Alias', 'Text', 20.00 , 'Left', true , false, 'system')
    -- ============ city master (id 4) ============
    ,('019ebb95-1a0f-7a33-9315-d634cab05a67', 4 , 1, 'City id'             , 'ctm_id'            , 'city id'             , 'Text', 50.00 , 'Left', true , false, 'system')
    ,('019ebb95-1a0f-7a3e-b0d0-46ba3fd0bcd6', 4 , 2, 'City name'           , 'ctm_name'          , 'City name'           , 'Text', 20.00 , 'Left', true , false, 'system')
    ,('019ebb95-1a0f-7a5c-b1cc-01be71e114e8', 4 , 3, 'City alias'          , 'ctm_alias'         , 'City alias'          , 'Text', 20.00 , 'Left', true , false, 'system')
    -- ============ branch (id 5) ============
    ,('019ebb95-1a0f-7ad9-9f00-1a2eef9f5684', 5 , 1, 'Branch id'           , 'br_id'             , 'branch id'           , 'Text', 20.00 , 'Left', true , false, 'system')
    ,('019ebb95-1a0f-7ade-ba7f-998849f2bf88', 5 , 2, 'Branch name'         , 'br_name'           , 'Branch name'         , 'Text', 20.00 , 'Left', true , true , 'system')
    ,('019ebb95-1a0f-7ae3-8e24-28c91d8830b5', 5 , 3, 'Branch code'         , NULL                , 'Branch code'         , 'Text', 20.00 , 'Left', true , false, 'system')
    ,('019ebb95-1a0f-7ae8-a6b4-3231f85662e3', 5 , 4, 'Branch alias'        , NULL                , 'Branch alias'        , 'Text', 20.00 , 'Left', true , false, 'system')
    ,('019ebb95-1a0f-79ab-860b-74f15fc85573', 5 , 5, 'Branch mailing name' , NULL                , 'Branch mailing name' , 'Text', 20.00 , 'Left', true , false, 'system')
    -- ============ items (id 6) ============
    ,('019ebb95-1a0f-7a61-a396-8f4bbc363ce4', 6 , 1, 'Item id'             , NULL                , 'Item id'             , 'Text', 20.00 , 'Left', true , false, 'system')
    ,('019ebb95-1a0f-7a66-a704-381915eb4972', 6 , 2, 'Item name'           , 'item_name_en'      , 'Item name'           , 'Text', 20.00 , 'Left', true , true , 'system')
    ,('019ebb95-1a0f-7a6b-8974-16c23ef4fe37', 6 , 3, 'Item alias'          , 'item_alias'        , 'Item alias'          , 'Text', 20.00 , 'Left', true , true , 'system')
    -- ============ companyGroups (id 7) ============
    ,('019ebb95-1a0f-7a71-8239-e235453fab9e', 7 , 1, 'cog_group_id'        , NULL                , 'Company Group Id'    , 'Text', NULL  , 'Left', true , false, 'system')
    ,('019ebb95-1a0f-7a77-9972-cdc99a1fef1c', 7 , 2, 'cog_group_name'      , NULL                , 'Company Group Name'  , 'Text', NULL  , 'Left', true , true , 'system')
    -- ============ company (id 8) ============
    ,('019ebb95-1a0f-7a88-96d1-fb8224f78d1d', 8 , 1, 'company id'          , 'comp_id'           , 'company id'          , 'Text', 20.00 , 'Left', true , false, 'system')
    ,('019ebb95-1a0f-7a8d-b607-bce843f57e83', 8 , 2, 'company name'        , 'comp_name'         , 'company name'        , 'Text', 20.00 , 'Left', true , true , 'system')
    ,('019ebb95-1a0f-7a92-8831-022246e8b236', 8 , 3, 'company code'        , NULL                , 'company code'        , 'Text', 20.00 , 'Left', true , false, 'system')
    ,('019ebb95-1a0f-7a97-a151-e672139c1665', 8 , 4, 'company short'       , NULL                , 'company short'       , 'Text', 20.00 , 'Left', true , false, 'system')
    -- ============ state code (id 9) ============
    ,('019ebb95-1a0f-7a9c-9b52-7ae819b1128d', 9 , 1, 'state code'          , 'state_code'        , 'state code'          , 'Text', 20.00 , 'Left', true , true , 'system')
    ,('019ebb95-1a0f-7aa1-b1ef-6e1793c4a6ff', 9 , 2, 'state name'          , 'state_name'        , 'state name'          , 'Text', 20.00 , 'Left', true , true , 'system')
    -- ============ Area (id 10) ============
    ,('019ebb95-1a0f-7aa6-b302-0af3e755b21f', 10, 1, 'Area id'             , 'arm_id'            , 'Area id'             , 'Text', 20.00 , 'Left', true , false, 'system')
    ,('019ebb95-1a0f-7aab-9a49-b03e49ae7b08', 10, 2, 'Area name'           , 'arm_name'          , 'Area name'           , 'Text', 20.00 , 'Left', true , true , 'system')
    ,('019ebb95-1a0f-7ab0-aca3-f210f2a5259c', 10, 3, 'Area alias'          , 'arm_alias'         , 'Area alias'          , 'Text', 20.00 , 'Left', true , true , 'system')
    ,('019ebb95-1a0f-7ab5-846d-e74bc44b39d6', 10, 4, 'Area short'          , 'arm_short'         , 'Area short'          , 'Text', 20.00 , 'Left', true , true , 'system')
    -- ============ suppliergroups (id 11) ============
    ,('019ebb95-1a0f-7ac4-9987-bd7ebeeffb25', 11, 1, 'supplier group id'   , 'spg_id'            , 'supplier group id'   , 'Text', 20.00 , 'Left', true , false, 'system')
    ,('019ebb95-1a0f-7aca-a2f2-37df468b5809', 11, 2, 'supplier group name' , 'spg_name'          , 'supplier group name' , 'Text', 20.00 , 'Left', true , true , 'system')
    ,('019ebb95-1a0f-7acf-b4c8-4c612051e6ed', 11, 3, 'supplier group alias', 'spg_alias'         , 'supplier group alias', 'Text', 20.00 , 'Left', true , true , 'system')
    ,('019ebb95-1a0f-7ad4-b636-bbb406aaed9d', 11, 4, 'supplier group short', 'spg_short'         , 'supplier group short', 'Text', 20.00 , 'Left', true , true , 'system')
    -- ============ AREA LIST (id 13) ============
    ,('019ec0cc-2352-75c7-a545-23708a592fc1', 13, 0, 'arm_id'              , 'arm_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019ec0e2-de76-7b68-bd6a-9938649f4db3', 13, 1, 'arm_name'            , 'arm_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    ,('019ec9e7-3c84-70e8-8894-71296b3c0e23', 13, 2, 'arm_short'           , 'arm_short'         , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    -- ============ GST UNIT CODES (id 14) ============
    ,('019ecb13-55e7-75bb-9e46-55f528b369b6', 14, 0, '#'                   , 'item_gst_unit_code', NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019ecb13-55e8-7c2c-86ca-97835022222e', 14, 1, 'Name'                , 'item_gst_unit_name', NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ ITEM UNITS (id 15) ============
    ,('019ecb14-f438-7375-a820-9429a8068cbc', 15, 0, '#'                   , 'unit_id'           , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019ecb14-f439-70c6-92f6-70036d86a613', 15, 1, 'Name'                , 'unit_name'         , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ MENUS (id 16) ============
    ,('019ed05f-6f92-7d52-989b-0129501e7595', 16, 0, '#'                   , 'menu_id'           , NULL                  , 'Text', 0.00  , 'Left', false, false, 'system')
    ,('019ed05f-6f94-7553-b0cd-a69a0bfeb4eb', 16, 1, 'Menu Name'           , 'menu_name'         , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ ITEM GROUPS (id 17) ============
    ,('019ed8fd-9164-794f-bae6-54712d2877b7', 17, 0, '#'                   , 'itg_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019ed8fd-9165-74fd-b6ff-124e52785c9c', 17, 1, 'Group Name'          , 'itg_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    ,('019ed8fd-9165-7c2d-aade-aa8276fd9ada', 17, 2, 'Short'               , 'itg_short'         , NULL                  , 'Text', 20.00 , 'Left', false, true , 'system')
    -- ============ ITEM BRANDS (id 18) ============
    ,('019edac7-d06d-7412-b11e-23ae69c82b11', 18, 0, '#'                   , 'brand_id'          , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019edac7-d06d-7c56-af5b-7c2e7662a196', 18, 1, 'Brand'               , 'brand_name'        , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    ,('019edac7-d06e-74c3-bd80-3734a78d1ec4', 18, 2, 'Short'               , 'brand_short'       , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    -- ============ ITEM SECTIONS (id 19) ============
    ,('019edfa9-125f-7860-83c2-400c4205b78c', 19, 0, '#'                   , 'sec_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019edfa9-1260-7a54-8fad-9061bdd8f3ff', 19, 1, 'Short'               , 'sec_short'         , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    ,('019edfa9-1261-7386-9977-3c111652df7d', 19, 2, 'Section'             , 'sec_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    ,('019edfa9-1261-7d61-a7c6-77fb1ae8a0ab', 19, 3, 'Alias'               , 'sec_alias'         , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    -- ============ ITEM CATEGORIES (id 20) ============
    ,('019ee368-80ab-7834-855d-46cc3eb97808', 20, 0, '#'                   , 'category_id'       , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019ee368-80ac-7af9-8848-d1cfa065b1bc', 20, 1, 'Short'               , 'category_short'    , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    ,('019ee368-80ad-738f-b832-e3641ba3d354', 20, 2, 'Category'            , 'category_name'     , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    ,('019ee368-80ad-7bd2-abad-4528d0504c84', 20, 3, 'Alias Name'          , 'category_alias'    , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    -- ============ GST - STATE CODES (id 21) ============
    ,('019ee3a4-0964-7c7f-891d-f585856a3f99', 21, 0, '#'                   , 'state_code'        , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    ,('019ee3a4-0965-78fe-8377-92120f539929', 21, 1, 'State Name'          , 'state_name'        , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ COMPANYS (id 22) ============
    ,('019eee1b-c622-7984-820e-84fc5d2bb16a', 22, 0, 'comp_id'             , 'comp_id'           , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019eee1b-c623-79e0-8d6a-c49bf883aee2', 22, 1, 'comp_code'           , 'comp_code'         , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    ,('019eee1b-c624-7135-b68b-470105016e48', 22, 2, 'comp_short'          , 'comp_short'        , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    ,('019eee1b-c624-78d0-8f96-5c629a6212b1', 22, 3, 'comp_name'           , 'comp_name'         , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ ACCOUNT GROUPS (id 23) ============
    ,('019eef52-1a09-775a-a26c-282d74aa3163', 23, 0, '#'                   , 'acc_group_id'      , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019eef52-1a0a-7591-9c43-487af6779bb4', 23, 1, 'Short'               , 'acc_group_short'   , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    ,('019eef52-1a0a-7e71-8f55-f7aa72cc2b65', 23, 2, 'Group Name'          , 'acc_group_name'    , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ BRANCH - ACTIVE LIST (id 24) ============
    ,('019ef300-5930-76db-acca-7a6f68de7c76', 24, 0, '#'                   , 'br_id'             , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019ef300-5931-7c0f-a422-b9248900800c', 24, 1, 'Code'                , 'br_code'           , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    ,('019ef300-5932-776e-af3b-9c66d36a3cf1', 24, 2, 'Branch'              , 'br_name'           , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ BANK LEDGERS (id 25) ============
    ,('019ef9aa-4634-75e6-afd8-95c12598edf7', 25, 0, '#'                   , 'led_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019ef9aa-4635-73e4-9b28-1d29fa965923', 25, 1, 'led_name'            , 'led_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ GODOWNS (id 26) ============
    ,('019ef9cb-7dc4-74f6-906e-b8fb4a1d3b1a', 26, 0, '#'                   , 'gdl_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019ef9cb-7dc5-71f1-a742-529a29330b74', 26, 1, 'Godown'              , 'gdl_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    ,('019ef9cb-7dc5-7ac4-9f4b-82535b0b8286', 26, 2, 'Short'               , 'gdl_short'         , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    -- ============ APP THEMES (id 27) ============
    ,('019ef9df-2a94-7a6a-8890-602c3a5ce155', 27, 0, '#'                   , 'thm_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019ef9df-2a95-7830-bf80-4bb918d6eca6', 27, 1, 'Theme'               , 'thm_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ customer group (id 28) ============
    ,('019efdcd-1ac8-79f0-928e-5d2106f33ced', 28, 1, 'Id'                  , 'cgr_id'            , NULL                  , 'Text', NULL  , 'Left', true , false, 'system')
    ,('019efdcd-1ac9-79ff-aee5-5997137d7e2e', 28, 2, 'Cgr name'            , 'cgr_name'          , NULL                  , 'Text', NULL  , 'Left', true , true , 'system')
    -- ============ CUSTOMER STATES (id 29) ============
    ,('019f07e2-6777-77ae-9993-edb72ea58031', 29, 0, '#'                   , 'stm_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f07e2-6778-7564-a8e2-02ae25c3dc57', 29, 1, 'State Name'          , 'stm_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    ,('019f07e2-6778-7cc4-b49c-2953a634676c', 29, 2, 'Alias Name'          , 'stm_alias'         , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f07e2-6779-73e0-88c0-c4bcf9ca3e5c', 29, 3, 'Short'               , 'stm_short'         , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    -- ============ CUSTOMER CITIES (id 30) ============
    ,('019f07e3-fe4a-7d9f-a3b9-84e54393adac', 30, 0, '#'                   , 'ctm_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f07e3-fe4b-7c87-b4d1-86c933a4fc81', 30, 1, 'City Name'           , 'ctm_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    ,('019f07e3-fe4c-761e-a2bb-de48d58587fa', 30, 2, 'Alias Name'          , 'ctm_alias'         , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f07e3-fe4d-7090-95cf-f173f1f8b4c0', 30, 3, 'Short'               , 'ctm_short'         , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    -- ============ SUPPLIER GROUP (id 31) ============
    ,('019f16d1-93ff-7155-af32-0b7b7916bd18', 31, 0, '#'                   , 'spg_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f16d1-9400-7232-b2ee-f5a46a75c5d3', 31, 1, 'Name'                , 'spg_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    ,('019f16d1-9400-7a7c-b866-b27b9c351f4d', 31, 2, 'Short'               , 'spg_short'         , NULL                  , 'Text', 10.00 , 'Left', true , true , 'system')
    -- ============ BRANCHES (id 32) ============
    ,('019f16f9-dd5b-7e3b-ab15-ee2db399a86b', 32, 0, '#'                   , 'br_id'             , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f16f9-dd5c-7cec-9d53-9a363bb595a5', 32, 1, 'Branch Name'         , 'br_name'           , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    ,('019f16f9-dd5d-7682-8a3b-b75e6a1bbae1', 32, 2, 'Code'                , 'br_code'           , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    ,('019f16f9-dd5e-7038-8525-d660fa0fc66c', 32, 3, 'Short'               , 'br_short'          , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    -- ============ CUSTOMER GROUPS (id 33) ============
    ,('019f18b0-9ac4-7fc6-8851-463383885544', 33, 0, '#'                   , 'cgr_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f18b0-9ac5-7c6d-895f-db6cb477673d', 33, 1, 'Name'                , 'cgr_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    ,('019f18b0-9ac6-740c-a5fb-b76cd5609006', 33, 2, 'Alias Name'          , 'cgr_alias'         , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f18b0-9ac6-7b44-8b9d-3c1ae61d659c', 33, 3, 'Short'               , 'cgr_short'         , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    -- ============ PRICE LEVELS (id 34) ============
    ,('019f18c4-8465-7c97-a961-90e2449e2192', 34, 0, '#'                   , 'ipl_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f18c4-8466-7a98-850f-94b645a403e2', 34, 1, 'Level Name'          , 'ipl_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ SUPPLIERS (id 35) ============
    ,('019f2670-33e6-72f5-8bd2-84869cd8e6a4', 35, 0, '#'                   , 'sup_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f2670-33ea-7a33-bd61-cda44bec76d0', 35, 1, 'Short'               , 'sup_short'         , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    ,('019f2670-33eb-755c-85dd-0792df0edd4d', 35, 2, 'Supplier Name'       , 'sup_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    ,('019f2670-33ec-70a3-bff9-3d6d0ffaef0e', 35, 3, 'Regional Name'       , 'sup_region_name'   , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    -- ============ TAXES (id 36) ============
    ,('019f2684-f8d4-7e17-bc99-e8fde753f536', 36, 0, '#'                   , 'tax_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f2684-f8d5-7c13-afea-fc48d521faa0', 36, 1, 'Tax Name'            , 'tax_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ HSN/SAC CODES (id 37) ============
    ,('019f2688-4da2-7408-a94a-4625fc338a71', 37, 0, '#'                   , 'hsn_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f2688-4da3-71e1-84a2-47c8f4d58943', 37, 1, 'Code'                , 'hsn_code'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    ,('019f2688-4da3-7a78-ac1a-e20fe9e26e2b', 37, 2, 'Description'         , 'hsn_name'          , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    -- ============ EMPLOYEES (id 38) ============
    ,('019f4bf2-1c10-791d-bc6f-2598730890eb', 38, 0, '#'                   , 'emp_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f4bf2-1c11-7997-b0c0-e73479c0c896', 38, 1, 'Code'                , 'emp_code'          , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    ,('019fcafb-6802-73fe-8cc3-f6594ec740df', 38, 2, 'Employee'            , 'emp_name'          , NULL                  , 'Text', 100.00, 'Left', false, true , 'system')
    ,('019fcafb-6802-7d23-a9aa-dda16fce0f53', 38, 3, 'Alias Name'          , 'emp_alias'         , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    -- ============ CUSTOMERS (id 39) ============
    ,('019f514e-9a4d-7366-96e8-b82f2bc280a2', 39, 0, '#'                   , 'cus_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f514e-9a4e-7487-8c61-da33defd3ef4', 39, 1, 'Customer'            , 'cus_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ EMP DESIGNATIONS (id 40) ============
    ,('019f8312-4786-71eb-8278-ea933c8ec83d', 40, 0, '#'                   , 'ed_id'             , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f8312-4787-7229-947a-88407c626bcd', 40, 1, 'Designation'         , 'ed_name'           , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ EMP DEPARTMENTS (id 41) ============
    ,('019f8313-f317-72d5-b276-dd31876b6617', 41, 0, '#'                   , 'edpt_id'           , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f8313-f317-7c8a-a01a-7faa41c95804', 41, 1, 'Department'          , 'edpt_name'         , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ ITEMS (id 42) ============
    ,('019f8d9d-a062-77e4-a9fc-7b2005015eb5', 42, 0, '#'                   , 'item_id'           , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f8d9d-a063-774c-a599-1797e9a472fb', 42, 1, 'Code'                , 'item_code'         , NULL                  , 'Text', 0.00  , 'Left', false, true , 'system')
    ,('019f8d9d-a064-7194-b1c1-4c0abeb1593c', 42, 2, 'Name'                , 'item_name_en'      , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ LEDGERS - ALL (id 43) ============
    ,('019f934e-a9ce-7901-a3e4-9c79e6bf4a9c', 43, 0, '#'                   , 'led_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019f934e-a9cf-7a3a-9d0b-848a06b0ecf4', 43, 1, 'Short'               , 'led_short'         , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    ,('019f934e-a9d0-7241-9be6-9124894da867', 43, 2, 'Ledger'              , 'led_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ TENDER TYPES (id 44) ============
    ,('019fb82f-460f-75c2-aebd-0ead978357c0', 44, 0, '#'                   , 'ttm_type_id'       , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019fb82f-4614-781c-b245-1d592d6b8cde', 44, 1, 'Type'                , 'ttm_display_name'  , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ SALES AGENTS (id 45) ============
    ,('019fcaf6-b148-7e6b-9028-143583dcad30', 45, 0, '#'                   , 'sa_id'             , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019fcaf6-b149-7f48-92f1-980769efc20d', 45, 1, 'Code'                , 'sa_code'           , NULL                  , 'Text', 10.00 , 'Left', false, true , 'system')
    ,('019fcaf6-b14a-7877-ba96-d1821605ef58', 45, 2, 'Agent'               , 'sa_name'           , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ INDIAN BANKS LIST (id 46) ============
    ,('019fcbd2-6554-73cc-a08d-6ba8fec791cd', 46, 0, '#'                   , 'bnk_name'          , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('019fcbd2-6554-7db6-842a-e1d000077b77', 46, 1, 'Name'                , 'bnk_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    -- ============ PRINT PURPOSES (id 47) ============
    ,('01a04345-0e1a-7a92-b83d-afbf321bce1a', 47, 0, '#'                   , 'ppo_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('01a04345-0e1b-74a8-b2d1-cc868b3c4593', 47, 1, 'Code'                , 'ppo_code'          , NULL                  , 'Text', 30.00 , 'Left', true , true , 'system')
    ,('01a04345-0e1b-7c83-beca-c6e82a17abee', 47, 2, 'Purpose'             , 'ppo_name'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
    ,('01a04345-0e1c-735d-9987-06337f83b50a', 47, 3, 'Module'              , 'ppo_src_module'    , NULL                  , 'Text', 30.00 , 'Left', true , true , 'system')
    -- ============ PRINT PURPOSES - DESKTOP (id 48) ============
    ,('01a04345-4501-720d-be0d-5e9ac70cf4e4', 48, 0, '#'                   , 'ppo_id'            , NULL                  , 'Text', 10.00 , 'Left', false, false, 'system')
    ,('01a04345-4501-7cc4-b8f3-a0b893685c36', 48, 1, 'Code'                , 'ppo_code'          , NULL                  , 'Text', 100.00, 'Left', true , true , 'system')
) AS v(dropdown_columns_id, dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_name, dropdown_columns_sql_name, dropdown_columns_alias, dropdown_columns_data_type, dropdown_columns_width, dropdown_columns_allignment, dropdown_columns_visiblity, dropdown_columns_filter, dropdown_columns_created_by)
WHERE NOT EXISTS (
  SELECT 1 FROM fixed.dropdown_columns existing
   WHERE existing.dropdown_columns_dropdown_id = v.dropdown_columns_dropdown_id
)
ON CONFLICT (dropdown_columns_id) DO NOTHING;

COMMIT;
