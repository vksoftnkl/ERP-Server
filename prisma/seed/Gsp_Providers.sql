-- Seed: the GST Suvidha Provider catalogue — public.gst_provider and the six
-- configuration tables that hang off it (20260921120000_add_gst_provider_integration).
--
-- Two providers, deliberately of opposite shapes, so that the file doubles as the
-- worked example for adding a third:
--
--   NIC        — the DIRECT case. No middleman, so NO gst_provider_account row at
--                all: the only credential is the per-GSTIN AppKey on
--                gst_company_credential. WE encrypt the payload (AES_SEK).
--                ACTIVE, sandbox only.
--
--   CHARTERED  — the WRAPPER case (Chartered Information Systems / TaxPro GSP).
--                ONE account row covering every service they sell, then one
--                gst_provider_service row per service because the base URL and the
--                auth style differ per service even when the account does not.
--                INACTIVE — see below.
--
-- Nothing secret is seeded. Every *_enc column stays NULL: they hold ciphertext and
-- only the application, holding the key, may write them. Both CHARTERED accounts are
-- placeholders carrying the account reference and a remark saying which field goes
-- where.
--
-- CHARTERED ships INACTIVE (gpv_is_active = false, and false on every service,
-- endpoint and account below it). Two things are missing and neither is in their
-- documentation:
--   1. your aspid and ASP password, issued under the contract
--   2. the /dec/ decision — plaintext to Chartered, or AES_SEK encrypted our side
-- Activate only once both are settled:
--   UPDATE public.gst_provider SET gpv_is_active = true WHERE gpv_code = 'CHARTERED';
--   -- and the matching service / endpoint / account rows.
--
-- Paths for NIC follow the e-invoice API 1.03/1.04 spec; the CHARTERED values are from
-- their public documentation at gsthelp.charteredinfo.com. Confirm both against the
-- provider's live documentation before production use — a wrong path fails at a
-- counter. The twelve e-way bill rows carry the literal placeholder '/CONFIRM-PATH'
-- for exactly that reason: their docs never print the path, so it is not guessed.
--
-- Idempotent: the whole block is a no-op once provider NIC exists, so it is safe to
-- re-run on every deploy. To re-seed from scratch, delete the two providers first —
-- every table below cascades from gst_provider.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Gsp_Providers.sql
--      or: npm run seed:run -- --only=Gsp_Providers.sql

DO $seed$
DECLARE
    v_user     constant character varying(50) := 'SYSTEM';
    v_gpv_id   uuid;
    v_gsp2_id  uuid;
    v_gps_id   uuid;
    v_gps2_id  uuid;
    v_gen2_id  uuid;
    v_gps3_id  uuid;
    v_ewb_id   uuid;
    v_auth_id  uuid;
    v_gen_id   uuid;
    v_cancel_id uuid;
