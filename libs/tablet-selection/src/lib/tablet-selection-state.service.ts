import { Injectable, inject, signal } from '@angular/core';
import { Device, DeviceApiService } from '@pos/device';
import { SnackbarService } from '@pos/core-ui';
import { RegisterApiService } from '@pos/register';
import { ShiftApiService } from '@pos/shift';
import { AuthStateService } from '@pos/login';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Shift } from '@pos/shift';

const TABLET_SELECTION_STORAGE_KEY = 'pos_tablet_selection';
const TABLET_SHIFT_CONTEXT_STORAGE_KEY = 'pos_shift_context';

export interface TabletSelectionRecord {
  deviceId: number;
  deviceCode: string;
  deviceName: string;
  hwStationId?: number;
  locationId: number;
  locationName: string;
  selectedAt: string;
}

interface ShiftContextRecord {
  shiftId: number;
  shiftStatus: Shift['status'];
  registerId: number;
  registerCode: string;
  selectedAt: string;
}

@Injectable({ providedIn: 'root' })
export class TabletSelectionStateService {
  private readonly deviceApi = inject(DeviceApiService);
  private readonly registerApi = inject(RegisterApiService);
  private readonly shiftApi = inject(ShiftApiService);
  private readonly snackbar = inject(SnackbarService);
  private readonly auth = inject(AuthStateService);

  private verifiedForSession = false;
  private readonly selectedTabletSignal = signal<TabletSelectionRecord | null>(this.readFromStorage());

  readonly selectedTablet = this.selectedTabletSignal.asReadonly();

  ensureVerifiedOnce(): Observable<boolean> {
    if (this.verifiedForSession) {
      return of(!!this.selectedTabletSignal());
    }

    const stored = this.readFromStorage();
    if (!stored) {
      this.verifiedForSession = true;
      this.selectedTabletSignal.set(null);
      return of(false);
    }

    return this.deviceApi.getDevice(stored.deviceId).pipe(
      map((device) => device.type === 'TABLET'),
      tap((valid) => {
        this.verifiedForSession = true;
        if (!valid) {
          this.clearSelection();
          return;
        }
        this.selectedTabletSignal.set(stored);
      }),
      catchError(() => {
        this.verifiedForSession = true;
        this.clearSelection();
        return of(false);
      })
    );
  }

  selectTablet(record: TabletSelectionRecord): Observable<void> {
    this.saveToStorage(record);
    this.selectedTabletSignal.set(record);
    this.verifiedForSession = true;

    if (!record.hwStationId) {
      localStorage.removeItem(TABLET_SHIFT_CONTEXT_STORAGE_KEY);
      return of(undefined);
    }

    return this.registerApi.listRegisters().pipe(
      map((registers) => registers.find((r) => r.hwStationId === record.hwStationId)),
      switchMap((register) => {
        if (!register) {
          localStorage.removeItem(TABLET_SHIFT_CONTEXT_STORAGE_KEY);
          return of(undefined);
        }

        return this.shiftApi.listShifts().pipe(
          tap((shifts) => {
            const picked = this.pickShiftForRegister(shifts, register.id, this.auth.currentUser()?.id);
            if (picked) {
              const shiftContext: ShiftContextRecord = {
                shiftId: picked.id,
                shiftStatus: picked.status,
                registerId: register.id,
                registerCode: register.code,
                selectedAt: new Date().toISOString(),
              };
              localStorage.setItem(TABLET_SHIFT_CONTEXT_STORAGE_KEY, JSON.stringify(shiftContext));
              this.snackbar.show(
                `Auto-selected shift ${picked.id} for register ${register.code}.`,
                { level: 'info', durationMs: 5000 }
              );
            } else {
              localStorage.removeItem(TABLET_SHIFT_CONTEXT_STORAGE_KEY);
              this.snackbar.show(
                `Tablet linked to register ${register.code}, but no active shift could be selected.`,
                { level: 'warning', durationMs: 5000 }
              );
            }
          }),
          map(() => undefined)
        );
      }),
      catchError(() => {
        this.snackbar.show('Tablet selected, but shift auto-selection failed.', {
          level: 'warning',
          durationMs: 5000,
        });
        return of(undefined);
      })
    );
  }

  clearSelection(): void {
    localStorage.removeItem(TABLET_SELECTION_STORAGE_KEY);
    localStorage.removeItem(TABLET_SHIFT_CONTEXT_STORAGE_KEY);
    this.selectedTabletSignal.set(null);
  }

  private pickShiftForRegister(
    shifts: Shift[],
    registerId: number,
    currentUserId?: string
  ): Shift | undefined {
    const activeForRegister = shifts.filter(
      (s) => s.registerId === registerId && s.status !== 'CLOSED'
    );

    if (currentUserId) {
      const ownOpen = activeForRegister.find(
        (s) => s.userId === currentUserId && s.status === 'OPEN'
      );
      if (ownOpen) return ownOpen;

      const ownNeedClosure = activeForRegister.find(
        (s) => s.userId === currentUserId && s.status === 'NEED_CLOSURE'
      );
      if (ownNeedClosure) return ownNeedClosure;
    }

    const anyOpen = activeForRegister.find((s) => s.status === 'OPEN');
    if (anyOpen) return anyOpen;

    return activeForRegister.find((s) => s.status === 'NEED_CLOSURE');
  }

  private saveToStorage(record: TabletSelectionRecord): void {
    localStorage.setItem(TABLET_SELECTION_STORAGE_KEY, JSON.stringify(record));
  }

  private readFromStorage(): TabletSelectionRecord | null {
    const raw = localStorage.getItem(TABLET_SELECTION_STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as TabletSelectionRecord;
    } catch {
      localStorage.removeItem(TABLET_SELECTION_STORAGE_KEY);
      return null;
    }
  }
}
