import { Provider } from '@angular/core';
import {
	PENDING_PAYMENT_OVERLAY,
	PendingPaymentOverlay,
	REFUND_PAYMENT_OVERLAY,
	RefundPaymentOverlay,
	PAYMENT_ITEM_COMPONENT,
	PaymentItemComponentRegistry,
} from '@pos/order-process-checkout';
import { PendingPaymentCardOfflineComponent } from './lib/pending-payment-card-offline.component';
import { PendingRefundCardOfflineComponent } from './lib/pending-refund-card-offline.component';
import { PaymentItemCardOfflineComponent } from './lib/payment-item-card-offline.component';

export * from './lib/order-process-payment-card-offline.component';
export * from './lib/pending-payment-card-offline.component';
export * from './lib/pending-refund-card-offline.component';
export * from './lib/payment-item-card-offline.component';

/**
 * Registers the card offline pending-payment overlay implementation.
 */
export function providePendingPaymentCardOfflineOverlay(): Provider[] {
	return [
		{
			provide: PENDING_PAYMENT_OVERLAY,
			multi: true,
			useValue: {
				isResponsible: (payment) => {
					const type = payment.paymentMethod?.['@referredType']?.toLowerCase();
					const id = payment.paymentMethod?.id?.toLowerCase();
					const authMode = payment.paymentMethod?.['authorizationMode'];
					return (
						(type === 'creditcard' || type === 'debitcard') &&
						authMode === 'offline' &&
						(id?.includes('card') || id?.includes('credit') || id?.includes('debit') ||
						 type === 'creditcard' || type === 'debitcard')
					);
				},
				pendingOverlayUi: PendingPaymentCardOfflineComponent,
			} as PendingPaymentOverlay,
		},
	];
}

/**
 * Registers the card offline pending-refund overlay implementation.
 */
export function providePendingRefundCardOfflineOverlay(): Provider[] {
	return [
		{
			provide: REFUND_PAYMENT_OVERLAY,
			multi: true,
			useValue: {
				isResponsible: (payment) => {
					const type = payment.paymentMethod?.['@referredType']?.toLowerCase();
					const id = payment.paymentMethod?.id?.toLowerCase();
					const authMode = payment.paymentMethod?.['authorizationMode'];
					return (
						(type === 'creditcard' || type === 'debitcard') &&
						authMode === 'offline' &&
						(id?.includes('card') || id?.includes('credit') || id?.includes('debit') ||
						 type === 'creditcard' || type === 'debitcard')
					);
				},
				refundOverlayUi: PendingRefundCardOfflineComponent,
			} as RefundPaymentOverlay,
		},
	];
}

/**
 * Registers the card offline payment item component.
 */
export function providePaymentItemCardOffline(): Provider[] {
	return [
		{
			provide: PAYMENT_ITEM_COMPONENT,
			multi: true,
			useValue: {
				isResponsible: (payment) => {
					const type = payment.paymentMethod?.['@referredType']?.toLowerCase();
					const id = payment.paymentMethod?.id?.toLowerCase();
					const authMode = payment.paymentMethod?.['authorizationMode'];
					return (
						(type === 'creditcard' || type === 'debitcard') &&
						authMode === 'offline' &&
						(id?.includes('card') || id?.includes('credit') || id?.includes('debit') ||
						 type === 'creditcard' || type === 'debitcard')
					);
				},
				component: PaymentItemCardOfflineComponent,
			} as PaymentItemComponentRegistry,
		},
	];
}
