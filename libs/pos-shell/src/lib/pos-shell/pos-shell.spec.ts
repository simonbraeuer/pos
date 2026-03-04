import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosShell } from './pos-shell';

describe('PosShell', () => {
  let component: PosShell;
  let fixture: ComponentFixture<PosShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosShell],
    }).compileComponents();

    fixture = TestBed.createComponent(PosShell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
