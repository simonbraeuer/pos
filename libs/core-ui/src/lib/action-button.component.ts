import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-action-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="action-button"
      [disabled]="disabled"
      (click)="handleClick()"
    >
      <span class="action-button__icon" aria-hidden="true">{{ icon }}</span>
      <span class="action-button__label" [title]="text">{{ text }}</span>
    </button>
  `,
  styles: [
    `
      :host {
        --action-button-scale: clamp(0.56rem, 7.2cqi, 0.82rem);
        display: block;
        width: 100%;
        aspect-ratio: 1 / 1;
        height: 100%;
        min-width: 0;
        min-height: 0;
        container-type: size;
      }

      .action-button {
        width: 100%;
        height: 100%;
        min-height: 0;
        font-size: var(--action-button-scale);
        border: 1px solid #3f5399;
        border-radius: 10px;
        background: linear-gradient(145deg, #6076d1 0%, #4d61bb 100%);
        color: #fff;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.45em;
        padding: 0.8em;
        transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease;
        box-shadow: 0 4px 12px rgba(45, 58, 112, 0.28);
      }

      .action-button:hover:not(:disabled) {
        background: linear-gradient(145deg, #5268c3 0%, #4153a9 100%);
        transform: translateY(-1px);
      }

      .action-button:active:not(:disabled) {
        transform: translateY(0);
      }

      .action-button:focus-visible {
        outline: 3px solid #c9d3ff;
        outline-offset: 2px;
      }

      .action-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .action-button__icon {
        font-size: 1.8em;
        line-height: 1;
      }

      .action-button__label {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        white-space: normal;
        word-break: normal;
        overflow-wrap: normal;
        hyphens: none;
        text-align: center;
        line-height: 1.15;
        font-size: 1em;
        font-weight: 700;
      }

      @container (max-width: 4.25rem) {
        .action-button {
          gap: 0;
        }

        .action-button__icon {
          display: none;
        }
      }
    `,
  ],
})
export class ActionButtonComponent {
  @Input() icon = '';
  @Input() text = '';
  @Input() disabled = false;
  @Output() onClick = new EventEmitter<void>();

  handleClick(): void {
    if (this.disabled) {
      return;
    }

    this.onClick.emit();
  }
}
