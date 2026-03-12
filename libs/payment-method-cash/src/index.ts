import { Provider } from '@angular/core';
import {
	PENDING_PAYMENT_OVERLAY,
	PendingPaymentOverlay,
	REFUND_PAYMENT_OVERLAY,
	RefundPaymentOverlay,
} from '@pos/order-process-checkout';
import { PendingPaymentCashComponent } from './lib/pending-payment-cash.component';
import { PendingRefundCashComponent } from './lib/pending-refund-cash.component';

export * from './lib/order-process-payment-cash.component';
export * from './lib/pending-payment-cash.component';
export * from './lib/pending-refund-cash.component';

/**
 * Registers the cash pending-payment overlay implementation.
 */
export function providePendingPaymentCashOverlay(): Provider[] {
	return [
		{
			provide: PENDING_PAYMENT_OVERLAY,
			multi: true,
			useValue: {
				isResponsible: (payment) => {
					const type = payment.paymentMethod?.['@referredType']?.toLowerCase();
					const id = payment.paymentMethod?.id?.toLowerCase();
					const name = payment.paymentMethod?.name?.toLowerCase();
					return (
						type === 'cash' ||
						id === 'pm-cash' ||
						name === 'cash' ||
						name?.includes('cash') ||
						false
					);
				},
				pendingOverlayUi: PendingPaymentCashComponent,
			} as PendingPaymentOverlay,
		},
	];
}

/**
 * Registers the cash pending-refund overlay implementation.
 */
export function providePendingRefundCashOverlay(): Provider[] {
	return [
		{
			provide: REFUND_PAYMENT_OVERLAY,
			multi: true,
			useValue: {
				isResponsible: (payment) => {
					const type = payment.paymentMethod?.['@referredType']?.toLowerCase();
					const id = payment.paymentMethod?.id?.toLowerCase();
					const name = payment.paymentMethod?.name?.toLowerCase();
					return (
						type === 'cash' ||
						id === 'pm-cash' ||
						name === 'cash' ||
						name?.includes('cash') ||
						false
					);
				},
				refundOverlayUi: PendingRefundCashComponent,
			} as RefundPaymentOverlay,
		},
	];
}
