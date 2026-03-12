import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Payment, Tmf676ApiService } from '@pos/tmf676';

@Component({
  selector: 'pos-default-payment-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-item.component.html',
  styleUrl: './payment-item.component.scss',
})
export class DefaultPaymentItemComponent {
  private readonly paymentApi = inject(Tmf676ApiService);

  @Input({ required: true }) payment!: Payment;

  @Input({ required: true }) formatAmount!: (amount: number) => string;

  isRefundPayment(): boolean {
    return !!this.payment.isRefund || !!this.payment.originalPaymentId;
  }

  showTrashButton(): boolean {
    return this.payment.status === 'completed' && !this.isRefundPayment();
  }

  onTrashClick(): void {
    if (this.isRefundPayment()) {
      return;
    }

    if (this.payment.status === 'completed' || this.payment.status === 'authorized') {
      this.startRefund();
      return;
    }

    this.paymentApi
      .cancelPayment(this.payment.id, 'Removed from checkout by cashier')
      .subscribe({
        error: (err) => {
          console.error(`Failed to cancel payment ${this.payment.id}:`, err);
        },
      });
  }

  private startRefund(): void {
    const originalAmount = this.payment.amount?.value || 0;
    const refundAmount = originalAmount === 0 ? 0 : -originalAmount;

    this.paymentApi
      .createPayment({
        externalId: this.payment.externalId,
        amount: {
          unit: this.payment.amount?.unit || 'EUR',
          value: refundAmount,
        },
        description: `Refund for payment ${this.payment.id}`,
        originalPaymentId: this.payment.id,
        paymentMethod: this.payment.paymentMethod,
        relatedParty: this.payment.relatedParty,
        paymentDate: new Date().toISOString(),
      })
      .subscribe({
        error: (err) => {
          console.error(`Failed to create refund for payment ${this.payment.id}:`, err);
        },
      });
  }

  /**
   * Get status badge class.
   */
  getStatusClass(status?: string): string {
    switch (status) {
      case 'completed':
      case 'authorized':
        return 'status-completed';
      case 'pending':
        return 'status-pending';
      case 'failed':
      case 'cancelled':
        return 'status-failed';
      default:
        return 'status-default';
    }
  }
}
