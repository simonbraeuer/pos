import { Component, Type, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { ProductOrder, Tmf622ApiService } from '@pos/tmf622';
import { Tmf676ApiService, Tmf676EventsService, Payment } from '@pos/tmf676';
import { ActionButtonPanelComponent } from '@pos/core-ui';
import { retry } from 'rxjs/operators';
import { CheckoutActionUI, CHECKOUT_ACTION_UI } from './checkout-action-ui';
import {
  PendingPaymentOverlay,
  PENDING_PAYMENT_OVERLAY,
} from './pending-payment-overlay';
import {
  RefundPaymentOverlay,
  REFUND_PAYMENT_OVERLAY,
} from './refund-payment-overlay';
import {
  PAYMENT_ITEM_COMPONENT,
  PaymentItemComponentRegistry,
} from './payment-item-component-registry';
import { DefaultPaymentItemComponent } from './payment-item.component';

@Component({
  selector: 'pos-order-process-checkout',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet, ActionButtonPanelComponent],
  templateUrl: './order-process-checkout.component.html',
  styleUrl: './order-process-checkout.component.scss',
})
export class OrderProcessCheckoutComponent {
    private readonly amountEpsilon = 0.00001;
  private forwardedToComplete = false;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly paymentApi = inject(Tmf676ApiService);
  private readonly paymentEvents = inject(Tmf676EventsService);
  private readonly orderApi = inject(Tmf622ApiService);

  /** Checkout action implementations */
  checkoutActions = signal<CheckoutActionUI[]>(
    inject(CHECKOUT_ACTION_UI, { optional: true }) || []
  );

  /** Pending payment overlay implementations */
  pendingPaymentOverlays = signal<PendingPaymentOverlay[]>(
    inject(PENDING_PAYMENT_OVERLAY, { optional: true }) || []
  );

  /** Pending refund overlay implementations */
  refundPaymentOverlays = signal<RefundPaymentOverlay[]>(
    inject(REFUND_PAYMENT_OVERLAY, { optional: true }) || []
  );

    /** Payment item component implementations */
    paymentItemComponents = signal<PaymentItemComponentRegistry[]>(
      inject(PAYMENT_ITEM_COMPONENT, { optional: true }) || []
    );

  /** Loading state */
  loading = signal<boolean>(true);

  /** Payments for current order */
  payments = signal<Payment[]>([]);

  /** Order from parent route data */
  private readonly orderState = signal<ProductOrder | null>(
    this.route.parent?.snapshot.data['order'] || null
  );
  private readonly orderId = signal<string | null>(
    this.route.parent?.snapshot.paramMap.get('orderid') || this.orderState()?.id || null
  );
  readonly order = this.orderState.asReadonly();

  /** Total order amount (transaction amount) */
  totalAmount = computed<number>(() => {
    const order = this.order();
    if (!order) return 0;
    
    // Get total from orderTotalPrice
    const orderTotal = order.orderTotalPrice?.[0]?.price?.taxIncludedAmount?.value;
    if (orderTotal !== undefined) return orderTotal;
    
    // Fallback to sum of items
    return order.productOrderItem.reduce((sum, item) => {
      const itemTotal = item.itemTotalPrice?.[0]?.price?.taxIncludedAmount?.value;
      if (itemTotal !== undefined) {
        return sum + itemTotal;
      }
      const itemPrice = item.itemPrice?.[0]?.price?.taxIncludedAmount?.value;
      if (itemPrice !== undefined) {
        return sum + (itemPrice * item.quantity);
      }
      return sum;
    }, 0);
  });

  /** Paid amount (sum of completed payments) */
  paidAmount = computed<number>(() => {
    return this.visiblePayments()
      .filter(p => p.status === 'completed' || p.status === 'authorized')
      .reduce((sum, payment) => {
        const amount = payment.amount?.value || 0;
        return sum + amount;
      }, 0);
  });

  /** Payments visible in checkout (refund entries and refunded originals are hidden) */
  visiblePayments = computed<Payment[]>(() => {
    const allPayments = this.payments();
    const completedRefundOriginalIds = new Set(
      allPayments
        .filter(
          (payment) =>
            this.isRefundPayment(payment) &&
            payment.status === 'completed' &&
            !!payment.originalPaymentId
        )
        .map((payment) => payment.originalPaymentId as string)
    );

    return allPayments.filter((payment) => {
      const isCompletedRefund =
        this.isRefundPayment(payment) && payment.status === 'completed';

      if (isCompletedRefund) {
        return false;
      }

      if (completedRefundOriginalIds.has(payment.id)) {
        return false;
      }

      return true;
    });
  });

  /** Outstanding amount (total - paid) */
  outstandingAmount = computed<number>(() => {
    return this.totalAmount() - this.paidAmount();
  });

  /** Check if there are any payments */
  hasPayments = computed<boolean>(() => this.visiblePayments().length > 0);

