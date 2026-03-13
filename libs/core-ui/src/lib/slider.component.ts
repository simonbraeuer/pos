
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'pos-slider',
  standalone: true,
  template: `
    <label [attr.for]="id" class="pos-slider__label">
      <span>{{ label }}: <b>{{ value }}</b></span>
      <input
        type="range"
        class="pos-slider__input"
        [id]="id"
        [min]="min"
        [max]="max"
        [step]="step"
        [value]="value"
        (input)="valueChange.emit($event.target.valueAsNumber)"
      />
    </label>
  `,
  styleUrls: ['./slider.component.scss']
})
export class SliderComponent {
  @Input() label = '';
  @Input() min = 0;
  @Input() max = 100;
  @Input() step = 1;
  @Input() value = 0;
  @Input() id = '';
  @Output() valueChange = new EventEmitter<number>();
}
