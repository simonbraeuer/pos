import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Tmf622ApiService,
  ProductOrder,
  ProductOrderSearchCriteria,
  PaginatedOrderResults,
  ProductOrderState,
} from '@pos/tmf622';

@Component({
  selector: 'pos-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
})
export class OrdersComponent implements OnInit {
  private api = inject(Tmf622ApiService);
  private router = inject(Router);

  // Search criteria
  criteria: ProductOrderSearchCriteria = {};

  // State signals
  loading = signal(false);
  error = signal<string | null>(null);
  searched = signal(false);
  results = signal<ProductOrder[]>([]);
  totalResults = signal(0);

  // Available states for filtering
  availableStates: ProductOrderState[] = [
    'acknowledged',
    'pending',
    'inProgress',
    'completed',
    'cancelled',
    'failed',
  ];

  ngOnInit(): void {
    // Load initial results
    this.search();
  }

  search(): void {
    this.loading.set(true);
    this.error.set(null);
    this.searched.set(true);

    this.api.searchProductOrders(this.criteria, 0, 100).subscribe({
      next: (response: PaginatedOrderResults) => {
        this.results.set(response.items);
        this.totalResults.set(response.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to search product orders');
        this.loading.set(false);
        this.results.set([]);
        this.totalResults.set(0);
      },
    });
  }

  clearFilters(): void {
    this.criteria = {};
    this.search();
  }

  getTotalPrice(order: ProductOrder): string {
    const total = order.orderTotalPrice?.[0];
    if (!total?.price?.taxIncludedAmount) {
      return 'N/A';
    }
    const amount = total.price.taxIncludedAmount.value.toFixed(2);
    const currency = total.price.taxIncludedAmount.unit;
    return `${amount} ${currency}`;
  }

  getCustomerName(order: ProductOrder): string {
    const customer = order.relatedParty?.find((p) => p.role === 'customer');
    return customer?.name || '—';
  }

  formatDate(dateString?: string): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getItemCount(order: ProductOrder): number {
    return order.productOrderItem.reduce((sum, item) => sum + item.quantity, 0);
  }

  openOrder(orderId: string): void {
    this.router.navigate(['/orders', orderId]);
  }
}
