import { CommonModule } from '@angular/common';
import { Component, Input, inject, signal, effect } from '@angular/core';
import { Tmf676ApiService, Payment } from '@pos/tmf676';

@Component({
  selector: 'pos-pending-payment-default',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="pending-default">
      <h3 class="pending-default__title">Payment Processing</h3>

      <p class="pending-default__method">
        {{ paymentMethodLabel() }}
      </p>

      @switch (state()) {
        @case ('processing') {
          <div class="pending-default__spinner-group">
            <div class="pending-default__spinner" aria-hidden="true"></div>
            <span class="pending-default__status">Processing payment...</span>
          </div>
        }
        @case ('error') {
          <div class="pending-default__error-content">
            <p class="pending-default__error-message">{{ error() }}</p>
            <div class="pending-default__actions">
              <button
                class="pending-default__button pending-default__button--secondary"
                (click)="abort()"
                type="button"
              >
                Abort
              </button>
              <button
                class="pending-default__button pending-default__button--primary"
                (click)="retry()"
                type="button"
              >
                Retry
              </button>
            </div>
          </div>
        }
        @case ('success') {
          <p class="pending-default__success">Payment finalized successfully</p>
        }
      }
    </section>
  `,
  styles: [
    `
      .pending-default {
        background: #ffffff;
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
        border: 1px solid #dcdcdc;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-width: 360px;
      }

      .pending-default__title {
        margin: 0;
        color: #2f2f2f;
        font-size: 1.25rem;
      }

      .pending-default__method {
        margin: 0;
        color: #555;
        font-size: 0.95rem;
        padding: 0.75rem;
        background: #f9f9f9;
        border-radius: 6px;
        border-left: 3px solid #1a237e;
      }

      .pending-default__spinner-group {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 1.5rem;
        font-weight: 600;
        color: #444;
      }

      .pending-default__spinner {
        width: 24px;
        height: 24px;
        border: 3px solid #d6d6d6;
        border-top-color: #1a237e;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      .pending-default__status {
        font-size: 0.95rem;
      }

      .pending-default__error-content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .pending-default__error-message {
        margin: 0;
        padding: 0.875rem;
        background: #ffebee;
        border: 1px solid #ef5350;
        border-radius: 6px;
        color: #c62828;
        font-size: 0.875rem;
      }

      .pending-default__actions {
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
      }

      .pending-default__button {
        border: none;
        border-radius: 6px;
        padding: 0.625rem 1rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        &--secondary {
          background: #f5f5f5;
          border: 1px solid #ddd;
          color: #333;

          &:hover:not(:disabled) {
            background: #efefef;
            border-color: #bbb;
          }
        }

        &--primary {
          background: #1a237e;
          color: #fff;

          &:hover:not(:disabled) {
            background: #0d1442;
            box-shadow: 0 2px 8px rgba(26, 35, 126, 0.3);
          }
        }
      }

      .pending-default__success {
        margin: 0;
        padding: 0.875rem;
        background: #e8f5e9;
        border: 1px solid #4caf50;
        border-radius: 6px;
        color: #2e7d32;
        font-size: 0.875rem;
        text-align: center;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class PendingPaymentDefaultComponent {
  private readonly paymentApi = inject(Tmf676ApiService);

  @Input({ required: true }) payment!: Payment;
  @Input() onPaymentFinalized?: (paymentId: string) => void;

  state = signal<'processing' | 'error' | 'success'>('processing');
  error = signal<string | null>(null);

  constructor() {
    // Automatically attempt to finalize payment on component init
    effect(() => {
      if (this.payment?.id && this.state() === 'processing') {
        this.finalize();
      }
    });
  }

  paymentMethodLabel(): string {
    const method = this.payment?.paymentMethod;
    if (method?.name) {
      const amount = this.payment?.amount?.value || 0;
      const absValue = Math.abs(amount);
      const sign = amount < 0 ? '-' : '';
      const formatted = `${sign}EUR ${absValue.toFixed(2)}`;
      return `${method.name}: ${formatted}`;
    }
    return 'Payment processing';
  }

  retry(): void {
    this.state.set('processing');
    this.error.set(null);
    this.finalize();
  }

  abort(): void {
    if (!this.payment?.id) return;

    this.state.set('processing');
    this.error.set(null);

    this.paymentApi.cancelPayment(this.payment.id, 'Aborted by system').subscribe({
      next: () => {
        // Payment cancelled, return to checkout
        this.onPaymentFinalized?.(this.payment.id);
      },
      error: (err) => {
        this.state.set('error');
        this.error.set(err?.message || 'Failed to abort payment');
      },
    });
  }

  private finalize(): void {
    if (!this.payment?.id) {
      this.state.set('error');
      this.error.set('Invalid payment ID');
      return;
    }

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
          this.state.set('success');
          // Auto-dismiss after short delay
          setTimeout(() => {
            this.onPaymentFinalized?.(this.payment.id);
          }, 1000);
        },
        error: (err) => {
          this.state.set('error');
          this.error.set(err?.message || 'Failed to finalize payment');
        },
      });
  }
}
