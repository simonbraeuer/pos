import { Component, input } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { ShoppingCart } from "@pos/tmf663";
import { CartComponent } from "./cart.component";

@Component({
  selector: "pos-cart-process",
  standalone: true,
  imports: [RouterOutlet, CartComponent],
  template: `
    <div class="cart-process">
      <div class="cart-process__left">
        <pos-cart [cart]="cart()" />
      </div>
      <div class="cart-process__right">
        <router-outlet />
      </div>
    </div>
  `,
  styleUrl: "./cart-process.component.scss",
})
export class CartProcessComponent {
  /** Cart data resolved from route */
  cart = input.required<ShoppingCart>();
}
