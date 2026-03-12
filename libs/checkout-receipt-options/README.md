# checkout-receipt-options

Provides the receipt options checkout action button and the receipt options configuration page.

## Features

- **Action button** registered as a `CHECKOUT_ACTION_UI` provider, navigating to `../receipt-options`
- **Receipt options page** where the cashier can choose:
  - A printer on the current hardware station, or
  - A4 PDF output (opens in a new browser tab)
- Last configuration is persisted in `localStorage` under `pos_receipt_options`

## Usage

```ts
import { provideCheckoutReceiptOptions } from '@pos/checkout-receipt-options';

// in app.config.ts providers:
...provideCheckoutReceiptOptions(),
```

Add the route to your `ORDER_PROCESS_ROUTES`:

```ts
import { RECEIPT_OPTIONS_ROUTE } from '@pos/checkout-receipt-options';

{ path: 'receipt-options', ...RECEIPT_OPTIONS_ROUTE }
```
