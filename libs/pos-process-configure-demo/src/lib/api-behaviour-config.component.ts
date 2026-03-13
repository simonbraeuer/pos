import { Component, Input, Output, EventEmitter } from '@angular/core';
import { SliderComponent } from '@pos/core-ui';
import { NumberPickerComponent } from '@pos/core-ui';
import { FormsModule } from '@angular/forms';

export interface ApiBehaviourConfig {
  latency: number;
  errorRate: number;
  failureStatus: number;
}

@Component({
  selector: 'pos-api-behaviour-config',
  standalone: true,
  imports: [FormsModule, SliderComponent, NumberPickerComponent],
  templateUrl: './api-behaviour-config.component.html',
  styleUrls: ['./api-behaviour-config.component.scss']
})
export class ApiBehaviourConfigComponent {
  @Input() apiBehaviour!: ApiBehaviourConfig;
  @Output() apiBehaviourChange = new EventEmitter<ApiBehaviourConfig>();

  onInputChange() {
    this.apiBehaviourChange.emit(this.apiBehaviour);
  }
}
