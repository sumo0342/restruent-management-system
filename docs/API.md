# API documentation

All routes below live under `src/app/api/**` (Next.js Route Handlers). Every
route requires an active session cookie and checks the caller's role
server-side with `requireRole(...)`; unauthenticated calls get `401`, wrong
role gets `403`. Responses are always `{ ok: true, data }` or
`{ ok: false, error }`.

Server Actions (owner CRUD: users, menu, tables, notes, maintenance,
settings) aren't listed here since they're not HTTP endpoints — see
`src/lib/actions/owner.ts`, each function documents its own role check inline.

## Waiter

### `POST /api/waiter/orders`
Create an order and send it straight to the kitchen (real DB write —
this is both "create order" and "send to kitchen" from the spec, combined
into one action since there's no useful intermediate draft state).

Roles: `WAITER`, `OWNER`

```json
{
  "tableId": "507f1f77bcf86cd799439011",
  "customerNote": "less spicy",
  "items": [
    { "menuItemId": "507f1f77bcf86cd799439011", "quantity": 2, "notes": "extra spicy" }
  ]
}
```

### `POST /api/waiter/orders/:id/serve`
Marks a `READY` order `SERVED`, then immediately `BILL_PENDING`. Sets the
table to `WAITING_FOR_BILL`.

Roles: `WAITER`, `OWNER`

### `POST /api/waiter/orders/:id/cancel-request`
Moves an order to `CANCEL_REQUESTED`. A manager/owner must approve the actual
cancellation — waiters cannot cancel unilaterally.

Roles: `WAITER`, `OWNER`
```json
{ "reason": "customer changed their mind" }
```

### `GET /api/waiter/notifications`
Polled every 4s by the waiter UI. Returns orders in `READY` status for this
waiter (or all, for an owner) that haven't been served yet.

Roles: `WAITER`, `OWNER`

## Kitchen

### `GET /api/kitchen/orders`
Polled every 3s by the Kitchen Display. Returns `PENDING`/`PREPARING` orders,
oldest first.

Roles: `KITCHEN`, `OWNER`

### `POST /api/kitchen/orders/:id/start`
`PENDING` → `PREPARING`. Records which kitchen staff member picked it up.

Roles: `KITCHEN`, `OWNER`

### `POST /api/kitchen/orders/:id/ready`
`PREPARING` → `READY`. Sets the table to `FOOD_READY` — this is what the
waiter's notification poll picks up.

Roles: `KITCHEN`, `OWNER`

## Manager

### `GET /api/manager/tables`
All active tables with their live status, for the billing table-picker.

Roles: `MANAGER`, `OWNER`

### `GET /api/manager/session/:tableId`
The table's open `TableSession` with every order round, item, and (if one
exists) the current bill + payments. Used to render the billing screen.

Roles: `MANAGER`, `OWNER`

### `POST /api/manager/bill`
Generates one combined bill across every `BILL_PENDING` order round in a
session. Computes tax/service charge from the restaurant's configured
percentages, applies an optional discount (capped at the pre-discount total),
and moves those orders to `BILLED`.

Roles: `MANAGER`, `OWNER`
```json
{ "sessionId": "507f1f77bcf86cd799439011", "discountAmount": 50, "discountReason": "loyalty" }
```

### `POST /api/manager/payment`
Records one or more payments (split payment support — pass multiple entries).
The sum must match the bill total within a cent. Rejects duplicate payment on
an already-`PAID`/`CLOSED` bill. On success: bill → `PAID`, its orders →
`CLOSED`, the table session closes, the table → `AVAILABLE`.

Roles: `MANAGER`, `OWNER`
```json
{
  "billId": "507f1f77bcf86cd799439011",
  "payments": [
    { "method": "CASH", "amount": 400 },
    { "method": "UPI", "amount": 600, "reference": "UPI/1234" }
  ]
}
```

### `GET /api/manager/shift`
The caller's currently open shift, if any.

### `POST /api/manager/shift`
Opens a new shift. Fails if the caller already has one open.
```json
{ "openingCash": 2000 }
```

### `POST /api/manager/shift/:id/close`
Closes a shift and returns a cash-reconciliation summary (cash/UPI/card sales
since the shift opened, expected vs. actual cash, difference).
```json
{ "closingCashActual": 18500 }
```

## Owner

### `GET /api/owner/export/bills`
Streams a CSV of every paid/closed bill (bill number, table, subtotal, tax,
service charge, discount, total, issued-by, paid-at).

Roles: `OWNER`

## Error shape

```json
{ "ok": false, "error": "Human-readable message safe to show the user" }
```

Database/internal errors are logged server-side and never leaked to the
client — `withRole()` (in `src/lib/api.ts`) catches everything and maps it to
a generic message unless it's a validation error with a safe, specific
message (e.g. "Table not found.", "This bill has already been paid.").
