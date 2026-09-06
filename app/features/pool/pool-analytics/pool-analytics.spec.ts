import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PoolAnalytics } from './pool-analytics';

describe('PoolAnalytics', () => {
  let component: PoolAnalytics;
  let fixture: ComponentFixture<PoolAnalytics>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoolAnalytics],
    }).compileComponents();

    fixture = TestBed.createComponent(PoolAnalytics);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
