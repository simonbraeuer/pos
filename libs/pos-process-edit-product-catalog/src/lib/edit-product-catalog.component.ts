import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Tmf620ApiService,
  ProductOffering,
  ProductOfferingSearchCriteria,
  CreateProductOfferingRequest,
  UpdateProductOfferingRequest,
} from '@pos/tmf620';

type ViewMode = 'list' | 'create' | 'edit';

interface PriceFormItem {
  name: string;
  priceType: 'recurring' | 'oneTime' | 'usage';
  dutyFreeAmount: number;
  taxIncludedAmount: number;
  taxRate: number;
}

interface CharacteristicFormItem {
  name: string;
  value: string;
  valueType?: string;
}

@Component({
  selector: 'pos-edit-product-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  template: `
    <div class="container">
      <div class="header">
        <h2>📦 Product Catalog Management</h2>
        <p class="subtitle">Admin-only CRUD operations for TMF620 Product Offerings</p>
      </div>

      @if (viewMode() === 'list') {
        <div class="toolbar">
          <button class="btn btn--primary" (click)="startCreate()">
            ➕ Create New Product
          </button>
        </div>

        <div class="filters">
          <div class="filter-row">
            <input
              type="text"
              placeholder="Search by name..."
              [(ngModel)]="searchCriteria.name"
              (ngModelChange)="applyFilters()"
            />
            <input
              type="text"
              placeholder="Product number..."
              [(ngModel)]="searchCriteria.productNumber"
              (ngModelChange)="applyFilters()"
            />
            <select
              [(ngModel)]="searchCriteria.lifecycleStatus"
              (ngModelChange)="applyFilters()"
            >
              <option [ngValue]="undefined">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="retired">Retired</option>
            </select>
            <select
              [(ngModel)]="searchCriteria.isBundle"
              (ngModelChange)="applyFilters()"
            >
              <option [ngValue]="undefined">All Types</option>
              <option [ngValue]="false">Products</option>
              <option [ngValue]="true">Bundles</option>
            </select>
            <button class="btn btn--secondary" (click)="clearFilters()">Clear</button>
          </div>
        </div>

        @if (error()) {
          <div class="error">{{ error() }}</div>
        }

        @if (loading()) {
          <div class="loading">Loading products...</div>
        } @else {
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
                @if (products().length === 0) {
                  <tr>
                    <td colspan="7" class="empty">No products found</td>
                  </tr>
                } @else {
                  @for (product of products(); track product.id) {
                    <tr>
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
                        <button class="btn-icon" (click)="startEdit(product)" title="Edit">
                          ✏️
                        </button>
                        <button
                          class="btn-icon danger"
                          (click)="confirmDelete(product)"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>

          <div class="pagination">
            <button
              class="btn btn--secondary"
              [disabled]="currentPage() === 0"
              (click)="previousPage()"
            >
              ← Previous
            </button>
            <span class="page-info">
              Page {{ currentPage() + 1 }} of {{ totalPages() }} ({{ totalItems() }} total)
            </span>
            <button
              class="btn btn--secondary"
              [disabled]="!hasMore()"
              (click)="nextPage()"
            >
              Next →
            </button>
          </div>
        }
      }

      @if (viewMode() === 'create' || viewMode() === 'edit') {
        <div class="form-container">
          <div class="form-header">
            <h3>{{ viewMode() === 'create' ? 'Create New Product' : 'Edit Product' }}</h3>
            <button class="btn btn--secondary" (click)="cancelEdit()">✕ Cancel</button>
          </div>

          @if (formError()) {
            <div class="error">{{ formError() }}</div>
          }

          <form (ngSubmit)="saveProduct()">
            <div class="form-grid">
              <div class="form-group">
                <label>Name *</label>
                <input type="text" [(ngModel)]="formData.name" name="name" required />
              </div>

              <div class="form-group">
                <label>Product Number *</label>
                <input
                  type="text"
                  [(ngModel)]="formData.productNumber"
                  name="productNumber"
                  required
                />
              </div>

              <div class="form-group full-width">
                <label>Description</label>
                <textarea
                  [(ngModel)]="formData.description"
                  name="description"
                  rows="3"
                ></textarea>
              </div>

              <div class="form-group">
                <label>Type</label>
                <select [(ngModel)]="formData.isBundle" name="isBundle">
                  <option [ngValue]="false">Product</option>
                  <option [ngValue]="true">Bundle</option>
                </select>
              </div>

              <div class="form-group">
                <label>Lifecycle Status</label>
                <select [(ngModel)]="formData.lifecycleStatus" name="lifecycleStatus">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="retired">Retired</option>
                </select>
              </div>

              <div class="form-group">
                <label>Category</label>
                <input type="text" [(ngModel)]="formData.category" name="category" />
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    [(ngModel)]="formData.requiresSerialNumber"
                    name="requiresSerialNumber"
                  />
                  Requires Serial Number
                </label>
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    [(ngModel)]="formData.requiresCustomerReference"
                    name="requiresCustomerReference"
                  />
                  Requires Customer Reference
                </label>
              </div>

              <div class="form-group full-width">
                <label>Known Serial Numbers (comma-separated)</label>
                <input
                  type="text"
                  [(ngModel)]="formData.knownSerialNumbersStr"
                  name="knownSerialNumbers"
                  placeholder="SER-001, SER-002, ..."
                />
              </div>
            </div>

            <div class="prices-section">
              <div class="prices-header">
                <h4>Prices</h4>
                <button type="button" class="btn btn--secondary" (click)="addPrice()">
                  ➕ Add Price
                </button>
              </div>

              @for (price of formData.prices; track $index; let i = $index) {
                <div class="price-item">
                  <div class="price-grid">
                    <div class="form-group">
                      <label>Name</label>
                      <input type="text" [(ngModel)]="price.name" [name]="'priceName' + i" />
                    </div>

                    <div class="form-group">
                      <label>Type</label>
                      <select [(ngModel)]="price.priceType" [name]="'priceType' + i">
                        <option value="oneTime">One Time</option>
                        <option value="recurring">Recurring</option>
                        <option value="usage">Usage</option>
                      </select>
                    </div>

                    <div class="form-group">
                      <label>Net Amount (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        [(ngModel)]="price.dutyFreeAmount"
                        [name]="'dutyFree' + i"
                      />
                    </div>

                    <div class="form-group">
                      <label>Gross Amount (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        [(ngModel)]="price.taxIncludedAmount"
                        [name]="'taxIncluded' + i"
                      />
                    </div>

                    <div class="form-group">
                      <label>Tax Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        [(ngModel)]="price.taxRate"
                        [name]="'taxRate' + i"
                      />
                    </div>

                    <div class="form-group">
                      <button
                        type="button"
                        class="btn-icon danger"
                        (click)="removePrice(i)"
                        title="Remove price"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              }

              @if (formData.prices.length === 0) {
                <div class="empty-prices">No prices defined. Add at least one price.</div>
              }
            </div>

            <div class="characteristics-section">
              <div class="characteristics-header">
                <h4>Custom Characteristics</h4>
                <button type="button" class="btn btn--secondary" (click)="addCharacteristic()">
                  ➕ Add Characteristic
                </button>
              </div>

              @for (char of formData.customCharacteristics; track $index; let i = $index) {
                <div class="characteristic-item">
                  <div class="characteristic-grid">
                    <div class="form-group">
                      <label>Name</label>
                      <input
                        type="text"
                        [(ngModel)]="char.name"
                        [name]="'charName' + i"
                        placeholder="e.g., color, weight"
                      />
                    </div>

                    <div class="form-group">
                      <label>Value</label>
                      <input
                        type="text"
                        [(ngModel)]="char.value"
                        [name]="'charValue' + i"
                        placeholder="e.g., red, 2.5kg"
                      />
                    </div>

                    <div class="form-group">
                      <label>Type</label>
                      <select [(ngModel)]="char.valueType" [name]="'charType' + i">
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>

                    <div class="form-group">
                      <button
                        type="button"
                        class="btn-icon danger"
                        (click)="removeCharacteristic(i)"
                        title="Remove characteristic"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              }

              @if (formData.customCharacteristics.length === 0) {
                <div class="empty-characteristics">
                  No custom characteristics defined. Add characteristics to store additional product metadata.
                </div>
              }
            </div>

            <div class="form-actions">
              <button type="button" class="btn btn--secondary" (click)="cancelEdit()">
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn--primary"
                [disabled]="saving() || !isFormValid()"
              >
                {{ saving() ? 'Saving...' : viewMode() === 'create' ? 'Create' : 'Update' }}
              </button>
            </div>
          </form>
        </div>
      }

      @if (deleteConfirm()) {
        <div class="modal-overlay" (click)="cancelDelete()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h3>Confirm Deletion</h3>
            <p>
              Are you sure you want to delete
              <strong>{{ deleteConfirm()!.name }}</strong>?
            </p>
            <p class="warning">This action cannot be undone.</p>
            <div class="modal-actions">
              <button class="btn btn--secondary" (click)="cancelDelete()">Cancel</button>
              <button class="btn-danger" (click)="executeDelete()" [disabled]="deleting()">
                {{ deleting() ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './edit-product-catalog.component.scss',
})
export class EditProductCatalogComponent implements OnInit {
  private api = inject(Tmf620ApiService);

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

  formData: {
    id?: string;
    name: string;
    description: string;
    isBundle: boolean;
    lifecycleStatus: 'active' | 'inactive' | 'retired';
    productNumber: string;
    category: string;
    requiresSerialNumber: boolean;
    requiresCustomerReference: boolean;
    knownSerialNumbersStr: string;
    prices: PriceFormItem[];
    customCharacteristics: CharacteristicFormItem[];
  } = this.getEmptyFormData();

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

  startCreate(): void {
    this.formData = this.getEmptyFormData();
    this.formError.set(null);
    this.viewMode.set('create');
  }

  startEdit(product: ProductOffering): void {
    this.formData = this.productToFormData(product);
    this.formError.set(null);
    this.viewMode.set('edit');
  }

  cancelEdit(): void {
    this.viewMode.set('list');
    this.formData = this.getEmptyFormData();
    this.formError.set(null);
  }

  addPrice(): void {
    this.formData.prices.push({
      name: 'One-time purchase',
      priceType: 'oneTime',
      dutyFreeAmount: 0,
      taxIncludedAmount: 0,
      taxRate: 20,
    });
  }

  removePrice(index: number): void {
    this.formData.prices.splice(index, 1);
  }

  addCharacteristic(): void {
    this.formData.customCharacteristics.push({
      name: '',
      value: '',
      valueType: 'string',
    });
  }

  removeCharacteristic(index: number): void {
    this.formData.customCharacteristics.splice(index, 1);
  }

  isFormValid(): boolean {
    return (
      !!this.formData.name.trim() &&
      !!this.formData.productNumber.trim() &&
      this.formData.prices.length > 0
    );
  }

  saveProduct(): void {
    if (!this.isFormValid()) {
      this.formError.set('Please fill in all required fields and add at least one price');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const knownSerialNumbers = this.formData.knownSerialNumbersStr
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    const customCharacteristics =
      this.formData.customCharacteristics.length > 0
        ? this.formData.customCharacteristics.filter(c => c.name.trim() && c.value.trim())
        : undefined;

    if (this.viewMode() === 'create') {
      const request: CreateProductOfferingRequest = {
        name: this.formData.name,
        description: this.formData.description || undefined,
        isBundle: this.formData.isBundle,
        lifecycleStatus: this.formData.lifecycleStatus,
        productNumber: this.formData.productNumber,
        category: this.formData.category || undefined,
        requiresSerialNumber: this.formData.requiresSerialNumber,
        requiresCustomerReference: this.formData.requiresCustomerReference,
        knownSerialNumbers: knownSerialNumbers.length > 0 ? knownSerialNumbers : undefined,
        prices: this.formData.prices,
        customCharacteristics,
      };

      this.api.createProductOffering(request).subscribe({
        next: () => {
          this.saving.set(false);
          this.viewMode.set('list');
          this.loadProducts();
        },
        error: err => {
          this.formError.set(err?.message ?? 'Failed to create product');
          this.saving.set(false);
        },
      });
    } else {
      const request: UpdateProductOfferingRequest = {
        name: this.formData.name,
        description: this.formData.description || undefined,
        isBundle: this.formData.isBundle,
        lifecycleStatus: this.formData.lifecycleStatus,
        productNumber: this.formData.productNumber,
        category: this.formData.category || undefined,
        requiresSerialNumber: this.formData.requiresSerialNumber,
        requiresCustomerReference: this.formData.requiresCustomerReference,
        knownSerialNumbers: knownSerialNumbers.length > 0 ? knownSerialNumbers : undefined,
        prices: this.formData.prices,
        customCharacteristics,
      };

      this.api.updateProductOffering(this.formData.id!, request).subscribe({
        next: () => {
          this.saving.set(false);
          this.viewMode.set('list');
          this.loadProducts();
        },
        error: err => {
          this.formError.set(err?.message ?? 'Failed to update product');
          this.saving.set(false);
        },
      });
    }
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

  private getEmptyFormData() {
    return {
      name: '',
      description: '',
      isBundle: false,
      lifecycleStatus: 'active' as const,
      productNumber: '',
      category: '',
      requiresSerialNumber: false,
      requiresCustomerReference: false,
      knownSerialNumbersStr: '',
      prices: [] as PriceFormItem[],
      customCharacteristics: [] as CharacteristicFormItem[],
    };
  }

  private productToFormData(product: ProductOffering) {
    const getChar = (name: string) =>
      product.productSpecCharacteristic?.find(c => c.name === name)?.value || '';

    const knownSerials = getChar('knownSerialNumbers');

    // Extract custom characteristics (non-reserved ones)
    const reservedNames = [
      'productNumber',
      'category',
      'requiresSerialNumber',
      'requiresCustomerReference',
      'knownSerialNumbers',
    ];

    const customChars = (product.productSpecCharacteristic || [])
      .filter(c => !reservedNames.includes(c.name))
      .map(c => ({
        name: c.name,
        value: c.value,
        valueType: c.valueType,
      }));

    return {
      id: product.id,
      name: product.name,
      description: product.description || '',
      isBundle: product.isBundle || false,
      lifecycleStatus: (product.lifecycleStatus || 'active') as 'active' | 'inactive' | 'retired',
      productNumber: getChar('productNumber'),
      category: getChar('category'),
      requiresSerialNumber: getChar('requiresSerialNumber') === 'true',
      requiresCustomerReference: getChar('requiresCustomerReference') === 'true',
      knownSerialNumbersStr: knownSerials,
      prices: (product.productOfferingPrice || []).map(p => ({
        name: p.name,
        priceType: p.priceType,
        dutyFreeAmount: p.price.dutyFreeAmount?.value || 0,
        taxIncludedAmount: p.price.taxIncludedAmount?.value || 0,
        taxRate: p.price.taxRate || 20,
      })),
      customCharacteristics: customChars,
    };
  }
}
