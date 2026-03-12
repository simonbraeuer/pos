import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionButtonComponent } from '@pos/core-ui';

@Component({
  selector: 'pos-checkout-action-payment-card-offline',
  standalone: true,
  imports: [ActionButtonComponent],
  template: `
    <lib-action-button
      icon="💳"
      text="Card (offline)"
      [onClick]="navigate"
    />
  `,
  styles: [''],
})
export class CheckoutActionPaymentCardOfflineComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  navigate(): void {
    this.router.navigate(['../payment-card-offline'], { relativeTo: this.route });
  }
}
