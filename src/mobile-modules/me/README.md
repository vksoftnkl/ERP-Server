# Mobile · Me

`GET /api/v1/mobile/me`: who the token is, for the React Native app (VKSMAN). Swagger tag
`Mobile · Me`, docs page `/api/docs/mobile-me`. Needs a token (401 `AUTH_AUTHORIZATION_MISSING`
without one; 401 `AUTH_USER_INACTIVE` when the login was deleted since the token was issued). Not
cached (per user). Served over plain HTTP too (`mobile/` is a phone prefix in
`src/common/phone-http/phone-http.ts`).

```json
{
  "userId": "019e441b-6e48-7918-b246-b857ffb35db1",
  "loginName": "VKPOS",
  "employeeId": null,
  "employeeName": null,
  "rights": {
    "11": { "view": true, "create": true, "post": true, "cancel": true, "print": true },
    "12": { "view": true, "create": true, "post": true, "cancel": true, "print": true },
    "99": { "view": true, "create": true, "post": true, "cancel": true, "print": true }
  }
}
```

- `employeeId` / `employeeName`: `user_master.usr_employee_id` when it names a live employee
  (`emp_is_deleted = false`), else null. It is the collector a phone receipt carries
  (`avh_employee_id`), read by the same helper ([`../common/mobile-login.ts`](../common/mobile-login.ts)).
- `rights`: keyed by menu id as text, `"11"` Sales Order, `"12"` Sales Bill, `"99"` Receipt; each
  `{view, create, post, cancel, print}` from `public.user_menus` through `loadRights`
  (`src/common/posting/rights.ts`), the reader every desktop guard uses. No row = all false; there
  is no SUPER ADMIN bypass, as on the desktop.

Test: [`mobile-me.service.spec.ts`](mobile-me.service.spec.ts); HTTP in
`test/mobile-bills-receipts-http.e2e-spec.ts`.
