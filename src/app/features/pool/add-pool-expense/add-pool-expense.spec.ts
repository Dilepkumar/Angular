import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddPoolExpense } from './add-pool-expense';

describe('AddPoolExpense', () => {
  let component: AddPoolExpense;
  let fixture: ComponentFixture<AddPoolExpense>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddPoolExpense],
    }).compileComponents();

    fixture = TestBed.createComponent(AddPoolExpense);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
