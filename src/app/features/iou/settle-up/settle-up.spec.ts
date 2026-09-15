import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettleUp } from './settle-up';

describe('SettleUp', () => {
  let component: SettleUp;
  let fixture: ComponentFixture<SettleUp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettleUp],
    }).compileComponents();

    fixture = TestBed.createComponent(SettleUp);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