BEGIN
    -- Already seeded? Leave it alone; this file is re-runnable.
    SELECT gpv_id INTO v_gpv_id FROM public.gst_provider WHERE gpv_code = 'NIC';
    IF FOUND THEN
        RAISE NOTICE 'GSP seed skipped — provider NIC already present.';
        RETURN;
    END IF;

    INSERT INTO public.gst_provider
        (gpv_code, gpv_name, gpv_portal_url, gpv_timeout_ms, gpv_max_retries,
         gpv_remarks, gpv_created_by)
    VALUES
        ('NIC', 'NIC e-Invoice / e-Way Bill (direct)',
         'https://einvoice1.gst.gov.in', 45000, 2,
         'Government IRP. Payload encryption is ours to do: AppKey wrapped with the IRP public key, replies decrypted with the Sek.',
         v_user)
    RETURNING gpv_id INTO v_gpv_id;

    INSERT INTO public.gst_provider_service
        (gps_gpv_id, gps_service, gps_environment, gps_base_url,
         gps_auth_scheme, gps_token_ttl_minutes,
         gps_payload_encryption, gps_created_by)
    VALUES
        (v_gpv_id, 'EINVOICE', 'SANDBOX',
         'https://einv-apisandbox.nic.in',
         'NIC_SEK', 360, 'AES_SEK', v_user)
    RETURNING gps_id INTO v_gps_id;
    -- The auth call itself is the AUTH endpoint row seeded below.

    -- ── AUTH ─────────────────────────────────────────────────────────────
    INSERT INTO public.gst_provider_endpoint
        (gpe_gps_id, gpe_action, gpe_http_method, gpe_path_template,
         gpe_headers, gpe_redact_paths, gpe_response_root_path,
         gpe_success_path, gpe_success_value,
         gpe_error_code_path, gpe_error_message_path,
         gpe_is_idempotent, gpe_created_by)
    VALUES
        (v_gps_id, 'AUTH', 'POST', '/eivital/v1.04/auth',
         '{"Gstin":"{gstin}","client_id":"{clientId}","client_secret":"{clientSecret}"}'::jsonb,
         -- The auth body carries the portal password and the AppKey, and the
         -- header carries the client secret. All three are blanked before the
         -- exchange is written to public.gst_api_log.
         '["$.Data","$.Password","$.UserPwd","$.AppKey","$.client_secret"]'::jsonb,
         '$.Data', '$.Status', '1',
         '$.ErrorDetails[0].ErrorCode', '$.ErrorDetails[0].ErrorMessage',
         true, v_user)
    RETURNING gpe_id INTO v_auth_id;

    INSERT INTO public.gst_provider_field_map
        (gfm_gpe_id, gfm_direction, gfm_our_field, gfm_their_path,
         gfm_data_type, gfm_transform, gfm_is_required, gfm_sort_order,
         gfm_created_by)
    VALUES
        (v_auth_id, 'RESPONSE', 'auth_token',  '$.AuthToken', 'TEXT',     'NONE',         true,  10, v_user),
        (v_auth_id, 'RESPONSE', 'session_key', '$.Sek',       'TEXT',     'NONE',         true,  20, v_user),
        (v_auth_id, 'RESPONSE', 'expires_on',  '$.TokenExpiry','DATETIME','DATETIME_NIC', false, 30, v_user);

    -- ── GENERATE_IRN ─────────────────────────────────────────────────────
    INSERT INTO public.gst_provider_endpoint
        (gpe_gps_id, gpe_action, gpe_http_method, gpe_path_template,
         gpe_headers, gpe_redact_paths, gpe_request_wrapper, gpe_response_root_path,
         gpe_success_path, gpe_success_value,
         gpe_error_code_path, gpe_error_message_path,
         gpe_is_idempotent, gpe_remarks, gpe_created_by)
    VALUES
        (v_gps_id, 'GENERATE_IRN', 'POST', '/eicore/v1.03/Invoice',
         '{"Gstin":"{gstin}","user_name":"{loginId}","AuthToken":"{authToken}"}'::jsonb,
         '["$.AuthToken"]'::jsonb,
         'Data', '$.Data', '$.Status', '1',
         '$.ErrorDetails[0].ErrorCode', '$.ErrorDetails[0].ErrorMessage',
         false,
         'NOT idempotent: a reply that never arrived may still have minted an IRN. Recover with GET_IRN_BY_DOC, never a second generate.',
         v_user)
    RETURNING gpe_id INTO v_gen_id;

    -- The response map — this is the part that fills the ERP.
    INSERT INTO public.gst_provider_field_map
        (gfm_gpe_id, gfm_direction, gfm_our_field, gfm_their_path,
         gfm_data_type, gfm_transform, gfm_is_required,
         gfm_target_column, gfm_sort_order, gfm_created_by)
    VALUES
        (v_gen_id, 'RESPONSE', 'irn',            '$.Irn',          'TEXT',     'NONE',         true,  'gde_irn',            10, v_user),
        (v_gen_id, 'RESPONSE', 'ack_no',         '$.AckNo',        'TEXT',     'NONE',         true,  'gde_ack_no',         20, v_user),
        (v_gen_id, 'RESPONSE', 'ack_on',         '$.AckDt',        'DATETIME', 'DATETIME_NIC', true,  'gde_ack_on',         30, v_user),
        (v_gen_id, 'RESPONSE', 'signed_invoice', '$.SignedInvoice','TEXT',     'NONE',         false, 'gde_signed_invoice', 40, v_user),
        (v_gen_id, 'RESPONSE', 'signed_qrcode',  '$.SignedQRCode', 'TEXT',     'NONE',         false, 'gde_signed_qrcode',  50, v_user),
        (v_gen_id, 'RESPONSE', 'qrcode',         '$.QRCodeUrl',    'TEXT',     'NONE',         false, 'gde_qrcode',         60, v_user),
        -- e-way details ride along when the invoice asks for them.
        (v_gen_id, 'RESPONSE', 'ewb_no',         '$.EwbNo',        'TEXT',     'NONE',         false, 'gdw_no',             70, v_user),
        (v_gen_id, 'RESPONSE', 'ewb_valid_upto', '$.EwbValidTill', 'DATETIME', 'DATETIME_NIC', false, 'gdw_valid_upto',     80, v_user);

    -- ── CANCEL_IRN ───────────────────────────────────────────────────────
    INSERT INTO public.gst_provider_endpoint
        (gpe_gps_id, gpe_action, gpe_http_method, gpe_path_template,
         gpe_headers, gpe_redact_paths, gpe_request_wrapper, gpe_response_root_path,
         gpe_success_path, gpe_success_value,
         gpe_error_code_path, gpe_error_message_path,
         gpe_is_idempotent, gpe_remarks, gpe_created_by)
    VALUES
        (v_gps_id, 'CANCEL_IRN', 'POST', '/eicore/v1.03/Invoice/Cancel',
         '{"Gstin":"{gstin}","user_name":"{loginId}","AuthToken":"{authToken}"}'::jsonb,
         '["$.AuthToken"]'::jsonb,
         'Data', '$.Data', '$.Status', '1',
         '$.ErrorDetails[0].ErrorCode', '$.ErrorDetails[0].ErrorMessage',
         true,
         'The IRP window is 24 hours from AckDt. Past that the document is credit-noted, not cancelled.',
         v_user)
    RETURNING gpe_id INTO v_cancel_id;

    -- NOTE: gde_cancelled_on, TWO l's, as of
    -- 20260922020000_reconcile_doc_einvoice_ewaybill. The deployed table used
    -- to spell it with one, which is why this seed once said gde_canceled_on;
    -- that migration renamed the column to the house spelling every other
    -- table in the schema uses, and repointed the row this seed had already
    -- written. gfm_target_column is read straight into an UPDATE, so the wrong
    -- spelling fails at run time on the one call nobody exercises until a bill
    -- has to be pulled back.
    INSERT INTO public.gst_provider_field_map
        (gfm_gpe_id, gfm_direction, gfm_our_field, gfm_their_path,
         gfm_data_type, gfm_transform, gfm_is_required,
         gfm_target_column, gfm_sort_order, gfm_created_by)
    VALUES
        (v_cancel_id, 'RESPONSE', 'irn',          '$.Irn',         'TEXT',     'NONE',         true,  'gde_irn',         10, v_user),
        (v_cancel_id, 'RESPONSE', 'cancelled_on', '$.CancelDate',  'DATETIME', 'DATETIME_NIC', false, 'gde_cancelled_on', 20, v_user);

    -- ── Error map ────────────────────────────────────────────────────────
    -- 2150 is the one that matters: the IRP refuses the duplicate AND hands
    -- back the IRN it already issued. Treated as an error it strands a
    -- printed bill; mapped here it becomes a normal outcome.
    INSERT INTO public.gst_provider_error_map
        (gem_gpv_id, gem_service, gem_their_code, gem_our_code, gem_message,
         gem_treat_as, gem_extract_path, gem_canonical_field,
         gem_is_retryable, gem_retry_after_seconds, gem_should_reauth,
         gem_recovery_action, gem_severity, gem_created_by)
    VALUES
        -- Not an error. The IRP declines the duplicate and returns the IRN it
        -- issued the first time, in InfoDtls. Harvest it and the document
        -- completes; call it a failure and somebody re-keys a printed bill.
        (v_gpv_id, 'EINVOICE', '2150', 'DUPLICATE_IRN',
         'This invoice already has an IRN. The existing one has been recorded.',
         'SUCCESS', '$.InfoDtls[0].Desc.Irn', 'irn',
         false, NULL, false, 'NONE', 'WARN', v_user),

        (v_gpv_id, 'EINVOICE', '2172', 'DUPLICATE_IRN',
         'An IRN already exists for this document number.',
         'SUCCESS', '$.InfoDtls[0].Desc.Irn', 'irn',
         false, NULL, false, 'NONE', 'WARN', v_user),

        (v_gpv_id, 'EINVOICE', '1005', 'TOKEN_EXPIRED',
         'The session with the portal expired. Signing in again.',
         'ERROR', NULL, NULL,
         false, NULL, true,  'REAUTH', 'INFO', v_user),

        (v_gpv_id, NULL,       '1002', 'AUTH_FAILED',
         'The portal rejected the user name or password for this GSTIN.',
         'ERROR', NULL, NULL,
         false, NULL, false, 'MANUAL', 'ERROR', v_user),

        (v_gpv_id, NULL,       '1003', 'IP_NOT_WHITELISTED',
         'This counter''s IP address is not registered with the portal for this GSTIN.',
         'ERROR', NULL, NULL,
         false, NULL, false, 'MANUAL', 'ERROR', v_user),

        (v_gpv_id, 'EINVOICE', '2283', 'CANCEL_WINDOW_EXPIRED',
         'The 24-hour cancellation window has closed. Raise a credit note instead.',
         'ERROR', NULL, NULL,
         false, NULL, false, 'MANUAL', 'ERROR', v_user),

        (v_gpv_id, 'EWAYBILL', '312',  'DUPLICATE_EWB',
         'An e-way bill already exists for this document.',
         'SUCCESS', '$.InfoDtls[0].Desc.EwbNo', 'ewb_no',
         false, NULL, false, 'NONE', 'WARN', v_user),

        (v_gpv_id, NULL,       '429',  'RATE_LIMITED',
         'The portal is rate limiting us. Retrying shortly.',
         'ERROR', NULL, NULL,
         true,  30,   false, 'BACKOFF', 'WARN', v_user);

    -- ── A wrapper GSP, for contrast ──────────────────────────────────────
    -- NIC above is the direct case: no middleman, so NO gst_provider_account
    -- row — the only credential is the per-GSTIN AppKey. A commercial GSP is
    -- the other shape: ONE account row covering every service it sells you,
    -- then one gst_provider_service row per service because the base URL and
    -- auth style differ per service even when the account does not.
    INSERT INTO public.gst_provider
        (gpv_code, gpv_name, gpv_portal_url, gpv_timeout_ms, gpv_remarks,
         gpv_is_active, gpv_created_by)
    VALUES ('CHARTERED', 'Chartered Information Systems (TaxPro GSP)',
            'https://taxprogsp.co.in', 45000,
            'Wrapper GSP — e-invoice, e-way bill and returns on one account. '
            'NIC allows only 5 auth calls per 15 minutes per GSTIN before blocking '
            'for 15 minutes, which is what the gst_auth_session lease protects.',
            false, v_user)
    RETURNING gpv_id INTO v_gsp2_id;

    -- ONE account, gpa_service NULL = covers everything they sell. Secrets stay
    -- NULL: the columns hold ciphertext and only the application can write it.
    INSERT INTO public.gst_provider_account
        (gpa_gpv_id, gpa_environment, gpa_service, gpa_account_ref,
         gpa_remarks, gpa_is_active, gpa_created_by)
    VALUES (v_gsp2_id, 'PRODUCTION', NULL, '<aspid issued by Chartered>',
            'aspid + ASP password go in gpa_client_id_enc / gpa_client_secret_enc.',
            false, v_user),
           (v_gsp2_id, 'SANDBOX',    NULL, '<sandbox aspid>',
            'Sandbox access is requested separately from Chartered.',
            false, v_user);

    -- Base URL is host only. Chartered versions eivital (v1.04) and eicore
    -- (v1.03) independently, so the version travels in gpe_path_template.
    -- Sandbox is plain http in their documentation; production is https.
    INSERT INTO public.gst_provider_service
        (gps_gpv_id, gps_service, gps_environment, gps_base_url, gps_fallback_urls,
         gps_auth_scheme, gps_payload_encryption, gps_token_ttl_minutes,
         gps_remarks, gps_is_active, gps_created_by)
    VALUES
        (v_gsp2_id, 'EINVOICE', 'SANDBOX',
         'http://gstsandbox.charteredinfo.com', NULL,
         'NIC_SEK', 'NONE', 360,
         'PASSTHROUGH: their e-invoice URLs are byte-for-byte the IRP''s — same '
         'headers, body, query — only the host differs, and they inject their '
         'ClientID server-side. Any path still missing comes from NIC''s IRP '
         'v1.03 spec, never invented. NIC_SEK + NONE is deliberate: authenticate '
         'NIC-style, but POST plaintext to /eicore/dec/ where Chartered encrypts '
         'for you. Drop /dec/ and this becomes AES_SEK, handled our side.',
         false, v_user),
        (v_gsp2_id, 'EINVOICE', 'PRODUCTION',
         'https://einvapi.charteredinfo.com',
         ARRAY['https://einvapimum1.charteredinfo.com',
               'https://einvapidel2.charteredinfo.com'],
         'NIC_SEK', 'NONE', 360,
         'Fallback hosts are Chartered''s published Mumbai and Delhi clusters.',
         false, v_user),
        (v_gsp2_id, 'EWAYBILL', 'SANDBOX',
         'http://gstsandbox.charteredinfo.com', NULL,
         'NIC_SEK', 'NONE', 360,
         'e-way bill by IRN lives under /eiewb/v1.03; cancel EWB under /v1.03. '
         'Standalone e-way bill is a separate API set — see their EWB guide.',
         false, v_user),
        (v_gsp2_id, 'EWAYBILL', 'PRODUCTION',
         'https://einvapi.charteredinfo.com',
         ARRAY['https://einvapimum1.charteredinfo.com',
               'https://einvapidel2.charteredinfo.com'],
         'NIC_SEK', 'NONE', 360, NULL, false, v_user);

    SELECT gps_id INTO v_gps2_id FROM public.gst_provider_service
     WHERE gps_gpv_id = v_gsp2_id AND gps_service = 'EINVOICE'
       AND gps_environment = 'SANDBOX';

    -- ── The two calls their documentation gives in full ──────────────────
    -- Every request carries these five headers; the auth body additionally
    -- carries the password, so both are redacted before the log is written.
    INSERT INTO public.gst_provider_endpoint
        (gpe_gps_id, gpe_action, gpe_http_method, gpe_path_template, gpe_query_template,
         gpe_headers, gpe_redact_paths,
         gpe_success_path, gpe_success_value,
         gpe_error_code_path, gpe_error_message_path,
         gpe_is_idempotent, gpe_remarks, gpe_is_active, gpe_created_by)
    VALUES
        (v_gps2_id, 'AUTH', 'GET', '/eivital/v1.04/auth', NULL,
         '{"aspid":"{aspId}","password":"{aspPassword}","Gstin":"{gstin}","user_name":"{loginId}"}'::jsonb,
         '["$.password","$.AppKey","$.Data"]'::jsonb,
         '$.status_cd', '1', '$.error_cd', '$.message',
         true,
         'Token lives 360 minutes. NIC blocks the GSTIN after 5 auth calls in '
         '15 minutes — never call this per request, take the gas_lock lease.',
         false, v_user),
        (v_gps2_id, 'GENERATE_IRN', 'POST', '/eicore/dec/v1.03/Invoice', '?QrCodeSize=250',
         '{"Gstin":"{gstin}","user_name":"{loginId}","AuthToken":"{authToken}","aspid":"{aspId}","password":"{aspPassword}","irp":"{irpCode}"}'::jsonb,
         '["$.AuthToken","$.password"]'::jsonb,
         '$.status_cd', '1', '$.error_cd', '$.message',
         false,
         'The /dec/ segment is the plaintext variant; QrCodeSize is theirs, not NIC''s. '
         'The irp header selects the portal: NIC1 or NIC2, same URL either way. '
         'gde_irp_code does NOT have to be guessed afterwards — the FIRST CHARACTER '
         'of AckNo tells you which portal issued it, 1 = NIC1 and 2 = NIC2.',
         false, v_user);

    -- TODO, from their published API list — action and METHOD are confirmed,
    -- only the path is missing, so these are one INSERT each once you have it:
    --   CANCEL_IRN     POST   ·  GET_IRN            GET
    --   VERIFY_GSTIN   GET    ·  SYNC_GSTIN         GET
    --   GET_IRN_BY_DOC GET    ·  HEALTH             GET
    --   GENERATE_EWB_BY_IRN POST  ·  CANCEL_EWB     POST
    --   GET_EWB        GET

    -- ── Response map for GENERATE_IRN ────────────────────────────────────
    -- Field names are from their RespPlGenIRN model, which is flat: no Data
    -- wrapper around the payload. Get-eInvoice-Detail returns the same shape,
    -- so this map is reusable for GET_IRN verbatim.
    SELECT gpe_id INTO v_gen2_id FROM public.gst_provider_endpoint
     WHERE gpe_gps_id = v_gps2_id AND gpe_action = 'GENERATE_IRN';

    INSERT INTO public.gst_provider_field_map
        (gfm_gpe_id, gfm_direction, gfm_our_field, gfm_their_path,
         gfm_data_type, gfm_transform, gfm_format_mask, gfm_is_required,
         gfm_target_column, gfm_sort_order, gfm_created_by)
    VALUES
        (v_gen2_id,'RESPONSE','irn',           '$.Irn',           'TEXT',    'NONE',         NULL,                    true,  'gde_irn',           10,v_user),
        (v_gen2_id,'RESPONSE','ack_no',        '$.AckNo',         'TEXT',    'NONE',         NULL,                    true,  'gde_ack_no',        20,v_user),
        (v_gen2_id,'RESPONSE','ack_on',        '$.AckDt',         'DATETIME','DATETIME_NIC', NULL,                    true,  'gde_ack_on',        30,v_user),
        (v_gen2_id,'RESPONSE','signed_invoice','$.SignedInvoice', 'TEXT',    'NONE',         NULL,                    false, 'gde_signed_invoice',40,v_user),
        (v_gen2_id,'RESPONSE','signed_qrcode', '$.SignedQRCode',  'TEXT',    'NONE',         NULL,                    false, 'gde_signed_qrcode', 50,v_user),
        (v_gen2_id,'RESPONSE','doc_status',    '$.Status',        'TEXT',    'NONE',         NULL,                    false, NULL,                60,v_user),
        -- e-way details ride along when the invoice asks for them. Note the
        -- 12-hour clock: this is the reason DATETIME_MASK exists.
        (v_gen2_id,'RESPONSE','ewb_no',        '$.EwbNo',         'TEXT',    'NONE',         NULL,                    false, 'gdw_no',            70,v_user),
        (v_gen2_id,'RESPONSE','ewb_on',        '$.EwbDt',         'DATETIME','DATETIME_MASK','dd/MM/yyyy hh:mm:ss a', false, 'gdw_generated_on',  80,v_user),
        (v_gen2_id,'RESPONSE','ewb_valid_upto','$.EwbValidTill',  'DATETIME','DATETIME_MASK','dd/MM/yyyy hh:mm:ss a', false, 'gdw_valid_upto',    90,v_user);

    -- ── Chartered's own gateway error codes, from their published table ──
    -- These sit ALONGSIDE the NIC codes seeded for the NIC provider above:
    -- a GSP* code is Chartered's gateway refusing, a numeric code is the IRP.
    INSERT INTO public.gst_provider_error_map
        (gem_gpv_id, gem_service, gem_their_code, gem_our_code, gem_message,
         gem_treat_as, gem_is_retryable, gem_retry_after_seconds,
         gem_should_reauth, gem_recovery_action, gem_severity, gem_created_by)
    VALUES
        (v_gsp2_id, NULL, 'GSP022', 'TOKEN_EXPIRED',
         'The session with the portal expired. Signing in again.',
         'ERROR', false, NULL, true,  'REAUTH', 'INFO', v_user),
        (v_gsp2_id, 'EWAYBILL', 'GSP102', 'TOKEN_EXPIRED',
         'The e-way bill session expired. Signing in again.',
         'ERROR', false, NULL, true,  'REAUTH', 'INFO', v_user),
        (v_gsp2_id, NULL, 'GSP025', 'RATE_LIMITED',
         'The provider is rate limiting us. Retrying shortly.',
         'ERROR', true,  30,   false, 'BACKOFF', 'WARN', v_user),
        (v_gsp2_id, NULL, 'GSP021', 'IP_NOT_WHITELISTED',
         'This counter''s IP address is not registered with the provider.',
         'ERROR', false, NULL, false, 'MANUAL', 'ERROR', v_user),
        (v_gsp2_id, NULL, 'GSP019', 'CREDIT_EXHAUSTED',
         'The e-invoice credit balance with the provider is exhausted. Billing cannot continue until it is topped up.',
         'ERROR', false, NULL, false, 'MANUAL', 'ERROR', v_user),
        (v_gsp2_id, NULL, 'GSP018', 'AUTH_FAILED',
         'The provider rejected the ASP password.',
         'ERROR', false, NULL, false, 'MANUAL', 'ERROR', v_user),
        (v_gsp2_id, NULL, 'GSP020A', 'AUTH_FAILED',
         'The provider rejected the ASP password.',
         'ERROR', false, NULL, false, 'MANUAL', 'ERROR', v_user),
        (v_gsp2_id, NULL, 'GSP024', 'AUTH_FAILED',
         'The account with the provider is not active. Contact them.',
         'ERROR', false, NULL, false, 'MANUAL', 'ERROR', v_user),
        (v_gsp2_id, NULL, 'GSP027', 'UPSTREAM_DOWN',
         'Network error reaching the provider. Retrying.',
         'ERROR', true,  20,   false, 'BACKOFF', 'WARN', v_user),
        (v_gsp2_id, NULL, 'GSP030', 'UPSTREAM_DOWN',
         'The provider could not reach the GST server. Retrying.',
         'ERROR', true,  30,   false, 'BACKOFF', 'WARN', v_user),
        (v_gsp2_id, NULL, 'GSP032', 'TIMEOUT',
         'The provider timed out. Checking before retrying.',
         'ERROR', true,  30,   false, 'FETCH_BY_DOC', 'WARN', v_user),
        (v_gsp2_id, NULL, 'GSP099', 'UPSTREAM_DOWN',
         'No response from the portal. Retrying.',
         'ERROR', true,  30,   false, 'BACKOFF', 'WARN', v_user),
        (v_gsp2_id, NULL, 'GSP500', 'UPSTREAM_DOWN',
         'The GST portal is unavailable. Retrying.',
         'ERROR', true,  60,   false, 'BACKOFF', 'WARN', v_user),
        (v_gsp2_id, 'EWAYBILL', 'GSP501', 'UPSTREAM_DOWN',
         'The e-way bill portal is unavailable. Retrying.',
         'ERROR', true,  60,   false, 'BACKOFF', 'WARN', v_user),
        (v_gsp2_id, NULL, 'GSP502', 'ENV_MISMATCH',
         'This call is only available in sandbox — the configuration points at the wrong environment.',
         'ERROR', false, NULL, false, 'MANUAL', 'ERROR', v_user),
        (v_gsp2_id, NULL, 'GSP503', 'ENV_MISMATCH',
         'This call is only available in production — the configuration points at the wrong environment.',
         'ERROR', false, NULL, false, 'MANUAL', 'ERROR', v_user),
        (v_gsp2_id, NULL, 'GSP050D', 'VALIDATION',
         'The provider could not decrypt the request. Check the payload-encryption setting.',
         'ERROR', false, NULL, false, 'MANUAL', 'ERROR', v_user);

    -- ── The three surfaces published with complete URLs ──────────────────
    -- Taxpayer search, return tracking and the ASP account calls live on a
    -- DIFFERENT host from e-invoice (gstapi, not einvapi) — which is the
    -- whole reason gps_base_url sits per service rather than per provider.
    INSERT INTO public.gst_provider_service
        (gps_gpv_id, gps_service, gps_environment, gps_base_url,
         gps_auth_scheme, gps_payload_encryption, gps_token_ttl_minutes,
         gps_remarks, gps_is_active, gps_created_by)
    VALUES
        (v_gsp2_id, 'GSTIN_VERIFY', 'PRODUCTION', 'https://gstapi.charteredinfo.com',
         'API_KEY', 'NONE', 360, 'Public search API — no taxpayer login needed.', false, v_user),
        (v_gsp2_id, 'GSTIN_VERIFY', 'SANDBOX',    'http://gstsandbox.charteredinfo.com',
         'API_KEY', 'NONE', 360, NULL, false, v_user),
        (v_gsp2_id, 'GSTR', 'PRODUCTION', 'https://gstapi.charteredinfo.com',
         'API_KEY', 'NONE', 360, 'Return-status tracking only; filing is a larger surface.', false, v_user),
        (v_gsp2_id, 'GSTR', 'SANDBOX',    'http://gstsandbox.charteredinfo.com',
         'API_KEY', 'NONE', 360, NULL, false, v_user),
        (v_gsp2_id, 'ASP_ADMIN', 'PRODUCTION', 'https://gstapi.charteredinfo.com',
         'API_KEY', 'NONE', 360,
         'Chartered''s own account surface. GET_API_BALANCE is the one that matters: '
         'it refreshes gpa_credit_balance before the IRN block runs out mid-morning.',
         false, v_user),
        (v_gsp2_id, 'ASP_ADMIN', 'SANDBOX',    'http://gstsandbox.charteredinfo.com',
         'API_KEY', 'NONE', 360, NULL, false, v_user);

    INSERT INTO public.gst_provider_endpoint
        (gpe_gps_id, gpe_action, gpe_http_method, gpe_path_template, gpe_query_template,
         gpe_success_path, gpe_success_value, gpe_error_code_path, gpe_error_message_path,
         gpe_is_idempotent, gpe_remarks, gpe_is_active, gpe_created_by)
    SELECT s.gps_id, x.act, x.mth, x.pth, x.qry,
           '$.status_cd', '1', '$.error_cd', '$.message', true, x.rem, false, v_user
      FROM (VALUES
        ('GSTIN_VERIFY','VERIFY_GSTIN','GET','/commonapi/v1.1/search',
         '?action=TP&gstin={gstin}&searchgstin={searchGstin}',
         'Fills the GSTIN fetch buttons on company, branch and customer.'),
        ('GSTR','GSTR_STATUS','GET','/commonapi/v1.0/Returns',
         '?action=RETTRACK&gstin={gstin}&fy={finYear}',
         'fy is YYYY-YY. Optional type=R1/R2 narrows it.'),
        ('ASP_ADMIN','GET_API_BALANCE','GET','/aspapi/v1.1/getapibalance', NULL,
         'Read on a schedule into gpa_credit_balance / gpa_balance_checked_on.'),
        ('ASP_ADMIN','GET_ERROR_LIST','GET','/aspapi/v1.0/getapisetting', NULL,
         'Provider settings. Their error catalogue is published on the site rather '
         'than by API, so gst_provider_error_map is seeded from there.')
      ) AS x(svc, act, mth, pth, qry, rem)
      JOIN public.gst_provider_service s
        ON s.gps_gpv_id = v_gsp2_id AND s.gps_service = x.svc
       AND s.gps_environment = 'PRODUCTION';

    -- ── e-way bill: NIC v1.03 passed through ─────────────────────────────
    -- Chartered's own docs point at docs.ewaybillgst.gov.in for the detail,
    -- so this is NIC's API wearing Chartered's host. It is shaped completely
    -- unlike the e-invoice side: ONE endpoint driven by an `action` query
    -- parameter, which is exactly what gpe_query_template is for.
    --
    -- The twelve action values below ARE verified from their request-sample
    -- page. The PATH is not — their docs never print it, and NIC's own site
    -- refuses automated access. So every row carries the unmistakable
    -- placeholder '/CONFIRM-PATH' and is inactive: replace it once, in one
    -- UPDATE, and all of them are live.
    SELECT gps_id INTO v_gps3_id FROM public.gst_provider_service
     WHERE gps_gpv_id = v_gsp2_id AND gps_service = 'EWAYBILL'
       AND gps_environment = 'SANDBOX';

    INSERT INTO public.gst_provider_endpoint
        (gpe_gps_id, gpe_action, gpe_http_method, gpe_path_template, gpe_query_template,
         gpe_headers, gpe_redact_paths, gpe_success_path, gpe_success_value,
         gpe_error_code_path, gpe_error_message_path, gpe_is_idempotent,
         gpe_remarks, gpe_is_active, gpe_created_by)
    SELECT v_gps3_id, a.act, a.mth, '/CONFIRM-PATH',
           CASE WHEN a.qry IS NULL THEN NULL ELSE '?action=' || a.qry END,
           '{"Gstin":"{gstin}","user_name":"{loginId}","AuthToken":"{authToken}","aspid":"{aspId}","password":"{aspPassword}"}'::jsonb,
           '["$.AuthToken","$.password"]'::jsonb,
           '$.status_cd', '1', '$.error_cd', '$.message', a.idem,
           'Action value verified from Chartered request samples; path pending.',
           false, v_user
      FROM (VALUES
        ('GENERATE_EWB',                'POST','GENEWAYBILL',      false),
        ('UPDATE_PART_B',               'POST','VEHEWB',           false),
        ('GENERATE_CONSOLIDATED_EWB',   'POST','GENCEWB',          false),
        ('CANCEL_EWB',                  'POST','CANEWB',           true ),
        ('REJECT_EWB',                  'POST','REJEWB',           true ),
        ('UPDATE_TRANSPORTER',          'POST','UPDATETRANSPORTER',true ),
        ('EXTEND_VALIDITY',             'POST','EXTENDVALIDITY',   false),
        ('REGENERATE_CONSOLIDATED_EWB', 'POST','REGENTRIPSHEET',   false),
        ('INIT_MULTI_VEHICLE',          'POST','MULTIVEHMOVINT',   false),
        ('ADD_MULTI_VEHICLE',           'POST','MULTIVEHADD',      false),
        ('CHANGE_MULTI_VEHICLE',        'POST','MULTIVEHUPD',      false),
        ('CLOSE_EWB',                   'POST','CLSEWB',           true ),
        ('GET_EWB',                     'GET', NULL,               true ),
        ('GET_API_BALANCE',             'GET', NULL,               true )
      ) AS a(act, mth, qry, idem);

    -- ── e-way bill response maps ─────────────────────────────────────────
    -- The same fact under three different names across three calls is why
    -- this table exists: generate returns ewayBillNo, get returns ewbNo, and
    -- both dates are a 12-hour clock unlike anything on the e-invoice side.
    SELECT gpe_id INTO v_ewb_id FROM public.gst_provider_endpoint
     WHERE gpe_gps_id = v_gps3_id AND gpe_action = 'GENERATE_EWB';

    INSERT INTO public.gst_provider_field_map
        (gfm_gpe_id, gfm_direction, gfm_our_field, gfm_their_path,
         gfm_data_type, gfm_transform, gfm_format_mask, gfm_is_required,
         gfm_target_column, gfm_sort_order, gfm_created_by)
    VALUES
        (v_ewb_id,'RESPONSE','ewb_no',        '$.ewayBillNo',  'TEXT',    'NONE',         NULL,                    true, 'gdw_no',           10,v_user),
        (v_ewb_id,'RESPONSE','ewb_on',        '$.ewayBillDate','DATETIME','DATETIME_MASK','dd/MM/yyyy hh:mm:ss a', false,'gdw_generated_on', 20,v_user),
        (v_ewb_id,'RESPONSE','ewb_valid_upto','$.validUpto',   'DATETIME','DATETIME_MASK','dd/MM/yyyy hh:mm:ss a', false,'gdw_valid_upto',   30,v_user),
        (v_ewb_id,'RESPONSE','alert',         '$.alert',       'TEXT',    'TRIM',         NULL,                    false, NULL,              40,v_user);

    SELECT gpe_id INTO v_ewb_id FROM public.gst_provider_endpoint
     WHERE gpe_gps_id = v_gps3_id AND gpe_action = 'GET_EWB';

    INSERT INTO public.gst_provider_field_map
        (gfm_gpe_id, gfm_direction, gfm_our_field, gfm_their_path,
         gfm_data_type, gfm_transform, gfm_format_mask, gfm_is_required,
         gfm_target_column, gfm_sort_order, gfm_created_by)
    VALUES
        -- NOT $.ewayBillNo — the same number, a different name on this call.
        (v_ewb_id,'RESPONSE','ewb_no',        '$.ewbNo',       'TEXT',    'NONE',         NULL,                    true, 'gdw_no',           10,v_user),
        (v_ewb_id,'RESPONSE','ewb_on',        '$.ewayBillDate','DATETIME','DATETIME_MASK','dd/MM/yyyy hh:mm:ss a', false,'gdw_generated_on', 20,v_user),
        (v_ewb_id,'RESPONSE','ewb_valid_upto','$.validUpto',   'DATETIME','DATETIME_MASK','dd/MM/yyyy hh:mm:ss a', false,'gdw_valid_upto',   30,v_user),
        (v_ewb_id,'RESPONSE','portal_status', '$.status',      'TEXT',    'NONE',         NULL,                    false, NULL,              40,v_user);

    SELECT gpe_id INTO v_ewb_id FROM public.gst_provider_endpoint
     WHERE gpe_gps_id = v_gps3_id AND gpe_action = 'UPDATE_PART_B';

    INSERT INTO public.gst_provider_field_map
        (gfm_gpe_id, gfm_direction, gfm_our_field, gfm_their_path,
         gfm_data_type, gfm_transform, gfm_format_mask, gfm_is_required,
         gfm_target_column, gfm_sort_order, gfm_created_by)
    VALUES
        (v_ewb_id,'RESPONSE','part_b_updated_on','$.vehUpdDate','DATETIME','DATETIME_MASK','dd/MM/yyyy hh:mm:ss a', false, NULL,            10,v_user),
        (v_ewb_id,'RESPONSE','ewb_valid_upto',   '$.validUpto', 'DATETIME','DATETIME_MASK','dd/MM/yyyy hh:mm:ss a', false,'gdw_valid_upto', 20,v_user);

    RAISE NOTICE 'GSP seed created: NIC e-invoice sandbox (provider %).', v_gpv_id;
    RAISE NOTICE 'GSP seed created: CHARTERED, INACTIVE — real URLs and error codes seeded; add aspid + ASP password, settle the /dec/ choice, then activate (provider %).', v_gsp2_id;
END
$seed$;
