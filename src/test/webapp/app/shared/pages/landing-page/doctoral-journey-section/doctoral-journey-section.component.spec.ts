import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DoctoralJourneySectionComponent } from 'app/shared/pages/landing-page/doctoral-journey-section/doctoral-journey-section.component';
import { provideTranslateMock } from 'util/translate.mock';
import { ButtonGroupStubComponent } from 'util/button-group.stub';

describe('DoctoralJourneySectionComponent', () => {
  let fixture: ComponentFixture<DoctoralJourneySectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DoctoralJourneySectionComponent, ButtonGroupStubComponent],
      providers: [provideTranslateMock()],
    }).compileComponents();

    fixture = TestBed.createComponent(DoctoralJourneySectionComponent);
    fixture.detectChanges();
  });

  it.each([
    [0, 'https://www.gs.tum.de/en/gs/path-to-a-doctorate/why-do-your-doctorate-at-tum/'],
    [1, 'https://www.gs.tum.de/en/gs/doctorate-at-tum/'],
  ])('should open correct URL for button at index %i', (index, url) => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null);
    fixture.componentInstance.buttons().buttons[index].onClick();
    expect(spy).toHaveBeenCalledWith(url, '_blank');
    spy.mockRestore();
  });
});
