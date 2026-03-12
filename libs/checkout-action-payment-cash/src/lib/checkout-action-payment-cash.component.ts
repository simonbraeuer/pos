import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionButtonComponent } from '@pos/core-ui';

@Component({
  selector: 'pos-checkout-action-payment-cash',
  standalone: true,
  imports: [ActionButtonComponent],
  template: `
    <lib-action-button
      icon="💵"
      text="Cash Payment"
      (onClick)="navigate()"
    />
  `,
  styles: [''],
})
export class CheckoutActionPaymentCashComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  navigate(): void {
    this.router.navigate(['../payment-cash'], { relativeTo: this.route });
  }
}
