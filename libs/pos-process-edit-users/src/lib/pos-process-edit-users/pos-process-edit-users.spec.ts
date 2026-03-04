import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PosProcessEditUsers } from './pos-process-edit-users';

describe('PosProcessEditUsers', () => {
  let component: PosProcessEditUsers;
  let fixture: ComponentFixture<PosProcessEditUsers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosProcessEditUsers],
    }).compileComponents();

    fixture = TestBed.createComponent(PosProcessEditUsers);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
