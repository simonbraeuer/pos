import { Injectable, signal } from '@angular/core';

export type SnackbarLevel = 'info' | 'success' | 'warning' | 'error';

export interface SnackbarMessage {
  id: string;
  text: string;
  level: SnackbarLevel;
  createdAt: number;
  durationMs: number;
}

export interface ShowSnackbarOptions {
  level?: SnackbarLevel;
  durationMs?: number;
}

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  private readonly defaultDurationMs = 10_000;
  private readonly maxDurationMs = 10_000;
  private readonly timers = new Map<string, number>();

  readonly messages = signal<SnackbarMessage[]>([]);

  show(text: string, options: ShowSnackbarOptions = {}): string {
    const id = this.createId();
    const durationMs = Math.min(options.durationMs ?? this.defaultDurationMs, this.maxDurationMs);

    const message: SnackbarMessage = {
      id,
      text,
      level: options.level ?? 'info',
      createdAt: Date.now(),
      durationMs,
    };

    this.messages.update((items) => [...items, message]);

    const timer = window.setTimeout(() => {
      this.dismiss(id);
    }, durationMs);
    this.timers.set(id, timer);

    return id;
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.timers.delete(id);
    }
    this.messages.update((items) => items.filter((item) => item.id !== id));
  }

  clear(): void {
    for (const timer of this.timers.values()) {
      window.clearTimeout(timer);
    }
    this.timers.clear();
    this.messages.set([]);
  }

  private createId(): string {
    return `snack-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
