-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 125 §2 — User Role (usr_type) takes the till approval levels' names
--  (2026-10-16). UserType gains STORE MANAGER · AREA MANAGER · HO FINANCE ·
--  CASH OFFICE (enum-only, no DB constraint) and loses MANAGER, so the users
--  holding it become STORE MANAGER — on the dev box VKSOFT and the deleted
--  harness user zt-role-4804-manager. A deleted row is renamed too, so a
--  revived one reads a role the enum knows. No seed file writes MANAGER.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.user_master
   SET usr_type = 'STORE MANAGER',
       usr_modified_on = now()
 WHERE usr_type = 'MANAGER';
