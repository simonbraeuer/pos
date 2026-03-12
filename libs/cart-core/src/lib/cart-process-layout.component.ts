import { Component } from "@angular/core";

@Component({
  selector: "pos-cart-process-layout",
  standalone: true,
  template: `
    <div class="cart-process-layout">
      <div class="cart-process-layout__content">
        <ng-content select="[content]" />
      </div>
      <div class="cart-process-layout__action">
        <ng-content select="[action]" />
      </div>
      <div class="cart-process-layout__navigation">
        <ng-content select="[navigation]" />
      </div>
    </div>
  `,
  styleUrl: "./cart-process-layout.component.scss",
})
export class CartProcessLayoutComponent {}
