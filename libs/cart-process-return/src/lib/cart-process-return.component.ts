import { CommonModule, DecimalPipe } from "@angular/common";
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ProcessContentLayoutComponent } from "@pos/core-ui";
import { ProductOffering, Tmf620ApiService } from "@pos/tmf620";
import { ProductOrder, ProductOrderItem, Tmf622ApiService } from "@pos/tmf622";
import { CartItem, Tmf663ApiService } from "@pos/tmf663";

@Component({
  selector: "pos-cart-process-return",
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, ProcessContentLayoutComponent],
  template: `
    <lib-process-content-layout
      icon="↩️"
      title="Cart Return Wizard"
      [showAbort]="true"
      (abort)="abortReturnWizard()"
    >
      <div slot="filter" class="return-filter">
        @if (step() === 1) {
          <label class="return-filter__label" for="transactionSearch">Find Transaction</label>
          <div class="return-filter__row">
            <input
              id="transactionSearch"
              type="text"
              placeholder="Search by transaction/order ID"
              [(ngModel)]="transactionQuery"
              (keyup.enter)="searchTransactions()"
            />
            <button type="button" class="btn btn--primary" (click)="searchTransactions()" [disabled]="loadingTransactions()">
              @if (loadingTransactions()) { Searching... } @else { Search }
            </button>
          </div>
        } @else {
          <p class="return-filter__summary">
            Selected transaction: <strong>{{ selectedTransaction()?.id }}</strong>
            @if (selectedPosition()) {
              <span> | Position: <strong>{{ selectedPosition()!.id }}</strong></span>
            }
          </p>
        }
      </div>

      <div slot="content" class="return-content">
        @if (step() === 1) {
          <section class="wizard-step">
            <h3>Select Return Item</h3>

            @if (transactionError()) {
              <p class="error">{{ transactionError() }}</p>
            }

            @if (!loadingTransactions() && transactions().length === 0) {
              <p class="empty">No transactions found. Search by transaction ID to continue.</p>
            }

            @if (transactions().length > 0) {
              <div class="transaction-list">
                @for (order of transactions(); track order.id) {
                  <button
                    type="button"
                    class="transaction-row"
                    [class.transaction-row--active]="selectedTransaction()?.id === order.id"
                    (click)="selectTransaction(order)"
                  >
                    <span class="transaction-row__id">{{ order.id }}</span>
                    <span class="transaction-row__meta">{{ order.externalId || 'No external ID' }}</span>
                  </button>
                }
              </div>
            }

            @if (selectedTransaction()) {
              <div class="position-list">
                <h4>Positions in {{ selectedTransaction()!.id }}</h4>
                @for (item of selectedTransaction()!.productOrderItem; track item.id) {
                  @let returnableQty = returnableQtyForItem(selectedTransaction()!.id, item);
                  <button
                    type="button"
                    class="position-row"
                    [class.position-row--active]="selectedPosition()?.id === item.id"
                    [disabled]="returnableQty === 0"
                    (click)="selectPosition(item)"
                  >
                    <div>
                      <div class="position-row__name">{{ item.productOffering?.name || item.product?.name || 'Unnamed position' }}</div>
                      <div class="position-row__meta">
                        Position {{ item.id }}
                        @if (item.quantity > 1 || returnableQty < item.quantity) {
                          · Returnable: {{ returnableQty }}/{{ item.quantity }}
                        } @else if (returnableQty === 0) {
                          · Already returned
                        }
                      </div>
                    </div>
                    <div class="position-row__price">
                      {{ item.itemPrice?.[0]?.price?.taxIncludedAmount?.value || 0 | number : '1.2-2' }}
                      {{ item.itemPrice?.[0]?.price?.taxIncludedAmount?.unit || 'EUR' }}
                    </div>
                  </button>
                }
              </div>
            }
          </section>
        } @else {
          <section class="wizard-step">
            <h3>Return Reason Survey</h3>
            <p class="muted">Choose a reason for the selected return item.</p>

            @if (reasonError()) {
              <p class="error">{{ reasonError() }}</p>
            }

            @if (loadingReasons()) {
              <p class="muted">Loading allowed return reasons...</p>
            } @else if (allowedReasons().length === 0) {
              <p class="empty">No return reasons available for this product.</p>
            } @else {
              <div class="reason-list" role="radiogroup" aria-label="Return reason">
                @for (reason of allowedReasons(); track reason) {
                  <label class="reason-option">
                    <input
                      type="radio"
                      name="return-reason"
                      [value]="reason"
                      [checked]="selectedReason() === reason"
                      (change)="selectReason(reason)"
                    />
                    <span>{{ reason }}</span>
                  </label>
                }
              </div>
            }

            @if (submitError()) {
              <p class="error">{{ submitError() }}</p>
            }
          </section>
        }
      </div>

      <div slot="nav-buttons">
        @if (step() === 1) {
          <button type="button" class="btn btn--secondary" (click)="abortReturnWizard()">Back</button>
          <button type="button" class="btn btn--primary" [disabled]="!selectedPosition()" (click)="goToReasonStep()">
            Next
          </button>
        } @else {
          <button type="button" class="btn btn--secondary" (click)="goToSelectItemStep()">Back</button>
          <button
            type="button"
            class="btn btn--primary"
            [disabled]="!canAddToCart()"
            (click)="addReturnToCart()"
          >
            @if (submitting()) { Adding... } @else { Add to cart }
          </button>
        }
      </div>
    </lib-process-content-layout>
  `,
  styleUrl: "./cart-process-return.component.scss",
})
export class CartProcessReturnComponent implements OnInit {
  private readonly orderApi = inject(Tmf622ApiService);
  private readonly catalogApi = inject(Tmf620ApiService);
  private readonly cartApi = inject(Tmf663ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly step = signal<1 | 2>(1);

  transactionQuery = "";
  readonly loadingTransactions = signal(false);
  readonly transactionError = signal<string | null>(null);
  readonly transactions = signal<ProductOrder[]>([]);
  readonly selectedTransaction = signal<ProductOrder | null>(null);
  readonly selectedPosition = signal<ProductOrderItem | null>(null);

  readonly loadingReasons = signal(false);
  readonly reasonError = signal<string | null>(null);
  readonly allowedReasons = signal<string[]>([]);
  readonly selectedReason = signal<string | null>(null);

  readonly editingReturnCartPositionId = signal<string | null>(null);
  private originalReturnReference: { orderId: string; itemId?: string } | null = null;

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly canAddToCart = computed(() => {
    return !!this.selectedReason() && !this.submitting() && this.allowedReasons().length > 0;
  });

  ngOnInit(): void {
    const routeId = this.route.snapshot.paramMap.get("id");
    if (routeId) {
      this.prefillFromRouteId(routeId);
      return;
    }

    this.searchTransactions();
  }

  searchTransactions(): void {
    this.loadingTransactions.set(true);
    this.transactionError.set(null);

    this.orderApi.searchProductOrders({}, 0, 100).subscribe({
      next: ({ items }) => {
        const q = this.transactionQuery.trim().toLowerCase();
        const filtered = q
          ? items.filter((order) => {
              return [order.id, order.externalId, order.description]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q));
            })
          : items;

        this.transactions.set(filtered);
        this.loadingTransactions.set(false);
      },
      error: (err) => {
        this.transactionError.set(err?.message || "Failed to load transactions.");
        this.loadingTransactions.set(false);
      },
    });
  }

  selectTransaction(order: ProductOrder): void {
    this.selectedTransaction.set(order);
    this.selectedPosition.set(null);
    this.allowedReasons.set([]);
    this.selectedReason.set(null);
    this.reasonError.set(null);
  }

  selectPosition(item: ProductOrderItem): void {
    this.selectedPosition.set(item);
    this.allowedReasons.set([]);
    this.selectedReason.set(null);
    this.reasonError.set(null);
  }

  goToReasonStep(): void {
    if (!this.selectedPosition()) {
      return;
    }

    this.step.set(2);
    this.loadAllowedReasons();
  }

  goToSelectItemStep(): void {
    this.step.set(1);
  }

  selectReason(reason: string): void {
    this.selectedReason.set(reason);
  }

  addReturnToCart(): void {
    const cartId = this.route.parent?.snapshot.paramMap.get("cart-id");
    const transaction = this.selectedTransaction();
    const position = this.selectedPosition();
    const reason = this.selectedReason();

    if (!cartId || !transaction || !position || !reason) {
      this.submitError.set("Missing return context. Please re-open the return wizard.");
      return;
    }

    const offerId = position.productOffering?.id || position.product?.id;
    if (!offerId) {
      this.submitError.set("Selected position has no product offering reference.");
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);

    const serialNumber = position.product?.productSerialNumber;

    // Use the unit price (itemPrice), not the total price (itemTotalPrice).
    const priceEntry = position.itemPrice?.[0] ?? position.itemTotalPrice?.[0];
    const gross = priceEntry?.price?.taxIncludedAmount?.value ?? 0;
    const net = priceEntry?.price?.dutyFreeAmount?.value ?? Number((gross / 1.2).toFixed(2));
    const priceCurrency = priceEntry?.price?.taxIncludedAmount?.unit ?? priceEntry?.price?.dutyFreeAmount?.unit ?? 'EUR';

    const navigateSuccess = (): void => {
      this.submitting.set(false);
      this.router.navigate([".."], { relativeTo: this.route });
    };

    const addReturnPosition = (): void => {
      this.cartApi
        .addOfferToCart(cartId, {
          offerId,
          quantity: 1,
          ...(serialNumber ? { serialNumber } : {}),
          customerReference: `RETURN|ORDER:${transaction.id}|ITEM:${position.id}|REASON:${reason}`,
          returnPrice: { gross, net, currency: priceCurrency, originalQuantity: position.quantity },
        })
        .subscribe({
          next: () => {
            // Persist the incremented returnedQuantity on the source order item so future sessions see it.
            this.orderApi.recordOrderItemReturn(transaction.id, position.id, 1).subscribe({
              next: () => navigateSuccess(),
              error: () => navigateSuccess(), // best-effort; cart position already created
            });
          },
          error: (err) => {
            this.submitting.set(false);
            this.submitError.set(err?.message || "Failed to add return item to cart.");
          },
        });
    };

    if (this.shouldDeleteOriginalReturnBeforeAdd()) {
      const originalReturnPositionId = this.editingReturnCartPositionId();
      if (!originalReturnPositionId) {
        addReturnPosition();
        return;
      }

      this.cartApi.deleteCartItem(cartId, originalReturnPositionId).subscribe({
        next: () => {
          const origRef = this.originalReturnReference;
          if (origRef?.orderId && origRef?.itemId) {
            // Decrement the old reference before adding the new one.
            this.orderApi.recordOrderItemReturn(origRef.orderId, origRef.itemId, -1).subscribe({
              next: () => addReturnPosition(),
              error: () => addReturnPosition(), // best-effort
            });
          } else {
            addReturnPosition();
          }
        },
        error: (err) => {
          this.submitting.set(false);
          this.submitError.set(err?.message || "Failed to replace existing return item.");
        },
      });
      return;
    }

    addReturnPosition();
  }

  abortReturnWizard(): void {
    const urlTree = this.router.parseUrl(this.router.url);
    const segments = urlTree.root.children["primary"]?.segments.map((s) => s.path) || [];
    const returnIndex = segments.lastIndexOf("return");

    if (returnIndex > 0) {
      const basePath = segments.slice(0, returnIndex).join("/");
      this.router.navigateByUrl(`/${basePath}`);
      return;
    }

    this.router.navigate([".."], { relativeTo: this.route });
  }

  private prefillFromRouteId(routeId: string): void {
    const cartId = this.route.parent?.snapshot.paramMap.get("cart-id");
    if (!cartId) {
      this.prefillTransaction(routeId);
      return;
    }

    this.cartApi.getCart(cartId).subscribe({
      next: (cart) => {
        const existingReturnPosition = cart.cartItem.find((item) => {
          return item.id === routeId && this.isReturnPosition(item);
        });

        if (!existingReturnPosition) {
          this.editingReturnCartPositionId.set(null);
          this.originalReturnReference = null;
          // Backward-compatible: treat route param as order id when no cart-position match exists.
          this.prefillTransaction(routeId);
          return;
        }

        this.editingReturnCartPositionId.set(existingReturnPosition.id);

        const parsed = this.parseReturnReference(existingReturnPosition);
        if (!parsed?.orderId) {
          this.transactionError.set("Unable to resolve original transaction for this return position.");
          return;
        }

        this.originalReturnReference = {
          orderId: parsed.orderId,
          itemId: parsed.itemId,
        };

        this.prefillTransaction(parsed.orderId, parsed.itemId, parsed.reason);
      },
      error: () => {
        this.editingReturnCartPositionId.set(null);
        this.originalReturnReference = null;
        this.prefillTransaction(routeId);
      },
    });
  }

  private shouldDeleteOriginalReturnBeforeAdd(): boolean {
    return !!this.editingReturnCartPositionId();
  }

  /**
   * Returns how many more units of the given order item can still be returned.
   * Uses `returnedQuantity` persisted on the order item itself.
   * In edit mode the item currently being edited is excluded from the count so it
   * remains selectable.
   */
  returnableQtyForItem(orderId: string, item: ProductOrderItem): number {
    let persisted = item.returnedQuantity ?? 0;
    // When editing an existing return for this exact item, don't count the one being replaced.
    if (
      this.editingReturnCartPositionId() &&
      this.originalReturnReference?.orderId === orderId &&
      this.originalReturnReference?.itemId === item.id
    ) {
      persisted = Math.max(0, persisted - 1);
    }
    return Math.max(0, item.quantity - persisted);
  }

  private prefillTransaction(orderId: string, itemId?: string, reason?: string): void {    this.loadingTransactions.set(true);
    this.transactionError.set(null);

    this.orderApi.getProductOrder(orderId).subscribe({
      next: (order) => {
        this.transactions.set([order]);
        this.selectedTransaction.set(order);

        if (itemId) {
          const matchedItem = order.productOrderItem.find((item) => item.id === itemId);
          if (matchedItem) {
            this.selectedPosition.set(matchedItem);
            this.step.set(2);
            this.loadAllowedReasons(reason);
          }
        }

        this.loadingTransactions.set(false);
      },
      error: (err) => {
        this.transactionError.set(err?.message || `Unable to load transaction ${orderId}.`);
        this.loadingTransactions.set(false);
      },
    });
  }

  private loadAllowedReasons(preferredReason?: string): void {
    const position = this.selectedPosition();
    if (!position) {
      return;
    }

    const offerId = position.productOffering?.id || position.product?.id;
    if (!offerId) {
      this.reasonError.set("No product offering found for the selected position.");
      const fallbackReasons = this.withPreferredReason(this.defaultReasons(), preferredReason);
      this.allowedReasons.set(fallbackReasons);
      this.selectedReason.set(preferredReason || fallbackReasons[0] || null);
      return;
    }

    this.loadingReasons.set(true);
    this.reasonError.set(null);

    this.catalogApi.getProductOffering(offerId).subscribe({
      next: (offering) => {
        const reasons = this.extractReasons(offering);
        const availableReasons = reasons.length > 0 ? reasons : this.defaultReasons();
        const finalReasons = this.withPreferredReason(availableReasons, preferredReason);
        this.allowedReasons.set(finalReasons);
        this.selectedReason.set(preferredReason || finalReasons[0] || null);
        this.loadingReasons.set(false);
      },
      error: (err) => {
        this.reasonError.set(err?.message || "Failed to load allowed return reasons.");
        const fallbackReasons = this.withPreferredReason(this.defaultReasons(), preferredReason);
        this.allowedReasons.set(fallbackReasons);
        this.selectedReason.set(preferredReason || fallbackReasons[0] || null);
        this.loadingReasons.set(false);
      },
    });
  }

  private isReturnPosition(position: CartItem): boolean {
    const description = (position.product?.description || "").toUpperCase();
    const hasReturnMarker = description.includes("RETURN|ORDER:");
    const gross = position.itemPrice?.[0]?.price?.taxIncludedAmount?.value ?? 0;
    return hasReturnMarker || gross < 0;
  }

  private parseReturnReference(position: CartItem): { orderId: string; itemId?: string; reason?: string } | null {
    const description = position.product?.description || "";
    const match = description.match(/RETURN\|ORDER:([^|]+)\|ITEM:([^|]+)\|REASON:(.+)$/i);
    if (!match) {
      return null;
    }

    const [, orderId, itemId, reason] = match;
    return {
      orderId: orderId.trim(),
      itemId: itemId.trim(),
      reason: reason.trim(),
    };
  }

  private withPreferredReason(reasons: string[], preferredReason?: string): string[] {
    if (!preferredReason) {
      return reasons;
    }

    if (reasons.includes(preferredReason)) {
      return reasons;
    }

    return [preferredReason, ...reasons];
  }

  private extractReasons(offering: ProductOffering): string[] {
    const characteristic = offering.productSpecCharacteristic?.find((c) => {
      const key = c.name.toLowerCase();
      return key === "allowedreturnreasons" || key === "returnreasons";
    });

    if (!characteristic?.value) {
      return [];
    }

    return characteristic.value
      .split(",")
      .map((reason) => reason.trim())
      .filter((reason) => reason.length > 0);
  }

  private defaultReasons(): string[] {
    return [
      "Defective item",
      "Damaged on delivery",
      "Wrong item delivered",
      "Not as described",
      "Customer changed mind",
    ];
  }
}
