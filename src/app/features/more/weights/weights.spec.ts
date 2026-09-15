import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Weights } from './weights';

describe('Weights', () => {
  let component: Weights;
  let fixture: ComponentFixture<Weights>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Weights],
    }).compileComponents();

    fixture = TestBed.createComponent(Weights);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
