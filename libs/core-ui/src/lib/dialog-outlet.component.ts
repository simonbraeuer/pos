import { Component, computed, inject } from '@angular/core';
import { DialogService } from './dialog.service';

@Component({
  selector: 'lib-dialog-outlet',
  standalone: true,
  templateUrl: './dialog-outlet.component.html',
  styleUrl: './dialog-outlet.component.scss',
})
export class DialogOutletComponent {
  readonly dialogService = inject(DialogService);
  readonly activeDialog = computed(() => this.dialogService.queue()[0] ?? null);

  confirm(): void {
    const active = this.activeDialog();
    if (!active) return;
    this.dialogService.confirm(active.id);
  }

  cancel(): void {
    const active = this.activeDialog();
    if (!active) return;
    this.dialogService.cancel(active.id);
  }
}
