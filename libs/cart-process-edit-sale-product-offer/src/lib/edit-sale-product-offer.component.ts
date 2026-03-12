import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProcessContentLayoutComponent } from '@pos/core-ui';
import {
  AddCartPositionRequest,
  CartItem,
  SaleOfferSearchResult,
  ShoppingCart,
  Tmf663ApiService,
} from '@pos/tmf663';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'pos-edit-sale-product-offer',
  standalone: true,
  imports: [CommonModule, ProcessContentLayoutComponent, FormsModule, DecimalPipe],
  template: `
    <lib-process-content-layout
      icon="🛍️"
      [title]="isEditMode() ? 'Edit Sale Product Position' : 'Create Sale Product Position'"
      [showAbort]="true"
      (abort)="cancel()"
    >
      <div slot="content">
        @if (offer()) {
          <div class="offer-header">
            <h4>{{ offer()!.name }}</h4>
            <p class="offer-meta">
              Product #{{ offer()!.productNumber }} | 
              From {{ offer()!.cheapestPrice | number : '1.2-2' }} {{ offer()!.currency }}
            </p>
          </div>

          @if (formError()) {
            <div class="error">{{ formError() }}</div>
          }

          <form (submit)="savePosition()" class="offer-form">
            <div class="form-group">
              <label>Quantity *</label>
              <input 
                type="number" 
                min="1" 
                [(ngModel)]="draft.quantity" 
                name="quantity"
                required
              />
              @if (validation['quantity']) {
                <span class="field-error">{{ validation['quantity'] }}</span>
              }
            </div>

            @if (offer()!.requiredFields.includes('serialNumber')) {
              <div class="form-group">
                <label>Serial Number *</label>
                <input 
                  type="text" 
                  [(ngModel)]="draft.serialNumber" 
                  name="serialNumber"
                  placeholder="Enter serial number"
                  required
                />
                @if (validation['serialNumber']) {
                  <span class="field-error">{{ validation['serialNumber'] }}</span>
                }
                @if (offer()!.knownSerialNumbers && offer()!.knownSerialNumbers!.length > 0) {
                  <div class="hint">
                    Known serials: {{ offer()!.knownSerialNumbers!.join(', ') }}
                  </div>
                }
              </div>
            }

            @if (offer()!.requiredFields.includes('customerReference')) {
              <div class="form-group">
                <label>Customer Reference *</label>
                <input 
                  type="text" 
                  [(ngModel)]="draft.customerReference" 
                  name="customerReference"
                  placeholder="Enter customer reference"
                  required
                />
                @if (validation['customerReference']) {
                  <span class="field-error">{{ validation['customerReference'] }}</span>
                }
              </div>
            }

          </form>

          @if (success()) {
            <div class="success">{{ success() }}</div>
          }
        } @else {
          <p class="error">{{ isEditMode() ? 'Position' : 'Offer' }} not found or failed to load.</p>
          <button class="btn-secondary" (click)="cancel()">{{ isEditMode() ? 'Back to Cart' : 'Back to Search' }}</button>
        }
      </div>

      <div slot="nav-buttons" class="form-actions">
        <button 
          type="button" 
          class="btn-secondary" 
          (click)="cancel()"
          [disabled]="saving()"
        >
          Cancel
        </button>
        <button 
          type="button" 
          class="btn-primary" 
          [disabled]="saving()"
          (click)="savePosition()"
        >
          @if (saving()) { 
            {{ isEditMode() ? 'Updating...' : 'Adding...' }}
          } @else { 
            {{ isEditMode() ? 'Update Position' : 'Add to cart' }}
          }
        </button>
      </div>
    </lib-process-content-layout>
  `,
  styles: [`
    .offer-header {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;

      h4 {
        margin: 0 0 0.5rem;
        color: #2c3e50;
      }

      .offer-meta {
        margin: 0;
        color: #7f8c8d;
        font-size: 0.9rem;
      }
    }

    .offer-form {
      max-width: 600px;
    }

    .form-group {
      margin-bottom: 1.5rem;

      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
        color: #2c3e50;
      }

      input {
        width: 100%;
        padding: 0.6rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 0.95rem;

        &:focus {
          outline: none;
          border-color: #3498db;
          box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }
      }

      .field-error {
        display: block;
        color: #e74c3c;
        font-size: 0.85rem;
        margin-top: 0.25rem;
      }

      .hint {
        margin-top: 0.5rem;
        font-size: 0.85rem;
        color: #7f8c8d;
      }
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
    }

    button {
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &.btn-primary {
        background: #3498db;
        color: white;

        &:hover:not(:disabled) {
          background: #2980b9;
        }
      }

      &.btn-secondary {
        background: #95a5a6;
        color: white;

        &:hover:not(:disabled) {
          background: #7f8c8d;
        }
      }
    }

    .error {
      padding: 1rem;
      background: #fee;
      color: #c0392b;
      border-radius: 6px;
      margin-bottom: 1rem;
    }

    .success {
      padding: 1rem;
      background: #d4edda;
      color: #155724;
      border-radius: 6px;
      margin-top: 1rem;
    }
  `],
})
export class EditSaleProductOfferComponent implements OnInit, OnDestroy {
  private api = inject(Tmf663ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  offer = signal<SaleOfferSearchResult | null>(null);
  saving = signal(false);
  formError = signal<string | null>(null);
  success = signal<string | null>(null);

  private position = signal<CartItem | null>(null);

  draft: AddCartPositionRequest = {
    offerId: '',
    quantity: 1,
    serialNumber: '',
    customerReference: '',
  };

  validation: Record<string, string> = {};
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.route.data
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.applyResolvedData(data['offer'] as SaleOfferSearchResult | null, data['position'] as CartItem | null));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isEditMode(): boolean {
    return this.position() !== null;
  }

