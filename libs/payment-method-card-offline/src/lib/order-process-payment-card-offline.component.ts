import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductOrder } from '@pos/tmf622';
import { Tmf676ApiService, Tmf676EventsService, CreatePaymentRequest } from '@pos/tmf676';
import { ProcessContentLayoutComponent } from '@pos/core-ui';
import { CreditCardScanOverlayComponent, CreditCardScanResult } from '@pos/core-utils';

@Component({
  selector: 'pos-order-process-payment-card-offline',
  standalone: true,
  imports: [CommonModule, FormsModule, ProcessContentLayoutComponent, CreditCardScanOverlayComponent],
  templateUrl: './order-process-payment-card-offline.component.html',
  styleUrl: './order-process-payment-card-offline.component.scss',
})
export class OrderProcessPaymentCardOfflineComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly paymentApi = inject(Tmf676ApiService);
  private readonly paymentEvents = inject(Tmf676EventsService);

  /** Payment amount input */
  amount = signal<number>(0);

  /** Card holder name */
  cardHolder = signal<string>('');

  /** Card number (will be masked and stored) */
  cardNumber = signal<string>('');

  /** Expiry date (MM/YY format) */
  expiryDate = signal<string>('');

  /** Card type selection */
  cardType = signal<'credit' | 'debit'>('credit');

  /** Payment method name shown in the page title */
  paymentMethodName = computed<string>(() => {
    const base = this.cardType() === 'credit' ? 'Credit Card' : 'Debit Card';
    return this.isRefundMode() ? `${base} Refund` : base;
  });

  /** CVV (not persisted, only for validation) */
  cvv = signal<string>('');

  /** True when the outstanding balance is negative — store owes the customer a refund */
  isRefundMode = computed<boolean>(() => this.outstandingAmount() < 0);

  /** Processing state */
  processing = signal<boolean>(false);

  /** Card scan overlay visibility */
  showCardScanner = signal<boolean>(false);

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
        this.amount.set(outstanding); // Prefill with outstanding (negative for refunds)
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

  /**
   * Mask credit card number for storage (show only last 4 digits)
   */
  maskCardNumber(cardNumber: string): string {
    const lastFour = cardNumber.replace(/\s/g, '').slice(-4);
    return `**** **** **** ${lastFour}`;
  }

  /**
   * Validate card form
   */
  isFormValid(): boolean {
    const cardNum = this.cardNumber().replace(/\s/g, '');
    const expiryPattern = /^\d{2}\/\d{2}$/; // MM/YY format
    const cvvPattern = /^\d{3,4}$/; // 3-4 digits

    return (
      this.amount() !== 0 &&
      this.cardHolder().trim().length > 0 &&
      cardNum.length === 16 &&
      expiryPattern.test(this.expiryDate()) &&
      cvvPattern.test(this.cvv())
    );
  }

  /**
   * Format card number input (add spaces every 4 digits)
   */
  formatCardNumber(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const value = (input?.value || '').replace(/\s/g, '');
    const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
    this.cardNumber.set(formatted);
  }

  /**
   * Format expiry date input (MM/YY format)
   */
  formatExpiryDate(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    let value = (input?.value || '').replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    this.expiryDate.set(value);
  }

  /**
   * Only allow digits in CVV
   */
  onCvvInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const value = (input?.value || '').replace(/\D/g, '').slice(0, 4);
    this.cvv.set(value);
  }

  resetForm(): void {
    this.amount.set(this.outstandingAmount());
    this.cardType.set('credit');
    this.cardHolder.set('');
    this.cardNumber.set('');
    this.expiryDate.set('');
    this.cvv.set('');
    this.error.set(null);
  }

  openCardScanner(): void {
    this.showCardScanner.set(true);
  }

  closeCardScanner(): void {
    this.showCardScanner.set(false);
  }

  onCardScanned(scanResult: CreditCardScanResult): void {
    if (scanResult.cardHolder) {
      this.cardHolder.set(scanResult.cardHolder);
    }

    if (scanResult.cardNumber) {
      const digits = scanResult.cardNumber.replace(/\D/g, '').slice(0, 16);
      const formatted = digits.match(/.{1,4}/g)?.join(' ') || digits;
      this.cardNumber.set(formatted);
    }

    if (scanResult.expiryDate) {
      const normalized = scanResult.expiryDate.replace(/\s/g, '');
      if (/^(0[1-9]|1[0-2])\/\d{2}$/.test(normalized)) {
        this.expiryDate.set(normalized);
      }
    }

    this.error.set(null);
    this.closeCardScanner();
  }

  pay(): void {
    const order = this.order();
    if (!order || this.processing()) return;

    if (!this.isFormValid()) {
      this.error.set('Please fill in all required fields correctly.');
      return;
    }

    this.processing.set(true);
    this.error.set(null);

    const paymentAmount = this.amount();
    const maskedCard = this.maskCardNumber(this.cardNumber());
    const baseLabel = this.cardType() === 'credit' ? '💳 Credit Card' : '💳 Debit Card';
    const label = this.isRefundMode() ? `${baseLabel} Refund` : baseLabel;
    const action = this.isRefundMode() ? 'refund' : 'payment';

    const paymentRequest: CreatePaymentRequest = {
      externalId: order.id,
      amount: { unit: 'EUR', value: paymentAmount },
      description: `${label} ${action} - ${maskedCard}`,
      paymentMethod: {
        id: this.cardType() === 'credit' ? 'pm-card-credit' : 'pm-card-debit',
        name: `${label} - ${maskedCard}`,
        '@referredType': this.cardType() === 'credit' ? 'CreditCard' : 'DebitCard',
        authorizationMode: 'offline',
        requiresHardware: true,
      },
      paymentDate: new Date().toISOString(),
      relatedParty: order.relatedParty || [],
      paymentItem: order.productOrderItem.map(item => ({
        id: item.id,
        amount: item.itemTotalPrice?.[0]?.price?.taxIncludedAmount || { unit: 'EUR', value: 0 },
        billingAccount: undefined,
        description: item.productOffering?.name || item.product?.name || `Order item ${item.id}`,
      })),
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
