import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CurrentCartStateService } from '@pos/cart-core';
import { Tmf663ApiService } from '@pos/tmf663';

@Component({
  selector: 'pos-current-cart-redirect',
  standalone: true,
  template: '',
})
export class CurrentCartRedirectComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly currentCart = inject(CurrentCartStateService);
  private readonly cartApi = inject(Tmf663ApiService);

  ngOnInit(): void {
    const cartId = this.currentCart.currentCartId();
    if (!cartId) {
      this.router.navigate(['/new-cart'], { replaceUrl: true });
      return;
    }

    this.cartApi.getCart(cartId).subscribe({
      next: () => {
        this.router.navigate(['/cart', cartId, 'find-sale-offer'], { replaceUrl: true });
      },
      error: (err) => {
        if (err?.status === 404) {
          this.currentCart.clearCurrentCart();
        }
        this.router.navigate(['/new-cart'], { replaceUrl: true });
      },
    });
  }
}