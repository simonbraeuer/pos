import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductOrder, Tmf622ApiService } from '@pos/tmf622';
import { Payment, Tmf676ApiService, Tmf676EventsService } from '@pos/tmf676';
import { ProcessContentLayoutComponent } from '@pos/core-ui';
import { LocationApiService } from '@pos/location';
import { DeviceApiService } from '@pos/device';
import { ShiftApiService } from '@pos/shift';
import { RegisterApiService } from '@pos/register';
import { OrderCompleteComponent } from './order-complete.component';

@Component({
  selector: 'pos-order-process-checkout-complete',
  standalone: true,
  imports: [CommonModule, ProcessContentLayoutComponent, OrderCompleteComponent],
  template: `
    <lib-process-content-layout
      icon="✅"
      [title]="processTitle()"
    >
      <div slot="filter" class="checkout-complete-status">
        <div class="checkout-summary-grid">
          @for (item of checkoutSummaryItems(); track item.label) {
            <div class="checkout-summary-item">
              <span class="checkout-summary-item__label">{{ item.label }}</span>
              <span class="checkout-summary-item__value">{{ item.value }}</span>
            </div>
          }
        </div>
      </div>

      <div slot="content">
        @if (loading()) {
          <div class="checkout-complete-loading">Loading completed transaction...</div>
        } @else if (error()) {
          <div class="checkout-complete-error">
            <p>{{ error() }}</p>
            <button type="button" class="btn-back" (click)="goBackToCheckout()">Back to Checkout</button>
          </div>
        } @else if (order()) {
          <pos-order-complete [order]="order()!" [payments]="payments()" />
        }
      </div>

      <div slot="nav-buttons">
        <button
          type="button"
          class="btn-done"
          [disabled]="loading()"
          (click)="finish()"
        >
          Done
        </button>
      </div>
    </lib-process-content-layout>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
      }

      lib-process-content-layout {
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
      }

      .checkout-complete-status {
        --summary-bg: linear-gradient(120deg, #f4fbf8 0%, #eef7ff 100%);
        --summary-border: #c8ddd3;
        --summary-label: #486157;
        --summary-value: #163d2b;
        --summary-item-bg: rgba(255, 255, 255, 0.82);
        --summary-item-border: rgba(42, 98, 73, 0.2);
        --summary-item-shadow: 0 2px 8px rgba(20, 44, 31, 0.08);

        padding: 0.55rem;
        border: 1px solid var(--summary-border);
        border-radius: 12px;
        background: var(--summary-bg);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
        font-family: 'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', sans-serif;
      }

      .checkout-summary-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.5rem;
      }

      .checkout-summary-item {
        min-width: 0;
        display: flex;
        align-items: baseline;
        gap: 0.45rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding: 0.38rem 0.5rem;
        border-radius: 8px;
        border: 1px solid var(--summary-item-border);
        background: var(--summary-item-bg);
        box-shadow: var(--summary-item-shadow);
      }

      .checkout-summary-item__label {
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--summary-label);
      }

      .checkout-summary-item__value {
        min-width: 0;
        font-size: 0.88rem;
        font-weight: 700;
        color: var(--summary-value);
        overflow: hidden;
        text-overflow: ellipsis;
      }

      @media (max-width: 1200px) {
        .checkout-summary-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 760px) {
        .checkout-summary-grid {
          grid-template-columns: 1fr;
        }
      }

      .checkout-complete-loading,
      .checkout-complete-error {
        padding: 2rem;
        text-align: center;
        color: #46535d;
        font-family: 'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', sans-serif;
      }

      .checkout-complete-error {
        color: #b00020;
      }

      .btn-back {
        margin-top: 0.75rem;
        padding: 0.5rem 0.95rem;
        border: 1px solid #b4c8bc;
        border-radius: 8px;
        background: #f9fffb;
        color: #244b38;
        font-weight: 600;
        cursor: pointer;
      }

      .btn-done {
        min-width: 7rem;
        padding: 0.62rem 1.05rem;
        border: 1px solid #0d5941;
        border-radius: 9px;
        background: linear-gradient(120deg, #167a56 0%, #0f6446 100%);
        color: #fff;
        font-weight: 700;
        letter-spacing: 0.01em;
        box-shadow: 0 5px 14px rgba(19, 99, 70, 0.3);
        cursor: pointer;

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
    `,
  ],
})
export class OrderProcessCheckoutCompleteComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderApi = inject(Tmf622ApiService);
  private readonly paymentApi = inject(Tmf676ApiService);
  private readonly paymentEvents = inject(Tmf676EventsService);
  private readonly locationApi = inject(LocationApiService);
  private readonly deviceApi = inject(DeviceApiService);
  private readonly shiftApi = inject(ShiftApiService);
  private readonly registerApi = inject(RegisterApiService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly order = signal<ProductOrder | null>(this.route.parent?.snapshot.data['order'] || null);
  readonly payments = signal<Payment[]>([]);
  readonly locationSummary = signal<string>('Unknown');
  readonly deviceSummary = signal<string>('Unknown');
  readonly cashierSummary = signal<string>('Unknown');
  readonly shiftSummary = signal<string>('Unknown');

  readonly orderId = signal<string | null>(
    this.route.parent?.snapshot.paramMap.get('orderid') || this.order()?.id || null
  );

  readonly processTitle = computed(() => {
    const orderNumber = this.order()?.id ?? this.orderId() ?? 'Unknown';
    return `Checkout Complete - Order ${orderNumber}`;
  });

  readonly checkoutSummaryItems = computed(() => {
    return [
      { label: 'Location', value: this.locationSummary() },
      { label: 'Device', value: this.deviceSummary() },
      { label: 'Cashier', value: this.cashierSummary() },
      { label: 'Shift', value: this.shiftSummary() },
      { label: 'Payments', value: this.paymentCountLabel() },
      { label: 'Paid', value: this.paymentAmountLabel() },
    ];
  });

  readonly paymentCountLabel = computed(() => {
    const all = this.payments();
    const completed = all.filter((p) => p.status === 'completed' || p.status === 'authorized').length;
    return `${completed}/${all.length}`;
  });

  readonly paymentAmountLabel = computed(() => {
    const paid = this.payments()
      .filter((p) => p.status === 'completed' || p.status === 'authorized')
      .reduce((sum, p) => sum + (p.amount?.value || 0), 0);

    const total = this.order()?.orderTotalPrice?.[0]?.price?.taxIncludedAmount?.value || 0;
    return `${this.formatCurrency(paid)} / ${this.formatCurrency(total)}`;
  });

  constructor() {
    effect((onCleanup) => {
      const orderId = this.orderId();
      if (!orderId) {
        this.loading.set(false);
        this.error.set('Order ID is missing.');
        return;
      }

      this.refresh(orderId);
      const sub = this.paymentEvents.getOrderPaymentEvents(orderId).subscribe(() => {
        this.refresh(orderId);
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  private resolveOperationalSummary(order: ProductOrder): void {
    const relatedParty = order.relatedParty || [];

    const locationRef = relatedParty.find((party) => party.role === 'location');
    const deviceRef = relatedParty.find((party) => party.role === 'device');
    const cashierRef = relatedParty.find((party) => party.role === 'cashier');
    const shiftRef = relatedParty.find((party) => party.role === 'shift');
    const registerRef = relatedParty.find((party) => party.role === 'register');

    this.locationSummary.set(locationRef?.name || 'Unknown');
    this.deviceSummary.set(deviceRef?.name || 'Unknown');
    this.cashierSummary.set(cashierRef?.name || cashierRef?.id || 'Unknown');
    this.shiftSummary.set(shiftRef?.id ? `#${shiftRef.id}` : 'Unknown');

    const locationId = this.toNumericId(locationRef?.id);
    if (locationId !== null) {
      this.locationApi.getLocation(locationId).subscribe({
        next: (location) => this.locationSummary.set(location.fullName || location.name || String(location.id)),
      });
    }

    const deviceId = this.toNumericId(deviceRef?.id);
    if (deviceId !== null) {
      this.deviceApi.getDevice(deviceId).subscribe({
        next: (device) => this.deviceSummary.set(device.name || device.code || String(device.id)),
      });
    }

    const shiftId = this.toNumericId(shiftRef?.id);
    if (shiftId !== null) {
      this.shiftApi.getShift(shiftId).subscribe({
        next: (shift) => {
          const statusPart = shift.status ? `, ${shift.status}` : '';
          this.shiftSummary.set(`#${shift.id}${statusPart}`);

          const registerId = this.toNumericId(registerRef?.id) ?? shift.registerId;
          if (registerId !== null && registerId !== undefined) {
            this.registerApi.getRegister(registerId).subscribe({
              next: (register) => {
                const base = `#${shift.id}${statusPart}`;
                this.shiftSummary.set(`${base}, ${register.code}`);
              },
            });
          }
        },
      });
      return;
    }

    const registerId = this.toNumericId(registerRef?.id);
    if (registerId !== null) {
      this.registerApi.getRegister(registerId).subscribe({
        next: (register) => this.shiftSummary.set(register.code || String(register.id)),
      });
    }
  }

  private toNumericId(value?: string): number | null {
    if (!value) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  goBackToCheckout(): void {
    this.router.navigate(['../checkout'], { relativeTo: this.route });
  }

  finish(): void {
    this.router.navigate(['/new-cart']);
  }

  private refresh(orderId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.orderApi.getProductOrder(orderId).subscribe({
      next: (order) => {
        this.order.set(order);
        this.resolveOperationalSummary(order);
        this.paymentApi.searchPayments({ externalId: orderId }, 0, 100).subscribe({
          next: (result) => {
            this.payments.set(result.items);
            this.loading.set(false);
          },
          error: () => {
            this.error.set('Failed to load payments for completed transaction.');
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set('Failed to load order for completed transaction.');
        this.loading.set(false);
      },
    });
  }

}
