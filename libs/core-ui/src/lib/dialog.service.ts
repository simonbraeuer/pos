import { Injectable, signal } from '@angular/core';

export interface DialogRequest {
  id: string;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  dismissible: boolean;
}

export interface ShowDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  dismissible?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly queue = signal<DialogRequest[]>([]);

  show(options: ShowDialogOptions): Promise<boolean> {
    const id = this.createId();
    const dialog: DialogRequest = {
      id,
      title: options.title ?? 'Confirm',
      message: options.message,
      confirmText: options.confirmText ?? 'OK',
      cancelText: options.cancelText ?? 'Cancel',
      dismissible: options.dismissible ?? true,
    };

    return new Promise<boolean>((resolve) => {
      this.resolvers.set(id, resolve);
      this.queue.update((items) => [...items, dialog]);
    });
  }

  confirm(id: string): void {
    this.resolveAndRemove(id, true);
  }

  cancel(id: string): void {
    this.resolveAndRemove(id, false);
  }

  private readonly resolvers = new Map<string, (value: boolean) => void>();

  private resolveAndRemove(id: string, value: boolean): void {
    const resolve = this.resolvers.get(id);
    if (resolve) {
      resolve(value);
      this.resolvers.delete(id);
    }

    this.queue.update((items) => items.filter((item) => item.id !== id));
  }

  private createId(): string {
    return `dlg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
