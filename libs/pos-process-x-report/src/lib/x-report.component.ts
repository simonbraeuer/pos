import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ProcessContentLayoutComponent } from '@pos/core-ui';
import { Router } from '@angular/router';
import { Tmf678ApiService } from '@pos/tmf678';
import { TabletSelectionStateService } from '@pos/tablet-selection';
import { Shift } from '@pos/shift';
import type { CustomerBill, AppliedPayment, RelatedParty } from '@pos/tmf678';

interface PaymentListItem {
  method: string;
  amount: number;
  direction: 'in' | 'out';
  timestamp: string;
}

@Component({
  selector: 'pos-x-report',
  standalone: true,
  imports: [CommonModule, ProcessContentLayoutComponent, CurrencyPipe],
  templateUrl: './x-report.component.html',
  styleUrls: ['./x-report.component.scss'],
})
export class XReportComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly tmf678 = inject(Tmf678ApiService);
  private readonly tabletSelection = inject(TabletSelectionStateService);

  payments = signal<PaymentListItem[]>([]);
  moneyIn = 0;
  moneyOut = 0;

  ngOnInit(): void {
    // Get current shift context from localStorage
    const shiftContextRaw = localStorage.getItem('pos_shift_context');
    let shiftId: number | undefined = undefined;
    if (shiftContextRaw) {
      try {
        const ctx = JSON.parse(shiftContextRaw);
        shiftId = ctx.shiftId;
      } catch {}
    }
    if (!shiftId) return;

    // Query all customer bills and filter by shiftId (if available on bill)
    this.tmf678.searchCustomerBills({}, 0, 100).subscribe(result => {
      console.log('[XReportComponent] searchCustomerBills result:', result);
      // Assume bills have a relatedParty with role 'shift' and id = shiftId
      const bills = (result.items || []) as CustomerBill[];
      const shiftBills = bills.filter(bill =>
        bill.relatedParty?.some((p: RelatedParty) => p.role === 'shift' && String(p.id) === String(shiftId))
      );
      // Flatten all payments from all bills
      const allPayments: PaymentListItem[] = [];
      for (const bill of shiftBills) {
        const billTimestamp = bill.billDate || bill.lastUpdate || '';
        if (bill.appliedPayment) {
          for (const ap of bill.appliedPayment) {
            // For demo: treat positive as in, negative as out
            const direction = ap.appliedAmount.value >= 0 ? 'in' : 'out';
            allPayments.push({
              method: ap.payment.name || ap.payment.id,
              amount: Math.abs(ap.appliedAmount.value),
              direction,
              timestamp: billTimestamp,
            });
          }
        }
      }
      // Sort payments by timestamp desc
      allPayments.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      this.payments.set(allPayments);
      // Calculate totals
      this.moneyIn = allPayments.filter(p => p.direction === 'in').reduce((sum, p) => sum + p.amount, 0);
      this.moneyOut = allPayments.filter(p => p.direction === 'out').reduce((sum, p) => sum + p.amount, 0);
      console.log('[XReportComponent] payments:', allPayments);
      console.log('[XReportComponent] moneyIn:', this.moneyIn, 'moneyOut:', this.moneyOut);
    });
  }

  done(): void {
    this.router.navigate(['/pos']);
  }
}
