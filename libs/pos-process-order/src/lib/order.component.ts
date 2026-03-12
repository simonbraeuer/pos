import {
  Component,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
  ViewEncapsulation,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderPrice, ProductOrder, ProductOrderItem } from '@pos/tmf622';

type SummaryRow = {
  label: string;
  value: string;
};

type DisplayItem = {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  prices: OrderPrice[];
};

type Totals = {
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
};

@Component({
  selector: 'pos-order',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order.component.html',
  styleUrl: './order.component.scss',
  encapsulation: ViewEncapsulation.Emulated,
})
export class OrderComponent implements OnChanges {
  private static readonly SUMMARY_PANEL_GUTTER_PX = 16;
  private static readonly SUMMARY_PANEL_WIDTH_PX = 380;

  @Input({ required: true }) order!: ProductOrder;

  summaryVisible = signal(false);
  summaryPanelTop = signal(0);
  summaryPanelLeft = signal(0);
  summaryRows: SummaryRow[] = [];
  orderDescription?: string;
  hasSummaryData = false;
  displayItems: DisplayItem[] = [];
  itemCount = 0;
  hasItems = false;
  hasTotals = false;
  subtotalPrice = 'n/a';
  taxAmount = 'n/a';
  totalPrice = 'n/a';
  taxLabel = 'Tax:';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['order']) {
      this.buildViewModel();
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.summaryVisible()) {
      this.summaryVisible.set(false);
    }
  }

  toggleSummary(event: MouseEvent): void {
    event.stopPropagation();

    const trigger = event.currentTarget as HTMLElement | null;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const top = Math.round(rect.bottom + 8);
      const left = Math.round(rect.left);
      const safeLeft = Math.min(
        Math.max(OrderComponent.SUMMARY_PANEL_GUTTER_PX, left),
        Math.max(
          OrderComponent.SUMMARY_PANEL_GUTTER_PX,
          window.innerWidth - OrderComponent.SUMMARY_PANEL_WIDTH_PX
        )
      );
      this.summaryPanelTop.set(top);
      this.summaryPanelLeft.set(safeLeft);
    }

    this.summaryVisible.update((visible) => !visible);
  }

  dismissSummary(): void {
    this.summaryVisible.set(false);
  }

  trackByItem(index: number, item: DisplayItem): string {
    return item.id || `${item.name}-${index}`;
  }

  trackByPrice(index: number, price: OrderPrice): string {
    const amount = price.price.taxIncludedAmount?.value ?? 'na';
    return `${price.name || 'price'}-${amount}-${index}`;
  }

  private buildViewModel(): void {
    if (!this.order) {
      return;
    }

    this.displayItems = this.order.productOrderItem.map((item, index) => ({
      id: item.id || `item-${index}`,
      name: item.productOffering?.name || item.product?.name || 'Unnamed Item',
      description: item.product?.description,
      quantity: item.quantity,
      prices: this.resolveDisplayPrices(item),
    }));

    this.itemCount = this.displayItems.length;
    this.hasItems = this.itemCount > 0;

    this.summaryRows = this.buildSummaryRows();
    this.orderDescription = this.order.description;
    this.hasSummaryData = this.summaryRows.length > 0 || !!this.orderDescription;

    const totals = this.resolveTotals();
    this.hasTotals = totals !== null;

    if (!totals) {
      this.subtotalPrice = 'n/a';
      this.taxAmount = 'n/a';
      this.totalPrice = 'n/a';
      this.taxLabel = 'Tax:';
      return;
    }

    this.subtotalPrice = `${totals.subtotal.toFixed(2)} ${totals.currency}`;
    this.taxAmount = `${totals.tax.toFixed(2)} ${totals.currency}`;
    this.totalPrice = `${totals.total.toFixed(2)} ${totals.currency}`;

    const taxRate = this.getTaxRate();
    this.taxLabel = taxRate === null ? 'Tax:' : `Tax (${taxRate}%):`;
  }

  private buildSummaryRows(): SummaryRow[] {
    const rows: SummaryRow[] = [];

    this.pushSummaryRow(rows, 'External ID', this.order.externalId);
    this.pushSummaryRow(rows, 'State', this.order.state);
    this.pushSummaryRow(rows, 'Priority', this.order.priority);
    this.pushSummaryRow(rows, 'Category', this.order.category);
    this.pushSummaryRow(rows, 'Order Date', this.formatDate(this.order.orderDate));
    this.pushSummaryRow(
      rows,
      'Expected Completion',
      this.formatDate(this.order.expectedCompletionDate)
    );

    const customer = this.order.relatedParty?.find((party) => party.role === 'customer');
    this.pushSummaryRow(rows, 'Customer', customer?.name);
    this.pushSummaryRow(rows, 'Customer ID', customer?.id);
    this.pushSummaryRow(rows, 'Notification Contact', this.order.notificationContact);

    return rows;
  }

  private pushSummaryRow(rows: SummaryRow[], label: string, value?: string): void {
    if (value) {
      rows.push({ label, value });
    }
  }

  private resolveDisplayPrices(item: ProductOrderItem): OrderPrice[] {
    return item.itemPrice?.length ? item.itemPrice : item.itemTotalPrice || [];
  }

  private getTaxRate(): number | null {
    const rate = this.order.orderTotalPrice?.[0]?.price?.taxRate;
    return typeof rate === 'number' ? rate : null;
  }

  formatDate(value?: string): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  private resolveTotals(): Totals | null {
    const orderTotalPrice = this.order.orderTotalPrice?.[0]?.price;
    const currency =
      orderTotalPrice?.taxIncludedAmount?.unit ||
      orderTotalPrice?.dutyFreeAmount?.unit ||
      this.order.productOrderItem[0]?.itemTotalPrice?.[0]?.price?.taxIncludedAmount?.unit ||
      this.order.productOrderItem[0]?.itemPrice?.[0]?.price?.taxIncludedAmount?.unit ||
      'EUR';

    const subtotalFromOrder = orderTotalPrice?.dutyFreeAmount?.value;
    const totalFromOrder = orderTotalPrice?.taxIncludedAmount?.value;

    if (typeof subtotalFromOrder === 'number' || typeof totalFromOrder === 'number') {
      const subtotal = typeof subtotalFromOrder === 'number' ? subtotalFromOrder : (totalFromOrder || 0);
      const total = typeof totalFromOrder === 'number' ? totalFromOrder : subtotal;
      return {
        subtotal,
        total,
        tax: total - subtotal,
        currency,
      };
    }

    let subtotal = 0;
    let total = 0;
    let found = false;

    for (const item of this.order.productOrderItem) {
      const itemTotal = item.itemTotalPrice?.[0]?.price;
      const itemPrice = item.itemPrice?.[0]?.price;

      if (itemTotal?.dutyFreeAmount?.value !== undefined) {
        subtotal += itemTotal.dutyFreeAmount.value;
        found = true;
      }

      if (itemTotal?.taxIncludedAmount?.value !== undefined) {
        total += itemTotal.taxIncludedAmount.value;
        found = true;
      } else if (itemPrice?.taxIncludedAmount?.value !== undefined) {
        total += itemPrice.taxIncludedAmount.value * item.quantity;
        found = true;
      }

      if (itemTotal?.dutyFreeAmount?.value === undefined && itemPrice?.dutyFreeAmount?.value !== undefined) {
        subtotal += itemPrice.dutyFreeAmount.value * item.quantity;
        found = true;
      }
    }

    if (!found) {
      return null;
    }

    if (subtotal === 0) {
      subtotal = total;
    }

    return {
      subtotal,
      total,
      tax: total - subtotal,
      currency,
    };
  }
}
