import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { ProductOrder, Tmf622ApiService } from '@pos/tmf622';
import { Payment, Tmf676ApiService } from '@pos/tmf676';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

const amountEpsilon = 0.00001;

export const checkoutCompleteGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const orderApi = inject(Tmf622ApiService);
  const paymentApi = inject(Tmf676ApiService);

  const orderId = route.parent?.paramMap.get('orderid');
  if (!orderId) {
    return router.createUrlTree(['/orders']);
  }

  return forkJoin({
    order: orderApi.getProductOrder(orderId),
    payments: paymentApi.searchPayments({ externalId: orderId }, 0, 100).pipe(map((r) => r.items)),
  }).pipe(
    map(({ order, payments }) => {
      return isTransactionComplete(order, payments)
        ? true
        : router.createUrlTree(['/orders', orderId, 'checkout']);
    }),
    catchError(() => of(router.createUrlTree(['/orders', orderId, 'checkout'])))
  );
};

function isTransactionComplete(order: ProductOrder, payments: Payment[]): boolean {
  if (order.state === 'completed') {
    return true;
  }

  const completedRefundOriginalIds = new Set(
    payments
      .filter((payment) => isRefundPayment(payment) && payment.status === 'completed' && !!payment.originalPaymentId)
      .map((payment) => payment.originalPaymentId as string)
  );

  const visiblePayments = payments.filter((payment) => {
    const isCompletedRefund = isRefundPayment(payment) && payment.status === 'completed';
    if (isCompletedRefund) {
      return false;
    }

    if (completedRefundOriginalIds.has(payment.id)) {
      return false;
    }

    return true;
  });

  const paidAmount = visiblePayments
    .filter((payment) => payment.status === 'completed' || payment.status === 'authorized')
    .reduce((sum, payment) => sum + (payment.amount?.value || 0), 0);

  const outstandingAmount = calculateTotalAmount(order) - paidAmount;
  const hasPendingPayment = payments.some(
    (payment) => payment.status === 'pending' && !isRefundPayment(payment)
  );
  const hasPendingRefund = payments.some(
    (payment) => payment.status === 'pending' && isRefundPayment(payment)
  );

  return outstandingAmount <= amountEpsilon && !hasPendingPayment && !hasPendingRefund;
}

function calculateTotalAmount(order: ProductOrder): number {
  const orderTotal = order.orderTotalPrice?.[0]?.price?.taxIncludedAmount?.value;
  if (orderTotal !== undefined) {
    return orderTotal;
  }

  return order.productOrderItem.reduce((sum, item) => {
    const itemTotal = item.itemTotalPrice?.[0]?.price?.taxIncludedAmount?.value;
    if (itemTotal !== undefined) {
      return sum + itemTotal;
    }
    const itemPrice = item.itemPrice?.[0]?.price?.taxIncludedAmount?.value;
    if (itemPrice !== undefined) {
      return sum + itemPrice * item.quantity;
    }
    return sum;
  }, 0);
}

function isRefundPayment(payment: Payment): boolean {
  return !!payment.originalPaymentId;
}
