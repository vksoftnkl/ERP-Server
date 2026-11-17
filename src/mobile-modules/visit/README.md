# Mobile · Visits

Check-ins from the React Native salesman app: a visit to a customer, with a reason, remarks, the
GPS fix and the time.

- **Route:** `POST /api/v1/mobile/visits/create`. Swagger tag `Mobile · Visits`, docs page
  `/api/docs/mobile-visits`.
- **Auth:** optional (`@OptionalAuth`). With a token, `cv_user_id` and `cv_created_by` are the
  login user. Without one, the user is null and the row is stamped with the default actor.
- **Table:** `sales.customer_visit` (`cv_`, migration `20261118110000_mobile_orders_visits`,
  registry row 635). It is insert-only: nothing updates or deletes a visit.

## Payload

| Key | |
| --- | --- |
| `cvClientUuid` | Required. The phone's own id for the check-in. |
| `cvCompanyId` | Required. |
| `deviceUid` | Required. The registered phone, with the same rules and 403s as `/mobile/orders`. |
| `cvCustId` | Required. A live customer (404 `MOBILE_VISIT_CUSTOMER_NOT_FOUND`). |
| `cvSalesmanId` | Required. A live `public.employee_master` row, as `so_salesman_id` names one (404 `MOBILE_VISIT_SALESMAN_NOT_FOUND`). |
| `cvReasonCode` | `shopClosed`, `noOrder`, `shopBusy`, `ownerAway`, `paymentPending` or `nextVisit`: the phone's own words, kept as sent (`ck_cv_reason_code`). |
| `cvRemarks` | Up to 500 characters. |
| `cvLatitude` / `cvLongitude` | Both or neither (400 `MOBILE_VISIT_POSITION_INCOMPLETE`), ±90 / ±180, `numeric(9,6)`. |
| `cvGpsAccuracy` | Metres, ≥ 0. |
| `cvVisitAt` | Required, ISO 8601 with an offset: when the salesman checked in, by the phone's clock. |

The server fills `cv_branch_id` (the phone's branch, else the company default, as for orders)
and `cv_device_id`.

## Resend safety

The rules are the order's: an advisory lock on (company, client uuid), then a look-up by
`ux_cv_client_uuid` (`UNIQUE (cv_company_id, cv_client_uuid)`).

- The same uuid again answers the stored row with `duplicate: true` and writes nothing.
- The same uuid on another customer is a 409 `MOBILE_CLIENT_UUID_REUSED`.

Answer: `{ cvId, cvClientUuid, cvVisitAt (UTC instant), duplicate }`.

## Not here yet

There is no reader: no desktop visit report, no list route. The indexes for one exist:
`ix_cv_cust_time` (customer, time) and `ix_cv_salesman_time` (salesman, time).

## Tests

- Unit: [`../order/dto/mobile-order.dto.spec.ts`](../order/dto/mobile-order.dto.spec.ts) (visit
  DTO block).
- HTTP: `test/mobile-items-orders-visits-http.e2e-spec.ts`. It covers every reason code, a
  resend, a reused uuid, half a position, an unknown salesman, a blocked phone and a no-token
  upload. Test visits are deleted by their client uuids.
