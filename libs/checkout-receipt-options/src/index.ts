import { Provider } from '@angular/core';
import { CHECKOUT_ACTION_UI, CheckoutActionUI } from '@pos/order-process-checkout';
import { CheckoutActionReceiptOptionsComponent } from './lib/checkout-action-receipt-options.component';

export * from './lib/receipt-options.service';
export * from './lib/receipt-options.component';
export * from './lib/checkout-action-receipt-options.component';

/**
 * Provides the "Receipt options" checkout action button.
 * Call this in app.config.ts providers array.
 */
export function provideCheckoutReceiptOptions(): Provider[] {
  return [
    {
      provide: CHECKOUT_ACTION_UI,
      multi: true,
      useValue: {
        id: 'receipt-options',
        cols: 1,
        rows: 1,
        component: CheckoutActionReceiptOptionsComponent,
      } as CheckoutActionUI,
    },
  ];
}
