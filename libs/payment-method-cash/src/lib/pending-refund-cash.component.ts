import { CommonModule } from '@angular/common';
import { Component, Input, inject, signal } from '@angular/core';
import { Tmf676ApiService, Payment } from '@pos/tmf676';

@Component({
  selector: 'pos-pending-refund-cash',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="pending-refund-cash">
      <h3 class="pending-refund-cash__title">Cash Refund Pending</h3>
      <p class="pending-refund-cash__message">{{ instructionMessage() }}</p>
      <p class="pending-refund-cash__amount">{{ formatAmount(paymentAmount()) }}</p>

      @if (!finalizing()) {
        <button class="pending-refund-cash__confirm" (click)="finalizeRefund()" type="button">
          Ok
        </button>
      } @else {
        <div class="pending-refund-cash__finalizing">
          <div class="pending-refund-cash__spinner" aria-hidden="true"></div>
          <span>Finalizing refund...</span>
        </div>
      }

      @if (error()) {
        <p class="pending-refund-cash__error">{{ error() }}</p>
      }
    </section>
  `,
  styles: [
    `
      .pending-refund-cash {
        background: #ffffff;
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
        border: 1px solid #dcdcdc;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .pending-refund-cash__title {
        margin: 0;
        color: #2f2f2f;
        font-size: 1.25rem;
      }

      .pending-refund-cash__message {
        margin: 0;
        color: #333;
        line-height: 1.5;
      }

      .pending-refund-cash__amount {
        margin: 0;
        font-size: 2rem;
        font-weight: 700;
        color: #1a237e;
        text-align: center;
      }

      .pending-refund-cash__confirm {
        align-self: flex-end;
        min-width: 8rem;
        border: none;
        border-radius: 8px;
        padding: 0.65rem 1.2rem;
        background: #1a237e;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }

      .pending-refund-cash__finalizing {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        font-weight: 600;
        color: #444;
      }

      .pending-refund-cash__spinner {
        width: 20px;
        height: 20px;
        border: 3px solid #d6d6d6;
        border-top-color: #1a237e;
        border-radius: 50%;
        animation: pending-refund-cash-spin 0.8s linear infinite;
      }

      .pending-refund-cash__error {
        margin: 0;
        color: #b71c1c;
        font-size: 0.9rem;
        text-align: center;
      }

      @keyframes pending-refund-cash-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class PendingRefundCashComponent {
  private readonly paymentApi = inject(Tmf676ApiService);

  @Input({ required: true }) payment!: Payment;
  @Input() onRefundFinalized?: (paymentId: string) => void;

  finalizing = signal(false);
  error = signal<string | null>(null);

  paymentAmount(): number {
    return this.payment?.amount?.value || 0;
  }

  instructionMessage(): string {
    return this.paymentAmount() < 0
      ? 'Please take cash from the drawer and hand it to the customer.'
      : 'Please receive the cash from the customer to balance this refund correction.';
  }

  formatAmount(amount: number): string {
    const absValue = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    return `${sign}EUR ${absValue.toFixed(2)}`;
  }

  finalizeRefund(): void {
    if (!this.payment?.id || this.finalizing()) {
      return;
    }

    this.finalizing.set(true);
    this.error.set(null);

    this.paymentApi
      .updatePayment(this.payment.id, {
        status: 'completed',
        completionDate: new Date().toISOString(),
        remainingAmount: {
          unit: this.payment.amount?.unit || 'EUR',
          value: 0,
        },
      })
      .subscribe({
        next: () => {
          this.finalizing.set(false);
          this.onRefundFinalized?.(this.payment.id);
        },
        error: (err) => {
          this.finalizing.set(false);
          this.error.set(err?.message || 'Failed to finalize refund');
        },
      });
  }
}
