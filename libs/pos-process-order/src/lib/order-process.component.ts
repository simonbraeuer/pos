import { Component, input } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProductOrder } from '@pos/tmf622';
import { OrderComponent } from './order.component';

@Component({
  selector: 'pos-order-process',
  standalone: true,
  imports: [RouterOutlet, OrderComponent],
  template: `
    <div class="order-process">
      <div class="order-process__left">
        <pos-order [order]="order()" />
      </div>
      <div class="order-process__right">
        <router-outlet />
      </div>
    </div>
  `,
  styleUrl: './order-process.component.scss',
})
export class OrderProcessComponent {
  /** Order data resolved from route */
  order = input.required<ProductOrder>();
}
