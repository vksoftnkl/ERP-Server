# whatsapp — WhatsApp option B, the ERP side

Plan: `Shared/Prathap/whatsapp/whatsapp-plan-v1-2026-11-17.md` §5. Keys: `Shared/Prathap/whatsapp/whatsapp-keys-2026-11-17.md`.
Relay API: `Shared/Prathap/whatsapp/wa-relay-keys-2026-11-17.md`. DB: migration `20261119100000_whatsapp`.

**Scope cut (user, 17/11/2026): ONE transaction now — the Sales Order confirmation** — plus the plumbing.
Bills, receipts, payment reminders (menu 308, gap / hours, the party statement PDF) and the customer
Message-language / opt-out edits come later. The DB already has everything for them (P1).

Every message goes through VK's **wa-relay** (`WA_RELAY_URL`). This server never holds a Meta token: only
the relay's install key, AES-256-GCM encrypted with `WA_CRED_KEY` (`wa_connection.wac_key_enc`,
`gcm:v<n>:`), never returned (only `keyPrefix`).

## Routes (`/api/v1/whatsapp/*`)

| Route | Right |
|---|---|
| GET connection/get · POST connection/refresh · POST connection/test | 307 View |
| POST connection/activate · connect-start · disconnect · rotate-key | 307 Edit |
| GET settings/get / POST settings/save (on-post tick: Sales Order only, per company: `whatsapp.on_post_types`) | 307 View / Edit |
| POST messages/send (Sales Order) | Print on 11 |
| POST messages/retry | 309 Post |
| The log: `/configured-grid-sql/run?grid_id=222` (registered grid, no `/list`) | grid rights |

## Files

| File | What |
|---|---|
| `wa-store.service.ts` | the wa_connection row, its key, the template mirror, rights (`WA_RIGHT_*`), the caller, IST dates |
| `wa-relay.client.ts` | `/v1/*` over fetch + FormData, 30 s timeout (60 s for `/v1/messages`); every failure → `WaRelayError` with the ERP code |
| `wa-crypto.service.ts` | `WA_CRED_KEY` envelope (GstCryptoService untouched) |
| `wa-connection.service.ts` | activate (409 `WA_ALREADY_ACTIVATED` unless `replace: true` — VK's re-key code), Connect, refresh, disconnect, rotate, test |
| `wa-send.service.ts` | the one send path: connection → order → number → consent → language → log row → PDF → relay → status step |
| `wa-after-post.service.ts` + `hook/wa-post-hook.ts` | WhatsApp on Post: a global hook the SO post calls AFTER its commit; never throws |
| `wa-events.service.ts` | pull + apply relay events (STATUS by rank, TAP, typed STOP), cursor in the same tx, lease |
| `wa-poller.service.ts` | 10 s tick: pulls when due (60 s / 10 s fast window / 5 min back-off), SENDING sweeper, daily retention |
| `wa-messages.service.ts` | hand send + retry (one transaction: chain root locked, latest try judged) |
| `wa-settings.service.ts` | whatsapp.* company settings, the "WhatsApp on Post" list `whatsapp.on_post_types` among them |
| `wa-phone.ts`, `wa-language.ts`, `wa-status.ts`, `wa-doc-facts.ts` | pure helpers (jest) |

## Rules worth knowing

- **Offline = fail at once** (Q12): no queue, no HELD. A relay that cannot be reached → row FAILED
  `WA_RELAY_UNREACHABLE`; the operator resends from the log (`/messages/retry`).
- **Send on Post never blocks or rolls back the post**: `SaleOrderLifecycleService.post / saveAndPost` call
  `WaPostHook.fire` after `$transaction` returned, only when THIS call confirmed the order (`confirmedNow`).
  Steps 1–6 run before the answer (`whatsapp: {wmlId, accYear, status: SENDING|SKIPPED|FAILED|NOT_CONNECTED}`);
  the PDF and the relay call run after it. `waOnPost` in the post body: absent = the company's
  `whatsapp.on_post_types` (a JSON list of voucher type ids, e.g. `[4]`; COMPANY, else GLOBAL, else `[]`; review S7),
  false = not this one, true = send.
- **PDF**: `PrintRenderService.renderForWhatsApp` — purpose SALE_ORDER, assignment WHATSAPP → PDF → PRINT,
  one copy, PDF, **no print_log row**. Design: `docs/print-templates/sale-order-a5/` (deploy needs the user's OK).
- **Statuses** apply by rank (SENDING < SENT < FAILED < DELIVERED < READ), each time set once: any order, idempotent.
- **Poller** runs only on a main server (not `CLOUD_SYNC_ENABLED`), only with `WA_CRED_KEY` + `WA_RELAY_URL` set,
  off under `NODE_ENV=test` unless `WA_POLL_IN_TEST=1`; a DB lease on wa_connection keeps the two dev APIs apart.
- Relay states map onto `ck_wac_state`: NEW / ACTIVE → ACTIVATED, CLOSED → SUSPENDED; a revoked key → SUSPENDED.
- **Review fixes (18/11):**
  - S3: `/v1/messages` waits 60 s. A relay 504 `RELAY_SEND_UNCONFIRMED` leaves the row **SENDING** (no "No internet",
    no retry while SENDING); the event poll settles it and files its status step, or the sweeper fails it after 10 min.
    A DELIVERED / READ that wins clears the error fields.
  - S4: `/messages/retry` locks the chain's first try `FOR UPDATE` and judges the LATEST try, in one transaction.
  - S5: a number typed in the send popup is marked in `wml_params` (`$typedInPopup: true`, never sent) and a retry
    passes it as the popup number again.
  - N5: the poll lease is not re-entrant, 300 s, and a pull starts no page after 120 s.
  - N6: the SENDING sweeper files WHATSAPP_FAILED on the document. Every send files at most one step per `wml_id`.
