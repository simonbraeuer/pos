import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosProcessShowUser } from './pos-process-show-user';

describe('PosProcessShowUser', () => {
  let component: PosProcessShowUser;
  let fixture: ComponentFixture<PosProcessShowUser>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosProcessShowUser],
    }).compileComponents();

    fixture = TestBed.createComponent(PosProcessShowUser);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
