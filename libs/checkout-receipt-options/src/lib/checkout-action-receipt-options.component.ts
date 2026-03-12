import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionButtonComponent } from '@pos/core-ui';

@Component({
  selector: 'pos-checkout-action-receipt-options',
  standalone: true,
  imports: [ActionButtonComponent],
  template: `
    <lib-action-button
      icon="🧾"
      text="Receipt Options"
      (onClick)="navigate()"
    />
  `,
  styles: [''],
})
export class CheckoutActionReceiptOptionsComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  navigate(): void {
    this.router.navigate(['../receipt-options'], { relativeTo: this.route });
  }
}
