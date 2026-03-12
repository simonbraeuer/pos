import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductOrder } from '@pos/tmf622';
import { Tmf676ApiService, Tmf676EventsService, CreatePaymentRequest } from '@pos/tmf676';
import { ProcessContentLayoutComponent } from '@pos/core-ui';

@Component({
  selector: 'pos-order-process-payment-cash',
  standalone: true,
  imports: [CommonModule, FormsModule, ProcessContentLayoutComponent],
  templateUrl: './order-process-payment-cash.component.html',
  styleUrl: './order-process-payment-cash.component.scss',
})
export class OrderProcessPaymentCashComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly paymentApi = inject(Tmf676ApiService);
  private readonly paymentEvents = inject(Tmf676EventsService);

  /** Payment amount input */
  amount = signal<number>(0);

  /** Reference/notes input */
  notes = signal<string>('');

  /** Processing state */
  processing = signal<boolean>(false);

  /** Error message */
  error = signal<string | null>(null);

  /** Order from parent route data */
  order = computed<ProductOrder | null>(() => {
    return this.route.parent?.snapshot.data['order'] || null;
  });

  /** Total order amount (transaction amount) */
  private totalAmount = computed<number>(() => {
    const order = this.order();
    if (!order) return 0;
    
    const orderTotal = order.orderTotalPrice?.[0]?.price?.taxIncludedAmount?.value;
    if (orderTotal !== undefined) return orderTotal;
    
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

  /** Outstanding amount (to prefill the payment) */
  outstandingAmount = signal<number>(0);

  constructor() {
    // Keep outstanding amount in sync with order payments via TMF688 events.
    effect((onCleanup) => {
      const order = this.order();
      if (!order) {
        return;
      }

      this.loadOutstandingAmount(order.id);
      const sub = this.paymentEvents.getOrderPaymentEvents(order.id).subscribe(() => {
        this.loadOutstandingAmount(order.id);
      });

      onCleanup(() => sub.unsubscribe());
    });
  }

  private loadOutstandingAmount(orderId: string): void {
    // Load payments to calculate outstanding
    this.paymentApi.searchPayments({ externalId: orderId }, 0, 100).subscribe({
      next: (result) => {
        const paidAmount = result.items
          .filter(p => p.status === 'completed' || p.status === 'authorized')
          .reduce((sum, payment) => sum + (payment.amount?.value || 0), 0);
        
        const outstanding = this.totalAmount() - paidAmount;
        this.outstandingAmount.set(outstanding);
        this.amount.set(Math.max(0, outstanding)); // Prefill with outstanding (non-negative)
      },
      error: () => {
        // Fallback to total amount
        this.amount.set(this.totalAmount());
      },
    });
  }

  goBack(): void {
    this.router.navigate(['../checkout'], { relativeTo: this.route });
  }

  pay(): void {
    const order = this.order();
    if (!order || this.processing()) return;

    const paymentAmount = this.amount();
    if (paymentAmount <= 0) {
      this.error.set('Payment amount must be greater than zero');
      return;
    }

    this.processing.set(true);
    this.error.set(null);

    const paymentRequest: CreatePaymentRequest = {
      externalId: order.id,
      amount: { unit: 'EUR', value: paymentAmount },
      description: this.notes() || 'Cash payment',
      paymentMethod: {
        id: 'pm-cash',
        name: 'Cash',
        '@referredType': 'Cash',
      },
      paymentDate: new Date().toISOString(),
      relatedParty: order.relatedParty || [],
    };

    this.paymentApi.createPayment(paymentRequest).subscribe({
      next: () => {
        // Navigate back to checkout
        this.router.navigate(['../checkout'], { relativeTo: this.route });
      },
      error: (err) => {
        this.processing.set(false);
        this.error.set(err?.message || 'Failed to create payment');
      },
    });
  }

  formatAmount(amount: number): string {
    return `€${amount.toFixed(2)}`;
  }
}
