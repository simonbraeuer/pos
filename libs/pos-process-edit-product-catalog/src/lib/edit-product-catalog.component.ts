import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProcessContentLayoutComponent } from '@pos/core-ui';
import { ActionButtonPanelComponent, ActionButtonComponent } from '@pos/core-ui';
import {
  Tmf620ApiService,
  ProductOffering,
  ProductOfferingSearchCriteria,
} from '@pos/tmf620';

type ViewMode = 'list'; // Only 'list' mode is now supported
@Component({
  selector: 'pos-edit-product-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ProcessContentLayoutComponent, ActionButtonPanelComponent, ActionButtonComponent],
  template: `
    <ng-container *ngIf="!hasChildRoute(); else routedContent">
      <lib-process-content-layout icon="📦" title="Product Catalog" [showAbort]="true" (abort)="handleAbort()">
        <div slot="side">
          <lib-action-button-panel>
            <lib-action-button icon="➕" text="Create a new product" (click)="startEdit()">
            </lib-action-button>
          </lib-action-button-panel>
        </div>
        <div slot="filter">
          <div class="filters">
            <input type="text" placeholder="Search by name..." [(ngModel)]="searchCriteria.name" (ngModelChange)="applyFilters()" />
            <input type="text" placeholder="Product number..." [(ngModel)]="searchCriteria.productNumber" (ngModelChange)="applyFilters()" />
            <select [(ngModel)]="searchCriteria.lifecycleStatus" (ngModelChange)="applyFilters()">
              <option [ngValue]="undefined">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="retired">Retired</option>
            </select>
            <select [(ngModel)]="searchCriteria.isBundle" (ngModelChange)="applyFilters()">
              <option [ngValue]="undefined">All Types</option>
              <option [ngValue]="false">Products</option>
              <option [ngValue]="true">Bundles</option>
            </select>
            <button class="btn btn--secondary" (click)="clearFilters()">Clear</button>
          </div>
        </div>
        <div slot="content">
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Product Number</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Price (€)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngIf="products().length === 0">
                  <td colspan="7" class="empty">No products found</td>
                </tr>
                <tr *ngFor="let product of products(); trackBy: trackById">
                  <td>{{ product.id }}</td>
                  <td>{{ product.name }}</td>
                  <td>{{ getProductNumber(product) }}</td>
                  <td>
                    <span class="badge" [class.bundle]="product.isBundle">
                      {{ product.isBundle ? 'Bundle' : 'Product' }}
                    </span>
                  </td>
                  <td>
                    <span class="status" [class]="product.lifecycleStatus || 'active'">
                      {{ product.lifecycleStatus || 'active' }}
                    </span>
                  </td>
                  <td>{{ getCheapestPrice(product) | number : '1.2-2' }}</td>
                  <td class="actions">
                    <button class="btn-icon" (click)="startEdit(product)" title="Edit">✏️</button>
                    <button class="btn-icon btn--danger" (click)="confirmDelete(product)" title="Delete">🗑️</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="pagination">
            <button class="btn btn--secondary" [disabled]="currentPage() === 0" (click)="previousPage()">← Previous</button>
            <span class="page-info">Page {{ currentPage() + 1 }} of {{ totalPages() }} ({{ totalItems() }} total)</span>
            <button class="btn btn--secondary" [disabled]="!hasMore()" (click)="nextPage()">Next →</button>
          </div>
          <div *ngIf="deleteConfirm()">
            <div class="modal-overlay" (click)="cancelDelete()">
              <div class="modal" (click)="$event.stopPropagation()">
                <h3>Confirm Deletion</h3>
                <p>Are you sure you want to delete <strong>{{ deleteConfirm()!.name }}</strong>?</p>
                <p class="warning">This action cannot be undone.</p>
                <div class="modal-actions">
                  <button class="btn btn--secondary" (click)="cancelDelete()">Cancel</button>
                  <button class="btn btn--danger" (click)="executeDelete()" [disabled]="deleting()">{{ deleting() ? 'Deleting...' : 'Delete' }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </lib-process-content-layout>
    </ng-container>
    <ng-template #routedContent>
      <router-outlet></router-outlet>
    </ng-template>
  `,
  styleUrl: './edit-product-catalog.component.scss',
})
export class EditProductCatalogComponent implements OnInit {
  hasChildRoute(): boolean {
    // Checks if there is a child route currently active
    return this.route.firstChild !== null && this.route.firstChild !== undefined;
  }

  handleAbort() {
    this.router.navigate(['/pos']);
  }
  
  private api = inject(Tmf620ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  viewMode = signal<ViewMode>('list');
  products = signal<ProductOffering[]>([]);
  loading = signal(false);
  saving = signal(false);
  deleting = signal(false);
  error = signal<string | null>(null);
  formError = signal<string | null>(null);

  currentPage = signal(0);
  pageSize = 10;
  totalItems = signal(0);
  hasMore = signal(false);

  deleteConfirm = signal<ProductOffering | null>(null);

  searchCriteria: ProductOfferingSearchCriteria = {
    lifecycleStatus: 'active',
  };

  ngOnInit(): void {
    this.loadProducts();
  }

  totalPages(): number {
    return Math.ceil(this.totalItems() / this.pageSize);
  }


  loadProducts(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .searchProductOfferingsPaginated(this.searchCriteria, this.currentPage(), this.pageSize)
      .subscribe({
        next: result => {
          this.products.set(result.items);
          this.totalItems.set(result.total);
          this.hasMore.set(result.hasMore);
          this.loading.set(false);
        },
        error: err => {
          this.error.set(err?.message ?? 'Failed to load products');
          this.loading.set(false);
        },
      });
  }


  applyFilters(): void {
    this.currentPage.set(0);
    this.loadProducts();
  }


  clearFilters(): void {
    this.searchCriteria = { lifecycleStatus: 'active' };
    this.currentPage.set(0);
    this.loadProducts();
  }

  nextPage(): void {
    if (this.hasMore()) {
      this.currentPage.update(p => p + 1);
      this.loadProducts();
    }
  }

  previousPage(): void {
    if (this.currentPage() > 0) {
      this.currentPage.update(p => p - 1);
      this.loadProducts();
    }
  }

  startEdit(product?: ProductOffering): void {
    // Use absolute navigation to avoid route confusion
    if (!product) {
      this.router.navigate(['/edit-product-catalog/create-product']);
    } else {
      this.router.navigate(['/edit-product-catalog/edit-product', product.id]);
    }
  }

  trackById(index: number, item: ProductOffering): string {
    return item.id;
  }

  confirmDelete(product: ProductOffering): void {
    this.deleteConfirm.set(product);
  }

  cancelDelete(): void {
    this.deleteConfirm.set(null);
  }

  executeDelete(): void {
    const product = this.deleteConfirm();
    if (!product) return;
    this.deleting.set(true);
    this.api.deleteProductOffering(product.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteConfirm.set(null);
        this.loadProducts();
      },
      error: err => {
        this.error.set(err?.message ?? 'Failed to delete product');
        this.deleting.set(false);
        this.deleteConfirm.set(null);
      },
    });
  }


  getProductNumber(product: ProductOffering): string {
    return product.productSpecCharacteristic?.find(c => c.name === 'productNumber')?.value || '-';
  }

  getCheapestPrice(product: ProductOffering): number {
    const prices = product.productOfferingPrice || [];
    if (prices.length === 0) return 0;
    return Math.min(...prices.map(p => p.price.taxIncludedAmount?.value || 0));
  }

}
