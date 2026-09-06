import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pool } from './pool';

describe('Pool', () => {
  let component: Pool;
  let fixture: ComponentFixture<Pool>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pool],
    }).compileComponents();

    fixture = TestBed.createComponent(Pool);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
