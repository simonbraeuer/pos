import { Provider } from '@angular/core';
import { CHECKOUT_ACTION_UI, CheckoutActionUI } from '@pos/order-process-checkout';
import { CheckoutActionPaymentCashComponent } from './lib/checkout-action-payment-cash.component';

export * from './lib/checkout-action-payment-cash.component';

/**
 * Provides the cash payment checkout action.
 * Call this in app.config.ts providers array.
 */
export function provideCheckoutActionPaymentCash(): Provider[] {
  return [
    {
      provide: CHECKOUT_ACTION_UI,
      multi: true,
      useValue: {
        id: 'payment-cash',
        cols: 1,
        rows: 1,
        component: CheckoutActionPaymentCashComponent,
      } as CheckoutActionUI,
    },
  ];
}
