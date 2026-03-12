import { CommonModule } from '@angular/common';
import { Component, Input, inject, signal } from '@angular/core';
import { Tmf676ApiService, Payment } from '@pos/tmf676';

@Component({
  selector: 'pos-pending-refund-card-offline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="pending-refund-card">
      <h3 class="pending-refund-card__title">Card Refund Pending</h3>
      <p class="pending-refund-card__message">{{ instructionMessage() }}</p>
      <p class="pending-refund-card__card-info">{{ cardInfo() }}</p>
      <p class="pending-refund-card__amount">{{ formatAmount(paymentAmount()) }}</p>

      @if (!finalizing()) {
        <button class="pending-refund-card__confirm" (click)="finalizeRefund()" type="button">
          Ok
        </button>
      } @else {
        <div class="pending-refund-card__finalizing">
          <div class="pending-refund-card__spinner" aria-hidden="true"></div>
          <span>Finalizing refund...</span>
        </div>
      }

      @if (error()) {
        <p class="pending-refund-card__error">{{ error() }}</p>
      }
    </section>
  `,
  styles: [
    `
      .pending-refund-card {
        background: #ffffff;
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
        border: 1px solid #dcdcdc;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .pending-refund-card__title {
        margin: 0;
        color: #2f2f2f;
        font-size: 1.25rem;
      }

      .pending-refund-card__message {
        margin: 0;
        color: #333;
        line-height: 1.5;
        font-size: 0.95rem;
      }

      .pending-refund-card__card-info {
        margin: 0;
        color: #666;
        font-size: 0.85rem;
        font-family: monospace;
        background: #f5f5f5;
        padding: 0.5rem 0.75rem;
        border-radius: 4px;
      }

      .pending-refund-card__amount {
        margin: 0;
        font-size: 2rem;
        font-weight: 700;
        color: #1a237e;
        text-align: center;
      }

      .pending-refund-card__confirm {
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

      .pending-refund-card__finalizing {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        font-weight: 600;
        color: #444;
      }

      .pending-refund-card__spinner {
        width: 20px;
        height: 20px;
        border: 3px solid #d6d6d6;
        border-top-color: #1a237e;
        border-radius: 50%;
        animation: pending-refund-card-spin 0.8s linear infinite;
      }

      .pending-refund-card__error {
        margin: 0;
        color: #b71c1c;
        font-size: 0.9rem;
        text-align: center;
      }

      @keyframes pending-refund-card-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class PendingRefundCardOfflineComponent {
  private paymentApi = inject(Tmf676ApiService);

  @Input({ required: true }) payment!: Payment;

  finalizing = signal(false);
  error = signal<string | null>(null);

  paymentAmount(): number {
    return Math.abs(this.payment.amount?.value || 0);
  }

  instructionMessage(): string {
    return 'Please ensure the refund has been successfully processed on the EFT device. Click "Ok" to finalize.';
  }

  cardInfo(): string {
    const description = this.payment.description || '';
    // Extract masked card from description
    const cardMatch = description.match(/\*{4}\s\*{4}\s\*{4}\s\d{4}/);
    return cardMatch ? cardMatch[0] : 'Card refund';
  }

  formatAmount(amount: number): string {
    return `€${amount.toFixed(2)}`;
  }

  finalizeRefund(): void {
    this.finalizing.set(true);
    this.error.set(null);

    this.paymentApi.updatePayment(this.payment.id, { status: 'completed' }).subscribe({
      next: () => {
        this.finalizing.set(false);
      },
      error: (err) => {
        this.finalizing.set(false);
        this.error.set(err?.message || 'Failed to finalize refund');
      },
    });
  }
}
