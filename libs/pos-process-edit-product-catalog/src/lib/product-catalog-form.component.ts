import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProcessContentLayoutComponent } from '@pos/core-ui';
import { Tmf620ApiService, ProductOffering } from '@pos/tmf620';

@Component({
  selector: 'pos-product-catalog-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ProcessContentLayoutComponent],
  template: `
    <lib-process-content-layout icon="📦" [title]="formTitle" [showAbort]="true" (abort)="cancel()">
      <div slot="content">
        <div class="form-container">
        
          <div *ngIf="formTitle === 'Edit Product' && !originalProduct" class="loading">Loading product data...</div>
          <form *ngIf="formTitle !== 'Edit Product' || originalProduct">
            <div class="form-grid">
              <div class="form-group">
                <label>Name *</label>
                <input type="text" [(ngModel)]="formData.name" name="name" required />
              </div>
              <div class="form-group">
                <label>Product Number *</label>
                <input type="text" [(ngModel)]="formData.productNumber" name="productNumber" required />
              </div>
              <div class="form-group full-width">
                <label>Description</label>
                <textarea [(ngModel)]="formData.description" name="description" rows="3"></textarea>
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
                  <input type="checkbox" [(ngModel)]="formData.requiresSerialNumber" name="requiresSerialNumber" />
                  Requires Serial Number
                </label>
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="formData.requiresCustomerReference" name="requiresCustomerReference" />
                  Requires Customer Reference
                </label>
              </div>
              <div class="form-group full-width">
                <label>Known Serial Numbers (comma-separated)</label>
                <input type="text" [(ngModel)]="formData.knownSerialNumbersStr" name="knownSerialNumbers" placeholder="SER-001, SER-002, ..." />
              </div>
            </div>
            <div class="prices-section">
              <div class="prices-header">
                <h4>Prices</h4>
                <button type="button" class="btn btn--secondary" (click)="addPrice()">➕ Add Price</button>
              </div>
              <ng-container *ngFor="let price of formData.prices; let i = index">
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
                      <input type="number" step="0.01" [(ngModel)]="price.dutyFreeAmount" [name]="'dutyFree' + i" />
                    </div>
                    <div class="form-group">
                      <label>Gross Amount (€)</label>
                      <input type="number" step="0.01" [(ngModel)]="price.taxIncludedAmount" [name]="'taxIncluded' + i" />
                    </div>
                    <div class="form-group">
                      <label>Tax Rate (%)</label>
                      <input type="number" step="0.01" [(ngModel)]="price.taxRate" [name]="'taxRate' + i" />
                    </div>
                    <div class="form-group">
                      <button type="button" class="btn-icon btn--danger" (click)="removePrice(i)" title="Remove price">🗑️</button>
                    </div>
                  </div>
                </div>
              </ng-container>
              <div *ngIf="formData.prices.length === 0" class="empty-prices">No prices defined. Add at least one price.</div>
            </div>
            <div class="characteristics-section">
              <div class="characteristics-header">
                <h4>Custom Characteristics</h4>
                <button type="button" class="btn btn--secondary" (click)="addCharacteristic()">➕ Add Characteristic</button>
              </div>
              <ng-container *ngFor="let char of formData.customCharacteristics; let i = index">
                <div class="characteristic-item">
                  <div class="characteristic-grid">
                    <div class="form-group">
                      <label>Name</label>
                      <input type="text" [(ngModel)]="char.name" [name]="'charName' + i" placeholder="e.g., color, weight" />
                    </div>
                    <div class="form-group">
                      <label>Value</label>
                      <input type="text" [(ngModel)]="char.value" [name]="'charValue' + i" placeholder="e.g., red, 2.5kg" />
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
                      <button type="button" class="btn-icon btn--danger" (click)="removeCharacteristic(i)" title="Remove characteristic">🗑️</button>
                    </div>
                  </div>
                </div>
              </ng-container>
              <div *ngIf="formData.customCharacteristics.length === 0" class="empty-characteristics">No custom characteristics defined. Add characteristics to store additional product metadata.</div>
            </div>
            <!-- form-actions removed, submit button moved to nav-buttons slot -->
          </form>
        </div>
      </div>
      <div slot="nav-buttons">
        <button *ngIf="formTitle === 'Edit Product'" type="button" class="btn btn--secondary" (click)="resetForm()">Reset</button>
        <button type="button" class="btn btn--primary" [disabled]="saving() || !isFormValid()" (click)="saveProduct()">
          {{ saving() ? 'Saving...' : formTitle }}
        </button>
      </div>
    </lib-process-content-layout>
  `,
  styleUrls: ['./edit-product-catalog.component.scss'],
})
export class ProductCatalogFormComponent implements OnInit {
  saving = signal(false);
  formData: any = this.getEmptyFormData();
  originalProduct?: ProductOffering;
  private api = inject(Tmf620ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  formTitle = 'Create Product';
  productId?: string;

  async ngOnInit() {
    const data = this.route?.snapshot?.data ?? {};
    this.formTitle = data['mode'] === 'edit' ? 'Edit Product' : 'Create Product';
    if (data['mode'] === 'edit') {
      const product = data['product'];
      if (product) {
        this.originalProduct = product;
        this.formData = this.productToFormData(product);
      }
    } else {
      this.formData = this.getEmptyFormData();
    }
  }

  resetForm() {
    if (this.originalProduct) {
      this.formData = this.productToFormData(this.originalProduct);
    }
  }

  cancel() {
    this.router.navigate(['/edit-product-catalog']);
  }

  getEmptyFormData() {
    return {
      name: '',
      description: '',
      isBundle: false,
      lifecycleStatus: 'active',
      productNumber: '',
      category: '',
      requiresSerialNumber: false,
      requiresCustomerReference: false,
      knownSerialNumbersStr: '',
      prices: [],
      customCharacteristics: [],
    };
  }

  isFormValid() {
    return (
      !!this.formData.name?.trim() &&
      !!this.formData.productNumber?.trim() &&
      this.formData.prices.length > 0
    );
  }

  saveProduct() {
    if (!this.isFormValid()) {
      // Optionally show error
      return;
    }
    this.saving.set(true);
    const knownSerialNumbers = this.formData.knownSerialNumbersStr
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    const customCharacteristics =
      this.formData.customCharacteristics.length > 0
        ? this.formData.customCharacteristics.filter((c: any) => c.name.trim() && c.value.trim())
        : undefined;
    const mode = this.formTitle === 'Edit Product' ? 'edit' : 'create';
    if (mode === 'create') {
      const request = {
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
          this.cancel();
        },
        error: () => {
          this.saving.set(false);
        },
      });
    } else {
      const request = {
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
      this.api.updateProductOffering(this.formData.id, request).subscribe({
        next: () => {
          this.saving.set(false);
          this.cancel();
        },
        error: () => {
          this.saving.set(false);
        },
      });
    }
  }

