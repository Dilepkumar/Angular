import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BillsAdd } from './bills-add';

describe('BillsAdd', () => {
  let component: BillsAdd;
  let fixture: ComponentFixture<BillsAdd>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BillsAdd],
    }).compileComponents();

    fixture = TestBed.createComponent(BillsAdd);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
