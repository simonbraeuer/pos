import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { Tmf663ApiService, ShoppingCart, CartSearchCriteria } from "@pos/tmf663";
import { ProcessContentLayoutComponent } from "@pos/core-ui";

@Component({
  selector: "pos-search-cart",
  standalone: true,
  imports: [CommonModule, FormsModule, ProcessContentLayoutComponent],
  template: `
    <lib-process-content-layout
      icon="🔍"
      title="Search Shopping Carts"
    >
      <div slot="filter">
        <div class="search-filters">
          <div class="filter-row">
            <label>
              Cart ID
              <input
                type="text"
                [(ngModel)]="criteria.id"
                placeholder="Enter cart ID..."
                name="cartId"
              />
            </label>

            <label>
              Status
              <select [(ngModel)]="criteria.status" name="status">
                <option [ngValue]="undefined">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>

          <div class="filter-row">
            <label>
              Min Total (€)
              <input
                type="number"
                [(ngModel)]="criteria.minTotal"
                placeholder="Min..."
                name="minTotal"
                min="0"
                step="0.01"
              />
            </label>

            <label>
              Max Total (€)
              <input
                type="number"
                [(ngModel)]="criteria.maxTotal"
                placeholder="Max..."
                name="maxTotal"
                min="0"
                step="0.01"
              />
            </label>
          </div>

          <div class="filter-actions">
            <button
              class="btn btn--primary"
              (click)="search()"
              [disabled]="loading()"
            >
              @if (loading()) { Searching... } @else { 🔍 Search }
            </button>
            <button class="btn btn--secondary" (click)="clearFilters()">
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <div slot="content">
        @if (error()) {
          <div class="error">{{ error() }}</div>
        }

        @if (searched() && !loading()) {
          <div class="results">
            <div class="results-header">
              <h3>Results</h3>
              <span class="results-count">
                {{ results().length }} of {{ totalResults() }} carts
              </span>
            </div>

            @if (results().length === 0) {
              <div class="no-results">
                No carts found matching your criteria.
              </div>
            } @else {
              <table class="results-table">
                <thead>
                  <tr>
                    <th>Cart ID</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th>Total (incl. tax)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (cart of results(); track cart.id) {
                    <tr>
                      <td class="cart-id">{{ cart.id }}</td>
                      <td>
                        <span
                          class="status-badge"
                          [class.status-badge--active]="cart.status === 'active'"
                          [class.status-badge--completed]="cart.status === 'completed'"
                          [class.status-badge--cancelled]="cart.status === 'cancelled'"
                        >
                          {{ cart.status }}
                        </span>
                      </td>
                      <td>{{ cart.cartItem.length }}</td>
                      <td class="total">
                        {{ cart.cartTotalPrice?.[0]?.price?.taxIncludedAmount?.value | number: '1.2-2' }}
                        {{ cart.cartTotalPrice?.[0]?.price?.taxIncludedAmount?.unit }}
                      </td>
                      <td>
                        <button
                          class="btn btn--select"
                          (click)="selectCart(cart)"
                          [disabled]="cart.status !== 'active'"
                          [title]="cart.status !== 'active' ? 'Only active carts can be selected' : 'Select this cart'"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>

              @if (loadingMore()) {
                <div class="loading-more">Loading more results...</div>
              }

              @if (!hasMore() && results().length > 0) {
                <div class="end-of-results">End of results</div>
              }
            }
          </div>
        }
      </div>
    </lib-process-content-layout>
  `,
  styleUrl: "./search-cart.component.scss",
})
export class SearchCartComponent implements OnInit {
  private tmf663Api = inject(Tmf663ApiService);
  private router = inject(Router);

  criteria: CartSearchCriteria = {};
  results = signal<ShoppingCart[]>([]);
  totalResults = signal(0);
  loading = signal(false);
  loadingMore = signal(false);
  error = signal<string | null>(null);
  searched = signal(false);
  hasMore = signal(false);

  private currentPage = 0;
  private readonly pageSize = 10;

  ngOnInit(): void {
    this.search();
  }

  search(): void {
    this.currentPage = 0;
    this.results.set([]);
    this.error.set(null);
    this.loading.set(true);
    this.searched.set(true);

    this.tmf663Api.searchCarts(this.criteria, this.currentPage, this.pageSize)
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          this.results.set(result.items);
          this.totalResults.set(result.total);
          this.hasMore.set(result.hasMore);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.message || 'Failed to search carts');
        },
      });
  }

  loadMore(): void {
    if (!this.hasMore() || this.loadingMore()) return;

    this.loadingMore.set(true);
    this.currentPage++;

    this.tmf663Api.searchCarts(this.criteria, this.currentPage, this.pageSize)
      .subscribe({
        next: (result) => {
          this.loadingMore.set(false);
          this.results.update(current => [...current, ...result.items]);
          this.hasMore.set(result.hasMore);
        },
        error: (err) => {
          this.loadingMore.set(false);
          this.error.set(err.message || 'Failed to load more results');
        },
      });
  }

  clearFilters(): void {
    this.criteria = {};
    this.results.set([]);
    this.searched.set(false);
    this.error.set(null);
  }

  selectCart(cart: ShoppingCart): void {
    // Only allow selection of active carts
    if (cart.status !== 'active') {
      return;
    }
    this.router.navigate(['/cart', cart.id]);
  }
}
