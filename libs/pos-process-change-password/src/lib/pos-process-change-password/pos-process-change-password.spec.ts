import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosProcessChangePassword } from './pos-process-change-password';

describe('PosProcessChangePassword', () => {
  let component: PosProcessChangePassword;
  let fixture: ComponentFixture<PosProcessChangePassword>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosProcessChangePassword],
    }).compileComponents();

    fixture = TestBed.createComponent(PosProcessChangePassword);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
