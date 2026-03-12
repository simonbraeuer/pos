import { CommonModule } from '@angular/common';
import { Component, Input, effect, inject, signal } from '@angular/core';
import { Tmf676ApiService, Payment } from '@pos/tmf676';

@Component({
  selector: 'pos-pending-refund-default',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="pending-refund-default">
      <h3 class="pending-refund-default__title">Refund Processing</h3>
      <p class="pending-refund-default__method">{{ refundMethodLabel() }}</p>

      @if (finalizing()) {
        <div class="pending-refund-default__spinner-group">
          <div class="pending-refund-default__spinner" aria-hidden="true"></div>
          <span>Finalizing refund...</span>
        </div>
      }

      @if (error()) {
        <p class="pending-refund-default__error">{{ error() }}</p>
        <div class="pending-refund-default__actions">
          <button
            class="pending-refund-default__button pending-refund-default__button--secondary"
            type="button"
            (click)="abort()"
            [disabled]="finalizing()"
          >
            Abort
          </button>
          <button
            class="pending-refund-default__button pending-refund-default__button--primary"
            type="button"
            (click)="retry()"
            [disabled]="finalizing()"
          >
            Retry
          </button>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .pending-refund-default {
        background: #ffffff;
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
        border: 1px solid #dcdcdc;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .pending-refund-default__title {
        margin: 0;
        color: #2f2f2f;
        font-size: 1.25rem;
      }

      .pending-refund-default__method {
        margin: 0;
        color: #444;
        font-size: 0.95rem;
      }

      .pending-refund-default__spinner-group {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        font-weight: 600;
        color: #444;
      }

      .pending-refund-default__spinner {
        width: 20px;
        height: 20px;
        border: 3px solid #d6d6d6;
        border-top-color: #1a237e;
        border-radius: 50%;
        animation: pending-refund-default-spin 0.8s linear infinite;
      }

      .pending-refund-default__error {
        margin: 0;
        color: #b71c1c;
        font-size: 0.9rem;
      }

      .pending-refund-default__actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }

      .pending-refund-default__button {
        border: none;
        border-radius: 6px;
        padding: 0.625rem 1rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        &--secondary {
          background: #f5f5f5;
          border: 1px solid #ddd;
          color: #333;
        }

        &--primary {
          background: #1a237e;
          color: #fff;
        }
      }

      @keyframes pending-refund-default-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class PendingRefundDefaultComponent {
  private readonly paymentApi = inject(Tmf676ApiService);

  @Input({ required: true }) payment!: Payment;
  @Input() onRefundFinalized?: (paymentId: string) => void;

  finalizing = signal(false);
  error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.payment?.id) {
        this.retry();
      }
    });
  }

  refundMethodLabel(): string {
    const method = this.payment?.paymentMethod;
    const amount = this.payment?.amount?.value || 0;
    const absValue = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    return `${method?.name || 'Refund'}: ${sign}EUR ${absValue.toFixed(2)}`;
  }

  retry(): void {
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

  abort(): void {
    if (!this.payment?.id || this.finalizing()) {
      return;
    }

    this.finalizing.set(true);
    this.error.set(null);

    this.paymentApi.cancelPayment(this.payment.id, 'Refund aborted by cashier').subscribe({
      next: () => {
        this.finalizing.set(false);
        this.onRefundFinalized?.(this.payment.id);
      },
      error: (err) => {
        this.finalizing.set(false);
        this.error.set(err?.message || 'Failed to abort refund');
      },
    });
  }
}
