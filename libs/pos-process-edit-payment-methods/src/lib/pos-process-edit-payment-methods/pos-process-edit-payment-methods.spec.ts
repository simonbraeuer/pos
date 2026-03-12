import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosProcessEditPaymentMethods } from './pos-process-edit-payment-methods';

describe('PosProcessEditPaymentMethods', () => {
  let component: PosProcessEditPaymentMethods;
  let fixture: ComponentFixture<PosProcessEditPaymentMethods>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosProcessEditPaymentMethods],
    }).compileComponents();

    fixture = TestBed.createComponent(PosProcessEditPaymentMethods);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