  /** Check if order is complete */
  isOrderComplete = computed<boolean>(() => {
    const order = this.order();
    if (order?.state === 'completed') {
      return true;
    }

    // Fallback: if payment settlement reaches total and no pending overlays remain,
    // treat the order as complete even if order-state refresh is momentarily stale.
    const fullyPaid = this.outstandingAmount() <= this.amountEpsilon;
    const noPending = !this.showPendingOverlay() && !this.showPendingRefundOverlay();
    return !!order && fullyPaid && noPending;
  });

  /** First pending payment that still needs in-store handling */
  activePendingPayment = computed<Payment | null>(() => {
    return (
      this.payments().find(
        (payment) => payment.status === 'pending' && !this.isRefundPayment(payment)
      ) || null
    );
  });

  /** First pending refund that needs in-store handling */
  activePendingRefundPayment = computed<Payment | null>(() => {
    return (
      this.payments().find(
        (payment) => payment.status === 'pending' && this.isRefundPayment(payment)
      ) ||
      null
    );
  });

  /** Overlay implementation responsible for the pending payment */
  activePendingOverlay = computed<PendingPaymentOverlay | null>(() => {
    const payment = this.activePendingPayment();
    if (!payment) return null;

    return (
      this.pendingPaymentOverlays().find((overlay) => overlay.isResponsible(payment)) || null
    );
  });

  /** Whether checkout interaction should be blocked by a pending-payment overlay */
  showPendingOverlay = computed<boolean>(() => {
    return this.activePendingPayment() !== null && this.activePendingRefundPayment() === null;
  });

  /** Overlay implementation responsible for the pending refund */
  activePendingRefundOverlay = computed<RefundPaymentOverlay | null>(() => {
    const payment = this.activePendingRefundPayment();
    if (!payment) return null;

    return (
      this.refundPaymentOverlays().find((overlay) => overlay.isResponsible(payment)) || null
    );
  });

  /** Whether checkout interaction should be blocked by a pending-refund overlay */
  showPendingRefundOverlay = computed<boolean>(() => {
    return this.activePendingRefundPayment() !== null;
  });

  pendingPaymentMethodLabel(): string {
    const payment = this.activePendingPayment();
    return (
      payment?.paymentMethod?.name ||
      payment?.paymentMethod?.['@referredType'] ||
      payment?.paymentMethod?.id ||
      'Unknown method'
    );
  }

  pendingPaymentAmountLabel(): string {
    return this.formatAmount(this.activePendingPayment()?.amount?.value || 0);
  }

  pendingRefundMethodLabel(): string {
    const payment = this.activePendingRefundPayment();
    return (
      payment?.paymentMethod?.name ||
      payment?.paymentMethod?.['@referredType'] ||
      payment?.paymentMethod?.id ||
      'Unknown method'
    );
  }

  pendingRefundAmountLabel(): string {
    return this.formatAmount(this.activePendingRefundPayment()?.amount?.value || 0);
  }

  constructor() {
    // Load initial payments and keep the list fresh via TMF688 payment events.
    effect((onCleanup) => {
      const orderId = this.orderId();
      if (!orderId) {
        return;
      }

      this.loadPayments(orderId);
      this.loadOrder(orderId);
      const sub = this.paymentEvents.getOrderPaymentEvents(orderId).subscribe(() => {
        this.loadPayments(orderId);
        this.loadOrder(orderId);
      });

      onCleanup(() => sub.unsubscribe());
    });

    effect(() => {
      const complete = this.isOrderComplete();
      const orderId = this.orderId();
      if (!complete || !orderId || this.forwardedToComplete) {
        return;
      }

      this.forwardedToComplete = true;
      this.router.navigate(['../checkout-complete'], { relativeTo: this.route });
    });
  }

  private loadPayments(orderId: string): void {
    this.loading.set(true);
    this.paymentApi.searchPayments({ externalId: orderId }, 0, 100).subscribe({
      next: (result) => {
        this.payments.set(result.items);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load payments:', err);
        this.payments.set([]);
        this.loading.set(false);
      },
    });
  }

  private loadOrder(orderId: string): void {
    this.orderApi.getProductOrder(orderId).pipe(retry({ count: 2, delay: 200 })).subscribe({
      next: (order) => this.orderState.set(order),
      error: (err) => {
        console.error('Failed to refresh order:', err);
      },
    });
  }

  onPendingPaymentFinalized = (): void => {
    // No-op: payment list updates through TMF688 payment event stream.
  };

  onPendingRefundFinalized = (): void => {
    // No-op: payment list updates through TMF688 payment event stream.
  };

  private isRefundPayment(payment: Payment): boolean {
    return !!payment.originalPaymentId;
  }

  /**
   * Format amount with proper sign and currency
   */
  formatAmount(amount: number): string {
    const absAmount = Math.abs(amount);
    const formatted = absAmount.toFixed(2);
    const sign = amount < 0 ? '-' : '';
    return `${sign}€${formatted}`;
  }

  /**
   * Get the payment item component to use for rendering a specific payment.
   * Checks registered payment item components and returns the first one that's responsible.
   */
  getPaymentItemComponent(payment: Payment): Type<unknown> {
    const handlers = this.paymentItemComponents();
    for (const handler of handlers) {
      if (handler.isResponsible(payment)) {
        return handler.component;
      }
    }
    return DefaultPaymentItemComponent;
  }
}
