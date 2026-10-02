# GST — the GSP layer (first slice: config)

The routes the **GST Providers** and **GST Credentials** screens call (notes 79, R1–R9), on the
`public.gst_*` tables of migration `20260921120000`. The full design is the share's
`gst/plan-backend-gsp.md`. Document routes (IRN / EWB), the worker and the payload builders come
in later phases. `/gst/search` (GSTIN lookup) is a separate module (`settings/gstinLookup`).

## Routes (`/api/v1/gst/…`)

| # | Route | Right (menu) |
| --- | --- | --- |
| R1 | `POST providers/create` · `GET providers/get?gpvId=` · `POST providers/delete` · `POST providers/restore` | GST Providers |
| R2 | `POST provider-services/create` · `POST provider-services/delete` | GST Providers |
| R3 | `POST provider-endpoints/create` · `GET provider-endpoints/get?gpeId=` · `POST provider-endpoints/delete` | GST Providers |
| R4 | `POST provider-field-maps/create` · `POST provider-field-maps/delete` | GST Providers |
| R5 | `POST provider-error-maps/create` · `POST provider-error-maps/delete` | GST Providers |
| R6 | `POST provider-accounts/create` · `GET provider-accounts/get?gpaId=` · `POST provider-accounts/delete` | GST Providers |
| R7 | `POST company-credentials/create` · `GET …/get?gccId=` · `POST …/delete` · `POST …/restore` | GST Credentials |
| R8 | `POST company-credentials/verify { gccId }` | GST Credentials, **post** |
| R9 | `GET company-credentials/status?gccId=` | GST Credentials, view |

House rules: `create` is an upsert by id; `get` returns deleted rows too (for Restore); no
`/list` — the lists are grids (the credential grid reads `vw_gst_credential`); deletes are
soft; delete / restore / verify take their id in the body. Rights: `view` for get / status,
`create` (no id) or `edit` for a save, `delete`, `edit` for restore, `post` for verify — each a
403 `GST_RIGHT_<RIGHT>`. The two menus are found by (parent 60, name), never by id: migration
`20261002150000_gst_menus` inserts them hidden, and their ids come from the sequence.

Refusals are `{ success: false, message, errors: [{ field, message, code }] }`; the codes are
`GST_CODES` in [config/gst-config.constants.ts](config/gst-config.constants.ts).

## Secrets are write-only (notes 79 §3)

- **In:** `password` / `clientId` / `clientSecret` / `appKey` (credentials), `clientId` /
  `clientSecret` / `apiKey` (provider accounts). Absent or `""` keeps the stored value; a value
  is encrypted; `"clear": ["clientSecret"]` sets NULL (never `password`, which is NOT NULL).
- **Out:** never a value — `hasPassword`, `hasClientId`, … and `keyVersion`, in `get`, in the
  save response and in the audit row alike. The call log redacts too.
- **Keys (env):** `GST_CRED_KEY` = 32 bytes as 64 hex characters or base64 (generate one with
  `openssl rand -hex 32`); `GST_CRED_KEY_VERSION` (default 1); `GST_CRED_KEY_V<n>` = an older key,
  kept only to read values wrapped under it. A server without `GST_CRED_KEY` answers 503
  `GST_CRED_KEY_MISSING` to any save that carries a secret, and to Verify.
- `*_key_version` is the version of the key every secret of the row is wrapped under; each stored
  value also names its version (`gcm:v1:…`). Writing any secret re-wraps the row's others under
  the current key, so a rotation is "set the new key + version, keep the old as `_V<n>`, save
  each row once".

## Verify (R8)

One sign-in, described by rows: the AUTH endpoint of the credential's service (path, query,
headers with `{gstin}` `{loginId}` `{password}` `{clientId}` `{clientSecret}` `{aspId}`
`{aspPassword}` `{apiKey}` `{appKey}`), its RESPONSE field map (`auth_token`, `session_key`,
`expires_on`, `refresh_token`) and the provider's error map. `{clientId}` / `{clientSecret}` are
the credential's pair, else the provider account's; `{aspId}` / `{aspPassword}` are the account's
clientId / clientSecret. NIC's own scheme (`NIC_SEK` + `AES_SEK`/`RSA`) RSA-wraps the body with
the public key `<GST_PUBLIC_KEY_DIR, default ./certs/gst>/<gccPublicKeyRef>.pem` and opens the Sek
with the AppKey ([client/gst-nic-crypto.ts](client/gst-nic-crypto.ts)).

Refused **before** the portal is called: 422 for a missing secret / public key / AUTH endpoint /
GSTIN; 409 `GST_AUTH_BUSY` while another sign-in holds the `gst_auth_session` lease; 409
`GST_AUTH_RATE_LIMIT` after 4 sign-ins for the company + branch in 15 minutes (NIC blocks a GSTIN
at 5). A refusal BY the portal is `{ ok: false, message, errorCode }`. Success keeps the session
encrypted (a new row, the leased one retired, `gas_token_version` + 1) and stamps
`gcc_last_verified_on`; failure stamps `gcc_last_error_message`. Every attempt writes one redacted
`gst_api_log` row. Inactive providers / services / endpoints / accounts are allowed — Verify is
how a provider is tested before it is activated.

A credential save that changes who signs in (branch, provider, service, environment, login, any
secret, public key) and a credential delete retire its live session.

## Tests

- `src/modules/gst/**/*.spec.ts` — JSONPath, crypto + secret writer, NIC helpers, date parsing.
- `test/gst-config.e2e-spec.ts` — R1–R9 on the real DB in one rolled-back transaction, with a
  scripted NIC portal (RSA body, Sek, error map, lease, budget).
- `test/gst-config-http.e2e-spec.ts` — routes, validation and rights over HTTP; writes nothing.
