import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProcessContentLayoutComponent } from '@pos/core-ui';
import {
  AddCartPositionRequest,
  BundleComponent,
  CartItem,
  SaleOfferSearchResult,
  ShoppingCart,
  Tmf663ApiService,
} from '@pos/tmf663';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'pos-edit-sale-bundle-offer',
  standalone: true,
  imports: [CommonModule, ProcessContentLayoutComponent, FormsModule, DecimalPipe],
  template: `
    <lib-process-content-layout
      icon="📦"
      [title]="isEditMode() ? 'Edit Sale Bundle Position' : 'Create Sale Bundle Position'"
      [showAbort]="true"
      (abort)="cancel()"
    >
      <div slot="content">
        @if (offer()) {
          <div class="offer-header">
            <div class="bundle-badge">BUNDLE</div>
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
                <div class="hint">Required for bundle offers</div>
              </div>
            }

            <div class="bundle-info">
              <h5>Bundle Structure</h5>
              <p class="info-note">
                This bundle contains multiple products.
              </p>

              @if (isEditMode()) {
                <div class="bundle-components">
                  <h6>Bundle Components</h6>
                  @for (component of bundleComponents(); track component.id; let idx = $index) {
                    <div class="bundle-component-row">
                      <input
                        type="text"
                        [ngModel]="component.name"
                        (ngModelChange)="updateBundleComponentName(idx, $event)"
                        [ngModelOptions]="{ standalone: true }"
                        placeholder="Component name"
                      />
                      <input
                        type="number"
                        min="1"
                        [ngModel]="component.quantity"
                        (ngModelChange)="updateBundleComponentQuantity(idx, $event)"
                        [ngModelOptions]="{ standalone: true }"
                        placeholder="Qty"
                      />
                      <button
                        type="button"
                        class="btn-remove-component"
                        (click)="removeBundleComponent(idx)"
                        [disabled]="bundleComponents().length <= 1"
                      >
                        Remove
                      </button>
                    </div>
                  }

                  <button
                    type="button"
                    class="btn-secondary"
                    (click)="addBundleComponent()"
                  >
                    Add Component
                  </button>

                  @if (validation['bundleComponents']) {
                    <span class="field-error">{{ validation['bundleComponents'] }}</span>
                  }
                </div>
              } @else {
                <p class="info-note">Bundle components can be edited after adding this bundle to cart.</p>
              }
            </div>

          </form>

          @if (success()) {
            <div class="success">{{ success() }}</div>
          }
        } @else {
          <p class="error">{{ isEditMode() ? 'Position' : 'Bundle offer' }} not found or failed to load.</p>
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
      position: relative;

      .bundle-badge {
        display: inline-block;
        background: #9b59b6;
        color: white;
        padding: 0.25rem 0.6rem;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
      }

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
          border-color: #9b59b6;
          box-shadow: 0 0 0 3px rgba(155, 89, 182, 0.1);
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

    .bundle-info {
      background: #e8f4f8;
      border-left: 4px solid #9b59b6;
      padding: 1rem;
      margin-bottom: 1.5rem;
      border-radius: 4px;

      h5 {
        margin: 0 0 0.5rem;
        color: #2c3e50;
        font-size: 0.95rem;
      }

      .info-note {
        margin: 0;
        color: #34495e;
        font-size: 0.9rem;
        line-height: 1.5;
      }

      .bundle-components {
        margin-top: 1rem;

        h6 {
          margin: 0 0 0.75rem;
          color: #2c3e50;
          font-size: 0.9rem;
        }

        .bundle-component-row {
          display: grid;
          grid-template-columns: 1fr 100px auto;
          gap: 0.5rem;
          margin-bottom: 0.5rem;

          input {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #ddd;
            border-radius: 4px;
          }

          .btn-remove-component {
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 0.4rem 0.6rem;
            cursor: pointer;

            &:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
          }
        }
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
        background: #9b59b6;
        color: white;

        &:hover:not(:disabled) {
          background: #8e44ad;
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
export class EditSaleBundleOfferComponent implements OnInit, OnDestroy {
  private api = inject(Tmf663ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  offer = signal<SaleOfferSearchResult | null>(null);
  saving = signal(false);
  formError = signal<string | null>(null);
  success = signal<string | null>(null);

  private position = signal<CartItem | null>(null);
  bundleComponents = signal<BundleComponent[]>([]);

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

      const components = this.bundleComponents();
      this.api
        .updateCartItem(cartId, position.id, {
          quantity: this.draft.quantity,
          bundleComponents: components,
        })
        .subscribe({
        next: updated => {
          // Keep resolved cart object in sync so left cart panel refreshes immediately.
          const resolved = this.route.parent?.snapshot.data['cart'] as ShoppingCart | undefined;
          if (resolved) {
            resolved.cartItem = updated.cartItem;
            resolved.cartTotalPrice = updated.cartTotalPrice;
          }

          this.success.set(`Updated bundle ${offer.name} in cart.`);
          this.saving.set(false);
          setTimeout(() => this.cancel(), 700);
        },
        error: err => {
          this.formError.set(err?.message ?? 'Failed to update bundle in cart.');
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

          this.success.set(`Added bundle ${offer.name} to cart.`);
          this.saving.set(false);
          
          // Navigate back to search after successful add
          setTimeout(() => this.cancel(), 1500);
        },
        error: err => {
          this.formError.set(err?.message ?? 'Failed to add bundle to cart.');
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
        out['serialNumber'] = 'Serial number is required for this bundle.';
      } else if (serial.length < 5) {
        out['serialNumber'] = 'Serial number looks too short.';
      }
    }

    if (offer.requiredFields.includes('customerReference')) {
      const ref = this.draft.customerReference?.trim() ?? '';
      if (!ref) {
        out['customerReference'] = 'Customer reference is required for bundle offers.';
      } else if (ref.length < 3) {
        out['customerReference'] = 'Customer reference must contain at least 3 characters.';
      }
    }

    if (this.isEditMode()) {
      const components = this.bundleComponents();
      if (components.length === 0) {
        out['bundleComponents'] = 'At least one bundle component is required.';
      }

      const hasInvalid = components.some(c => !c.name?.trim() || !Number.isFinite(c.quantity) || c.quantity < 1);
      if (hasInvalid) {
        out['bundleComponents'] = 'Each bundle component needs a name and quantity >= 1.';
      }
    }

    return out;
  }

  addBundleComponent(): void {
    const current = this.bundleComponents();
    const nextIndex = current.length + 1;
    this.bundleComponents.set([
      ...current,
      {
        id: `bundle-comp-${Date.now()}-${nextIndex}`,
        name: `Bundle Component ${nextIndex}`,
        quantity: 1,
      },
    ]);
  }

  removeBundleComponent(index: number): void {
    const current = this.bundleComponents();
    if (current.length <= 1) {
      return;
    }
    this.bundleComponents.set(current.filter((_, idx) => idx !== index));
  }

  updateBundleComponentName(index: number, value: string): void {
    this.bundleComponents.set(
      this.bundleComponents().map((component, idx) =>
        idx === index ? { ...component, name: value } : component
      )
    );
  }

  updateBundleComponentQuantity(index: number, value: string | number): void {
    const quantity = Number(value);
    this.bundleComponents.set(
      this.bundleComponents().map((component, idx) =>
        idx === index
          ? { ...component, quantity: Number.isFinite(quantity) ? quantity : component.quantity }
          : component
      )
    );
  }

  private applyResolvedData(resolvedOffer: SaleOfferSearchResult | null, resolvedPosition: CartItem | null): void {
    // Reset transient UI state when route params/data change.
    this.formError.set(null);
    this.success.set(null);
    this.validation = {};

    this.position.set(null);
    this.bundleComponents.set([]);

    if (resolvedOffer && resolvedOffer.kind === 'bundle') {
      this.offer.set(resolvedOffer);
      this.draft.offerId = resolvedOffer.id;
      this.draft.quantity = 1;
      return;
    }

    if (resolvedPosition) {
      this.position.set(resolvedPosition);

      if (resolvedPosition.bundleComponents?.length) {
        this.bundleComponents.set(
          resolvedPosition.bundleComponents.map(component => ({ ...component }))
        );
      } else {
        this.bundleComponents.set([
          { id: 'bundle-comp-1', name: 'Bundle Component 1', quantity: 1 },
        ]);
      }

      if (resolvedPosition.product) {
        this.offer.set({
          id: resolvedPosition.product.id,
          kind: 'bundle',
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

