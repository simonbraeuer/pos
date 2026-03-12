import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CartItem } from '@pos/tmf663';

@Component({
  selector: 'pos-cart-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="cart-item"
      [class.clickable]="canEdit"
      [class.selected]="selected"
      (click)="emitEdit()"
    >
      <div class="item-header">
        <strong>{{ item.product?.name }}</strong>
        <div class="item-actions">
          <span class="quantity">Qty: {{ item.quantity }}</span>
          <button
            class="delete-btn"
            (click)="emitRemove($event)"
            [disabled]="isDeleting"
            title="Remove item"
          >
            @if (isDeleting) {
              ...
            } @else {
              ×
            }
          </button>
        </div>
      </div>

      @if (item.product?.description) {
        <p class="item-description">{{ item.product!.description }}</p>
      }

      @if (item.bundleComponents?.length) {
        <div class="bundle-components-view">
          <div class="bundle-components-title">Bundle Components</div>
          @for (component of item.bundleComponents; track component.id) {
            <div class="bundle-component-line">
              <span>{{ component.name }}</span>
              <span>Qty: {{ component.quantity }}</span>
            </div>
          }
        </div>
      }

      @for (price of item.itemPrice; track $index) {
        <div class="item-price">
          <span>{{ price.name }}</span>
          <span class="price-amount">
            {{ price.price.taxIncludedAmount?.value | number: '1.2-2' }}
            {{ price.price.taxIncludedAmount?.unit }}
          </span>
        </div>
      }
    </div>
  `,
  styleUrl: './cart-item.component.scss',
})
export class CartItemComponent {
  @Input({ required: true }) item!: CartItem;
  @Input() canEdit = false;
  @Input() isDeleting = false;
  @Input() selected = false;

  @Output() onEdit = new EventEmitter<void>();
  @Output() onRemove = new EventEmitter<void>();

  emitEdit(event?: MouseEvent): void {
    event?.stopPropagation();
    if (!this.canEdit) {
      return;
    }
    this.onEdit.emit();
  }

  emitRemove(event: MouseEvent): void {
    event.stopPropagation();
    this.onRemove.emit();
  }
}
