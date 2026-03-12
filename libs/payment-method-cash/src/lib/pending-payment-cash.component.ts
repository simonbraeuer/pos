import { CommonModule } from '@angular/common';
import { Component, Input, inject, signal } from '@angular/core';
import { Tmf676ApiService, Payment } from '@pos/tmf676';

@Component({
  selector: 'pos-pending-payment-cash',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="pending-cash">
      <h3 class="pending-cash__title">Cash Payment Pending</h3>

      @if (!finalizing()) {
        <p class="pending-cash__message">{{ instructionMessage() }}</p>
        <p class="pending-cash__amount">{{ formatAmount(paymentAmount()) }}</p>

        <button class="pending-cash__confirm" (click)="finalizePayment()">
          Ok
        </button>
      } @else {
        <div class="pending-cash__finalizing">
          <div class="pending-cash__spinner" aria-hidden="true"></div>
          <span>Finalizing...</span>
        </div>
      }

      @if (error()) {
        <p class="pending-cash__error">{{ error() }}</p>
      }
    </section>
  `,
  styles: [
    `
      .pending-cash {
        background: #ffffff;
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
        border: 1px solid #dcdcdc;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .pending-cash__title {
        margin: 0;
        color: #2f2f2f;
        font-size: 1.25rem;
      }

      .pending-cash__message {
        margin: 0;
        color: #333;
        line-height: 1.5;
      }

      .pending-cash__amount {
        margin: 0;
        font-size: 2rem;
        font-weight: 700;
        color: #1a237e;
        text-align: center;
      }

      .pending-cash__confirm {
        align-self: flex-end;
        min-width: 8rem;
        border: none;
        border-radius: 8px;
        padding: 0.65rem 1.2rem;
        background: #1a237e;
        color: #fff;
        font-weight: 600;
        cursor: pointer;

        &:disabled {
          cursor: default;
          opacity: 0.7;
        }
      }

      .pending-cash__finalizing {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        font-weight: 600;
        color: #444;
      }

      .pending-cash__spinner {
        width: 20px;
        height: 20px;
        border: 3px solid #d6d6d6;
        border-top-color: #1a237e;
        border-radius: 50%;
        animation: pending-cash-spin 0.8s linear infinite;
      }

      .pending-cash__error {
        margin: 0;
        color: #b71c1c;
        font-size: 0.9rem;
        text-align: center;
      }

      @keyframes pending-cash-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class PendingPaymentCashComponent {
  private readonly paymentApi = inject(Tmf676ApiService);

  @Input({ required: true }) payment!: Payment;
  @Input() onPaymentFinalized?: (paymentId: string) => void;

  finalizing = signal(false);
  error = signal<string | null>(null);

  paymentAmount(): number {
    return this.payment?.amount?.value || 0;
  }

  instructionMessage(): string {
    return this.paymentAmount() < 0
      ? 'Please take cash from the drawer for this return payout.'
      : 'Please put cash into the drawer for this payment.';
  }

  formatAmount(amount: number): string {
    const absValue = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    return `${sign}EUR ${absValue.toFixed(2)}`;
  }

  finalizePayment(): void {
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
          this.onPaymentFinalized?.(this.payment.id);
          this.finalizing.set(false);
        },
        error: (err) => {
          this.finalizing.set(false);
          this.error.set(err?.message || 'Failed to finalize payment');
        },
      });
  }
}
