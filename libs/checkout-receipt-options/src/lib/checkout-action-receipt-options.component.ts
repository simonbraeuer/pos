import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReceiptOptionsService } from './receipt-options.service';

@Component({
  selector: 'pos-checkout-action-receipt-options',
  standalone: true,
  template: `
    <button class="action-button action-button--receipt" (click)="navigate()">
      <span class="action-button__icon">🧾</span>
      <span class="action-button__label">Receipt Options</span>
      <span class="action-button__sub">{{ outputLabel() }}</span>
    </button>
  `,
  styles: [`
    .action-button {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      padding: 0.7rem;
      border: 1px solid #78909c;
      border-radius: 4px;
      background: #90a4ae;
      color: #fff;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
      font-weight: 600;

      &:hover {
        background: #78909c;
        border-color: #607d8b;
      }

      &:active {
        background: #607d8b;
        border-color: #546e7a;
      }

      &:focus-visible {
        outline: 2px solid #cfd8dc;
        outline-offset: 2px;
      }

      &__icon {
        font-size: clamp(1.1rem, 1.8vw, 1.4rem);
        line-height: 1;
      }

      &__label {
        font-size: clamp(0.72rem, 1.1vw, 0.82rem);
        line-height: 1.05;
        text-align: center;
        word-break: break-word;
      }

      &__sub {
        font-size: clamp(0.6rem, 0.9vw, 0.7rem);
        font-weight: 400;
        opacity: 0.85;
        line-height: 1;
      }
    }

    @media (max-width: 1200px), (max-height: 850px) {
      .action-button {
        gap: 0.15rem;
        padding: 0.5rem;

        &__icon {
          font-size: clamp(0.9rem, 1.3vw, 1.1rem);
        }

        &__label {
          font-size: clamp(0.62rem, 0.85vw, 0.72rem);
          line-height: 1;
        }

        &__sub {
          display: none;
        }
      }
    }
  `],
})
export class CheckoutActionReceiptOptionsComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly receiptOptions = inject(ReceiptOptionsService);

  readonly outputLabel = computed(() => {
    const opts = this.receiptOptions.options();
    return opts.outputType === 'printer' ? '🖨️ Printer' : '📄 PDF';
  });

  navigate(): void {
    this.router.navigate(['../receipt-options'], { relativeTo: this.route });
  }
}
