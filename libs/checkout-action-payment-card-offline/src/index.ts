import { Provider } from '@angular/core';
import { CHECKOUT_ACTION_UI, CheckoutActionUI } from '@pos/order-process-checkout';
import { CheckoutActionPaymentCardOfflineComponent } from './lib/checkout-action-payment-card-offline.component';

export * from './lib/checkout-action-payment-card-offline.component';

/**
 * Provides the offline card payment checkout action button.
 * Call this in app.config.ts providers array.
 */
export function provideCheckoutActionPaymentCardOffline(): Provider[] {
  return [
    {
      provide: CHECKOUT_ACTION_UI,
      multi: true,
      useValue: {
        id: 'payment-card-offline',
        cols: 1,
        rows: 1,
        component: CheckoutActionPaymentCardOfflineComponent,
      } as CheckoutActionUI,
    },
  ];
}
