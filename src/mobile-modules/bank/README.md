# Mobile · Banks

`GET /api/v1/mobile/banks/list?deviceUid=`: the banks a phone cheque can be drawn on, for the
Bank dropdown of the React Native app (VKSMAN). The phone reads it at Sync and keeps it for
offline use. Swagger tag `Mobile · Banks`, docs page `/api/docs/mobile-banks`.

- **Auth:** `@OptionalAuth`, like the other mobile reads. The phone must be registered:
  `deviceUid` is required (400 without it). An unknown, blocked or switched-off phone gets a 403
  (`MOBILE_DEVICE_NOT_REGISTERED` / `_BLOCKED` / `_INACTIVE`).
- **Rows:** `fixed.bank_master` rows that are active (`bnk_is_active`) and not deleted. These are
  the rows of the desktop's bank popup (grid 111), sorted by name, all in one answer (no paging).
- **The name is what a cheque carries:** the phone sends `name` as `tdBankName`.
  `td_bank_name` is a varchar, not a foreign key, as on the desktop Receipt.
- **Caching:** none. The route has no `@CacheTTL`, because the HTTP cache key holds no device.
- **Plain HTTP:** served there too, since `mobile/` is a phone prefix in
  `src/common/phone-http/phone-http.ts`.

```json
{
  "items": [
    { "bankId": "019a…", "name": "Indian Bank", "shortName": null },
    { "bankId": "019a…", "name": "Karur Vysya Bank", "shortName": "KVB" }
  ],
  "total": 146
}
```

Test: [`mobile-bank.service.spec.ts`](mobile-bank.service.spec.ts).
