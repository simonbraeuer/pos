import { Provider } from '@angular/core';
import {
  REFUND_PAYMENT_OVERLAY,
  RefundPaymentOverlay,
} from '@pos/order-process-checkout';
import { PendingRefundDefaultComponent } from './lib/pending-refund-default.component';

export * from './lib/pending-refund-default.component';

export function providePendingRefundDefaultOverlay(): Provider[] {
  return [
    {
      provide: REFUND_PAYMENT_OVERLAY,
      multi: true,
      useValue: {
        isResponsible: (payment) => {
          const type = payment.paymentMethod?.['@referredType']?.toLowerCase();
          const name = payment.paymentMethod?.name?.toLowerCase();

          return (
            type === 'bank transfer' ||
            type === 'banktransfer' ||
            type === 'direct debit' ||
            type === 'directdebit' ||
            type === 'digital wallet' ||
            type === 'digitalwallet' ||
            type === 'other' ||
            name === 'bank transfer' ||
            name === 'direct debit' ||
            name === 'digital wallet' ||
            name === 'other'
          );
        },
        refundOverlayUi: PendingRefundDefaultComponent,
      } as RefundPaymentOverlay,
    },
  ];
}