  addPrice() {
    this.formData.prices.push({
      name: 'One-time purchase',
      priceType: 'oneTime',
      dutyFreeAmount: 0,
      taxIncludedAmount: 0,
      taxRate: 20,
    });
  }

  removePrice(index: number) {
    this.formData.prices.splice(index, 1);
  }

  addCharacteristic() {
    this.formData.customCharacteristics.push({
      name: '',
      value: '',
      valueType: 'string',
    });
  }

  removeCharacteristic(index: number) {
    this.formData.customCharacteristics.splice(index, 1);
  }

  productToFormData(product: ProductOffering) {
    const getChar = (name: string) =>
      product.productSpecCharacteristic?.find((c: any) => c.name === name)?.value || '';
    const knownSerials = getChar('knownSerialNumbers');
    const reservedNames = [
      'productNumber',
      'category',
      'requiresSerialNumber',
      'requiresCustomerReference',
      'knownSerialNumbers',
    ];
    const customChars = (product.productSpecCharacteristic || [])
      .filter((c: any) => !reservedNames.includes(c.name))
      .map((c: any) => ({
        name: c.name,
        value: c.value,
        valueType: c.valueType,
      }));
    return {
      id: product.id,
      name: product.name,
      description: product.description || '',
      isBundle: product.isBundle || false,
      lifecycleStatus: product.lifecycleStatus || 'active',
      productNumber: getChar('productNumber'),
      category: getChar('category'),
      requiresSerialNumber: getChar('requiresSerialNumber') === 'true',
      requiresCustomerReference: getChar('requiresCustomerReference') === 'true',
      knownSerialNumbersStr: knownSerials,
      prices: (product.productOfferingPrice || []).map((p: any) => ({
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
