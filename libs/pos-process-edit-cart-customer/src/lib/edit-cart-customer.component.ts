import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProcessContentLayoutComponent } from '@pos/core-ui';
import { Tmf663ApiService } from '@pos/tmf663';

@Component({
  selector: 'pos-edit-cart-customer',
  standalone: true,
  imports: [CommonModule, FormsModule, ProcessContentLayoutComponent],
  template: `
    <lib-process-content-layout
      icon="👤"
      title="Edit cart customer"
      [showAbort]="true"
      (abort)="goBack()"
    >
      <div slot="content" class="customer-content">
        @if (error()) {
          <div class="error">{{ error() }}</div>
        }

        @if (success()) {
          <div class="success">{{ success() }}</div>
        }

        <form class="customer-form" (submit)="$event.preventDefault(); addToCart()">
          <div class="form-group">
            <label for="customer-name">Customer name *</label>
            <input
              id="customer-name"
              type="text"
              name="customerName"
              [(ngModel)]="customerName"
              placeholder="Enter customer name"
              required
            />
          </div>

          <div class="form-group">
            <label for="customer-email">Email</label>
            <input
              id="customer-email"
              type="email"
              name="customerEmail"
              [(ngModel)]="customerEmail"
              placeholder="customer@example.com"
            />
          </div>

          <div class="form-group">
            <label for="customer-phone">Phone</label>
            <input
              id="customer-phone"
              type="text"
              name="customerPhone"
              [(ngModel)]="customerPhone"
              placeholder="+43 ..."
            />
          </div>
        </form>
      </div>

      <div slot="nav-buttons" class="form-actions">
        <button type="button" class="btn-secondary" (click)="goBack()" [disabled]="saving()">
          Back
        </button>
        <button type="button" class="btn-primary" (click)="addToCart()" [disabled]="saving()">
          @if (saving()) {
            Saving...
          } @else {
            Add to cart
          }
        </button>
      </div>
    </lib-process-content-layout>
  `,
  styles: [`
    .customer-content {
      max-width: 720px;
    }

    .customer-form {
      display: grid;
      gap: 1rem;
    }

    .form-group {
      display: grid;
      gap: 0.4rem;
    }

    label {
      font-weight: 600;
      color: #2c3e50;
    }

    input {
      padding: 0.6rem 0.7rem;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      font-size: 0.95rem;

      &:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
      }
    }

    .form-actions {
      display: flex;
      gap: 0.75rem;
    }

    .btn-primary,
    .btn-secondary {
      border: none;
      border-radius: 6px;
      padding: 0.55rem 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-primary {
      background: #0f7d3f;
      color: #fff;

      &:hover:not(:disabled) {
        background: #0d6b36;
      }
    }

    .btn-secondary {
      background: #7f8c8d;
      color: #fff;

      &:hover:not(:disabled) {
        background: #6c7879;
      }
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .error,
    .success {
      margin-bottom: 1rem;
      border-radius: 6px;
      padding: 0.75rem 0.9rem;
      font-size: 0.9rem;
    }

    .error {
      background: #fff1f2;
      border: 1px solid #fecdd3;
      color: #b42318;
    }

    .success {
      background: #ecfdf3;
      border: 1px solid #abefc6;
      color: #067647;
    }
  `],
})
export class EditCartCustomerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cartApi = inject(Tmf663ApiService);

  saving = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  customerName = '';
  customerEmail = '';
  customerPhone = '';

  ngOnInit(): void {
    const cartId = this.getCartId();
    if (!cartId) {
      this.error.set('Cart id is missing.');
      return;
    }

    this.cartApi.getCart(cartId).subscribe({
      next: (cart) => {
        this.customerName = cart.customer?.name ?? '';
        this.customerEmail = cart.customer?.email ?? '';
        this.customerPhone = cart.customer?.phone ?? '';
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load cart customer.');
      },
    });
  }

  addToCart(): void {
    const cartId = this.getCartId();
    if (!cartId) {
      this.error.set('Cart id is missing.');
      return;
    }

    const name = this.customerName.trim();
    if (!name) {
      this.error.set('Customer name is required.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    this.cartApi
      .updateCart(cartId, {
        customer: {
          name,
          email: this.customerEmail.trim() || undefined,
          phone: this.customerPhone.trim() || undefined,
        },
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.success.set('Customer added to cart.');
          this.goBack();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.message || 'Failed to save customer data.');
        },
      });
  }

  goBack(): void {
    const cartId = this.getCartId();
    if (!cartId) {
      this.router.navigate(['/']);
      return;
    }

    this.router.navigate(['/cart', cartId, 'find-sale-offer']);
  }

  private getCartId(): string | null {
    return this.route.parent?.snapshot.paramMap.get('cart-id') ?? null;
  }
}
