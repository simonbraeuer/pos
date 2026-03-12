import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ReceiptOptionsService, ReceiptOptions, PrinterInfo } from './receipt-options.service';
import { TabletSelectionStateService } from '@pos/tablet-selection';
import { ProcessContentLayoutComponent } from '@pos/core-ui';

@Component({
  selector: 'pos-receipt-options',
  standalone: true,
  imports: [FormsModule, ProcessContentLayoutComponent],
  templateUrl: './receipt-options.component.html',
  styleUrl: './receipt-options.component.scss',
})
export class ReceiptOptionsComponent implements OnInit {
  private readonly service = inject(ReceiptOptionsService);
  private readonly tabletState = inject(TabletSelectionStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly printers = signal<PrinterInfo[]>([]);

  /** Editable working copy */
  readonly outputType = signal<'printer' | 'pdf'>('pdf');
  readonly selectedPrinterId = signal<string>('');

  readonly currentTablet = this.tabletState.selectedTablet;

  readonly availablePrinters = computed(() => this.printers());

  ngOnInit(): void {
    const current = this.service.options();
    this.outputType.set(current.outputType);
    this.selectedPrinterId.set(current.printerId ?? '');
    this.loadPrinters();
  }

  private loadPrinters(): void {
    this.loading.set(true);
    this.service.getPrintersForCurrentStation().subscribe({
      next: (printers) => {
        this.printers.set(printers);
        this.loading.set(false);

        // If the saved printer is no longer available, clear it
        const savedId = this.selectedPrinterId();
        if (savedId && !printers.some((p) => p.id === savedId)) {
          this.selectedPrinterId.set('');
        }
        // Auto-select first printer if none selected
        if (!this.selectedPrinterId() && printers.length > 0) {
          this.selectedPrinterId.set(printers[0].id);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  save(): void {
    const opts: ReceiptOptions = { outputType: this.outputType() };
    if (opts.outputType === 'printer' && this.selectedPrinterId()) {
      opts.printerId = this.selectedPrinterId();
    }
    this.service.save(opts);
    this.navigateBack();
  }

  cancel(): void {
    this.navigateBack();
  }

  private navigateBack(): void {
    this.router.navigate(['../checkout'], { relativeTo: this.route });
  }
}
