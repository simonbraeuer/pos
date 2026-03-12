import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { HardwareStationApiService, HardwareStation } from '@pos/hardware-station';
import { TabletSelectionStateService } from '@pos/tablet-selection';

export type ReceiptOutputType = 'printer' | 'pdf';

export interface PrinterInfo {
  id: string;
  name: string;
  hardwareStationId: number;
  hardwareStationName: string;
}

export interface ReceiptOptions {
  outputType: ReceiptOutputType;
  /** Only set when outputType === 'printer' */
  printerId?: string;
}

const STORAGE_KEY = 'pos_receipt_options';

/** Mock printers attached to hardware stations */
const MOCK_PRINTERS: PrinterInfo[] = [
  { id: 'prn-wistn01-1', name: 'Receipt Printer 1', hardwareStationId: 1, hardwareStationName: 'Wien Station 01' },
  { id: 'prn-wistn01-2', name: 'Label Printer 2', hardwareStationId: 1, hardwareStationName: 'Wien Station 01' },
  { id: 'prn-wistn02-1', name: 'Receipt Printer 1', hardwareStationId: 2, hardwareStationName: 'Wien Station 02' },
  { id: 'prn-lzstn01-1', name: 'Receipt Printer 1', hardwareStationId: 3, hardwareStationName: 'Linz Station 01' },
];

@Injectable({ providedIn: 'root' })
export class ReceiptOptionsService {
  private readonly hwStationApi = inject(HardwareStationApiService);
  private readonly tabletState = inject(TabletSelectionStateService);

  private readonly optionsSignal = signal<ReceiptOptions>(this.readFromStorage());

  readonly options = this.optionsSignal.asReadonly();

  save(opts: ReceiptOptions): void {
    this.optionsSignal.set(opts);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
    } catch {
      // localStorage not available
    }
  }

  reset(): void {
    this.save({ outputType: 'pdf' });
  }

  /**
   * Returns printers available on the hardware station associated with the
   * currently selected tablet. Falls back to all printers when no tablet is
   * selected.
   */
  getPrintersForCurrentStation(): Observable<PrinterInfo[]> {
    const tablet = this.tabletState.selectedTablet();
    const hwStationId = tablet?.hwStationId;
    const filtered = hwStationId
      ? MOCK_PRINTERS.filter((p) => p.hardwareStationId === hwStationId)
      : MOCK_PRINTERS;
    return of(filtered).pipe(delay(80 + Math.random() * 120));
  }

  getCurrentHardwareStation(): Observable<HardwareStation | null> {
    const tablet = this.tabletState.selectedTablet();
    if (!tablet?.hwStationId) return of(null);
    return this.hwStationApi.getHardwareStation(tablet.hwStationId);
  }

  private readFromStorage(): ReceiptOptions {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as ReceiptOptions;
      }
    } catch {
      // ignore
    }
    return { outputType: 'pdf' };
  }
}
