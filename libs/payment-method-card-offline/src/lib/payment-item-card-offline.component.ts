import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Payment, Tmf676ApiService } from '@pos/tmf676';

@Component({
  selector: 'pos-payment-item-card-offline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-item-card-offline.component.html',
  styleUrl: './payment-item-card-offline.component.scss',
})
export class PaymentItemCardOfflineComponent {
  private readonly paymentApi = inject(Tmf676ApiService);

  @Input({ required: true }) payment!: Payment;
  @Input({ required: true }) formatAmount!: (amount: number) => string;

  isRefundPayment(): boolean {
    return !!this.payment.isRefund || !!this.payment.originalPaymentId;
  }

  showTrashButton(): boolean {
    return this.payment.status === 'completed' && !this.isRefundPayment();
  }

  getCardInfo(): { brand: string; lastFour: string } {
    const description = this.payment.description || '';
    // Extract card type and number from description
    // Format: "💳 Credit Card payment - **** **** **** 1234"
    let brand = 'Card';
    if (description.includes('Credit Card')) {
      brand = '💳 Credit Card';
    } else if (description.includes('Debit Card')) {
      brand = '💳 Debit Card';
    }

    const cardMatch = description.match(/\*{4}\s\*{4}\s\*{4}\s(\d{4})/);
    const lastFour = cardMatch ? cardMatch[1] : 'XXXX';

    return { brand, lastFour };
  }

  displayAmount(): number {
    return Math.abs(this.payment.amount?.value || 0);
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
        paymentDate: new Date().toISOString(),
        amount: { unit: 'EUR', value: refundAmount },
        description: `Refund: ${this.payment.description}`,
        isRefund: true,
        originalPaymentId: this.payment.id,
        paymentMethod: this.payment.paymentMethod,
      })
      .subscribe({
        error: (err) => {
          console.error(`Failed to start refund for payment ${this.payment.id}:`, err);
        },
      });
  }
}