  savePosition(): void {
    const offer = this.offer();
    if (!offer) return;

    this.validation = this.validate(offer);
    if (Object.keys(this.validation).length > 0) {
      return;
    }

    const cartId = this.route.parent?.snapshot.paramMap.get('cart-id');
    if (!cartId) {
      this.formError.set('No active cart context found.');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.success.set(null);

    if (this.isEditMode()) {
      // Edit mode: update existing position
      const position = this.position();
      if (!position) {
        this.formError.set('No position found for update.');
        this.saving.set(false);
        return;
      }

      this.api.updateCartItem(cartId, position.id, { quantity: this.draft.quantity }).subscribe({
        next: updated => {
          // Keep resolved cart object in sync so left cart panel refreshes immediately.
          const resolved = this.route.parent?.snapshot.data['cart'] as ShoppingCart | undefined;
          if (resolved) {
            resolved.cartItem = updated.cartItem;
            resolved.cartTotalPrice = updated.cartTotalPrice;
          }

          this.success.set(`Updated ${offer.name} in cart.`);
          this.saving.set(false);
          setTimeout(() => this.cancel(), 700);
        },
        error: err => {
          this.formError.set(err?.message ?? 'Failed to update item in cart.');
          this.saving.set(false);
        },
      });
    } else {
      // Create mode: add new position
      this.api.addOfferToCart(cartId, this.draft).subscribe({
        next: updated => {
          // Keep resolved cart object in sync so left cart panel refreshes immediately.
          const resolved = this.route.parent?.snapshot.data['cart'] as ShoppingCart | undefined;
          if (resolved) {
            resolved.cartItem = updated.cartItem;
            resolved.cartTotalPrice = updated.cartTotalPrice;
          }

          this.success.set(`Added ${offer.name} to cart.`);
          this.saving.set(false);
          
          // Navigate back to search after successful add
          setTimeout(() => this.cancel(), 1500);
        },
        error: err => {
          this.formError.set(err?.message ?? 'Failed to add item to cart.');
          this.saving.set(false);
        },
      });
    }
  }

  cancel(): void {
    const cartId = this.route.parent?.snapshot.paramMap.get('cart-id');
    if (!cartId) return;

    if (this.isEditMode()) {
      // Navigate back to cart list
      this.router.navigate(['/cart', cartId]);
    } else {
      // Navigate back to find-sale-offer
      this.router.navigate(['/cart', cartId, 'find-sale-offer']);
    }
  }

  private validate(offer: SaleOfferSearchResult): Record<string, string> {
    const out: Record<string, string> = {};

    if (!Number.isInteger(Number(this.draft.quantity)) || this.draft.quantity < 1) {
      out['quantity'] = 'Quantity must be a whole number greater than 0.';
    }

    if (offer.requiredFields.includes('serialNumber')) {
      const serial = this.draft.serialNumber?.trim() ?? '';
      if (!serial) {
        out['serialNumber'] = 'Serial number is required for this offer.';
      } else if (serial.length < 5) {
        out['serialNumber'] = 'Serial number looks too short.';
      }
    }

    if (offer.requiredFields.includes('customerReference')) {
      const ref = this.draft.customerReference?.trim() ?? '';
      if (!ref) {
        out['customerReference'] = 'Customer reference is required.';
      } else if (ref.length < 3) {
        out['customerReference'] = 'Customer reference must contain at least 3 characters.';
      }
    }

    return out;
  }

  private applyResolvedData(resolvedOffer: SaleOfferSearchResult | null, resolvedPosition: CartItem | null): void {
    // Reset transient UI state when route params/data change.
    this.formError.set(null);
    this.success.set(null);
    this.validation = {};

    this.position.set(null);

    if (resolvedOffer) {
      this.offer.set(resolvedOffer);
      this.draft.offerId = resolvedOffer.id;
      this.draft.quantity = 1;
      return;
    }

    if (resolvedPosition) {
      this.position.set(resolvedPosition);
      if (resolvedPosition.product) {
        this.offer.set({
          id: resolvedPosition.product.id,
          kind: 'product',
          name: resolvedPosition.product.name,
          productNumber: resolvedPosition.product.id,
          description: resolvedPosition.product.description,
          currency: 'EUR',
          cheapestPrice: resolvedPosition.itemPrice[0]?.price.taxIncludedAmount?.value || 0,
          requiredFields: [],
          knownSerialNumbers: [],
        });
        this.draft.offerId = resolvedPosition.product.id;
        this.draft.quantity = resolvedPosition.quantity;
      }
      return;
    }

    this.offer.set(null);
  }
}

