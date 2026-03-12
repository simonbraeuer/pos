import { CommonModule } from '@angular/common';
import { Component, Input, inject, signal } from '@angular/core';
import { Tmf676ApiService, Payment } from '@pos/tmf676';

@Component({
  selector: 'pos-pending-payment-card-offline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="pending-card">
      <h3 class="pending-card__title">Card Payment Pending</h3>

      @if (!finalizing()) {
        <p class="pending-card__message">{{ instructionMessage() }}</p>
        <p class="pending-card__card-info">{{ cardInfo() }}</p>
        <p class="pending-card__amount">{{ formatAmount(paymentAmount()) }}</p>

        <button class="pending-card__confirm" (click)="finalizePayment()">
          Ok
        </button>
      } @else {
        <div class="pending-card__finalizing">
          <div class="pending-card__spinner" aria-hidden="true"></div>
          <span>Finalizing...</span>
        </div>
      }

      @if (error()) {
        <p class="pending-card__error">{{ error() }}</p>
      }
    </section>
  `,
  styles: [
    `
      .pending-card {
        background: #ffffff;
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
        border: 1px solid #dcdcdc;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .pending-card__title {
        margin: 0;
        color: #2f2f2f;
        font-size: 1.25rem;
      }

      .pending-card__message {
        margin: 0;
        color: #333;
        line-height: 1.5;
        font-size: 0.95rem;
      }

      .pending-card__card-info {
        margin: 0;
        color: #666;
        font-size: 0.85rem;
        font-family: monospace;
        background: #f5f5f5;
        padding: 0.5rem 0.75rem;
        border-radius: 4px;
      }

      .pending-card__amount {
        margin: 0;
        font-size: 2rem;
        font-weight: 700;
        color: #1a237e;
        text-align: center;
      }

      .pending-card__confirm {
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

      .pending-card__finalizing {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        font-weight: 600;
        color: #444;
      }

      .pending-card__spinner {
        width: 20px;
        height: 20px;
        border: 3px solid #d6d6d6;
        border-top-color: #1a237e;
        border-radius: 50%;
        animation: pending-card-spin 0.8s linear infinite;
      }

      .pending-card__error {
        margin: 0;
        color: #b71c1c;
        font-size: 0.9rem;
        text-align: center;
      }

      @keyframes pending-card-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class PendingPaymentCardOfflineComponent {
  private paymentApi = inject(Tmf676ApiService);

  @Input({ required: true }) payment!: Payment;

  finalizing = signal(false);
  error = signal<string | null>(null);

  paymentAmount(): number {
    return this.payment.amount?.value || 0;
  }

  instructionMessage(): string {
    return 'Please ensure the payment has been successfully processed on the EFT device. Click "Ok" to finalize.';
  }

  cardInfo(): string {
    const description = this.payment.description || '';
    // Extract masked card from description (format: "💳 Credit Card payment - **** **** **** 1234")
    const cardMatch = description.match(/\*{4}\s\*{4}\s\*{4}\s\d{4}/);
    return cardMatch ? cardMatch[0] : 'Card payment';
  }

  formatAmount(amount: number): string {
    return `€${amount.toFixed(2)}`;
  }

  finalizePayment(): void {
    this.finalizing.set(true);
    this.error.set(null);

    this.paymentApi.updatePayment(this.payment.id, { status: 'completed' }).subscribe({
      next: () => {
        this.finalizing.set(false);
      },
      error: (err) => {
        this.finalizing.set(false);
        this.error.set(err?.message || 'Failed to finalize payment');
      },
    });
  }
}
