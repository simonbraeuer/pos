import { Provider } from '@angular/core';
import {
  PENDING_PAYMENT_OVERLAY,
  PendingPaymentOverlay,
} from '@pos/order-process-checkout';
import { PendingPaymentDefaultComponent } from './lib/pending-payment-default.component';

export * from './lib/pending-payment-default.component';

/**
 * Registers the default pending-payment overlay implementation.
 * Handles unsupported payment types: Bank Transfer, Direct Debit, Digital Wallet, Other.
 * Auto-finalizes with retry/abort on failure.
 */
export function providePendingPaymentDefaultOverlay(): Provider[] {
  return [
    {
      provide: PENDING_PAYMENT_OVERLAY,
      multi: true,
      useValue: {
        isResponsible: (payment) => {
          const type = payment.paymentMethod?.['@referredType']?.toLowerCase();
          const name = payment.paymentMethod?.name?.toLowerCase();

          // Match unsupported types
          if (
            type === 'banktransfer' ||
            type === 'directdebit' ||
            type === 'digitalwallet' ||
            name?.includes('bank') ||
            name?.includes('transfer') ||
            name?.includes('sepa') ||
            name?.includes('direct') ||
            name?.includes('debit') ||
            name?.includes('wallet') ||
            name?.includes('paypal') ||
            name?.includes('apple') ||
            name?.includes('google')
          ) {
            return true;
          }

          // Also handle explicitly "Other" payments
          if (type === 'other' || name === 'other') {
            return true;
          }

          return false;
        },
        pendingOverlayUi: PendingPaymentDefaultComponent,
      } as PendingPaymentOverlay,
    },
  ];
}
