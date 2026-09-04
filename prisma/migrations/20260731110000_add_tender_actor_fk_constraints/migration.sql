-- Tender tables: add the tenant/actor foreign keys that were declared in the
-- Prisma fragments (accountTenderMaster.prisma / accountTenderDetail.prisma)
-- but missing from 20260731080000 and 20260731090000.
--
-- acc_tender_detail is LIST-partitioned by td_acc_year: ADD CONSTRAINT on the
-- partitioned parent propagates to every existing and future partition.
--
-- Not added (no valid FK target — see the fragment comments):
--   td_tenant_id  — no tenant table
--   td_session_id — user_login_sessions.uls_session_id is nullable, not unique
--   td_device_id  — free text, not a device_master id
--   td_src_doc_id — polymorphic, target varies by td_src_module/td_src_doc_type

-- ── acc_tender_master ────────────────────────────────────────────────────────
ALTER TABLE accounts.acc_tender_master
    ADD CONSTRAINT fk_tnd_company FOREIGN KEY (tnd_company_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE accounts.acc_tender_master
    ADD CONSTRAINT fk_tnd_branch FOREIGN KEY (tnd_branch_id)
        REFERENCES public.branch_master (br_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE accounts.acc_tender_master
    ADD CONSTRAINT fk_tnd_bank_account FOREIGN KEY (tnd_bank_account_id)
        REFERENCES accounts.acc_ledger_bank_accounts (lba_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- ── acc_tender_detail ────────────────────────────────────────────────────────
ALTER TABLE accounts.acc_tender_detail
    ADD CONSTRAINT fk_td_company FOREIGN KEY (td_company_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE accounts.acc_tender_detail
    ADD CONSTRAINT fk_td_branch FOREIGN KEY (td_branch_id)
        REFERENCES public.branch_master (br_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE accounts.acc_tender_detail
    ADD CONSTRAINT fk_td_user FOREIGN KEY (td_user_id)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE accounts.acc_tender_detail
    ADD CONSTRAINT fk_td_settle_voucher FOREIGN KEY (td_settle_voucher_id)
        REFERENCES accounts.acc_voucher_header (avh_voucher_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE SET NULL;
