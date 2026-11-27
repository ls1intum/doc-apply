import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { DegreeDocumentSectionComponent } from 'app/shared/components/molecules/degree-document-section/degree-document-section.component';
import { StringInputComponent } from 'app/shared/components/atoms/string-input/string-input.component';
import { provideTranslateMock } from 'util/translate.mock';
import { provideFontAwesomeTesting } from 'util/fontawesome.testing';
import { provideHttpClientMock } from 'util/http-client.mock';
import { provideToastServiceMock } from 'util/toast-service.mock';
import { provideApplicantResourceApiMock } from 'util/applicant-resource-api.service.mock';
import { provideApplicationResourceApiMock } from 'util/application-resource-api.service.mock';

interface DegreeControls {
  degreeName: FormControl<string | null>;
  university: FormControl<string | null>;
  grade: FormControl<string | null>;
}

describe('DegreeDocumentSectionComponent', () => {
  let fixture: ComponentFixture<DegreeDocumentSectionComponent>;
  let bachelor: DegreeControls;
  let master: DegreeControls;

  const createControls = (): DegreeControls => ({
    degreeName: new FormControl('Degree'),
    university: new FormControl('University'),
    grade: new FormControl('1.3'),
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DegreeDocumentSectionComponent],
      providers: [
        provideTranslateMock(),
        provideFontAwesomeTesting(),
        provideHttpClientMock(),
        provideToastServiceMock(),
        provideApplicantResourceApiMock(),
        provideApplicationResourceApiMock(),
      ],
    }).compileComponents();

    bachelor = createControls();
    master = createControls();
    fixture = TestBed.createComponent(DegreeDocumentSectionComponent);
    fixture.componentRef.setInput('applicationId', 'application-1');
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('bachelorDegreeNameControl', bachelor.degreeName);
    fixture.componentRef.setInput('bachelorDegreeUniversityControl', bachelor.university);
    fixture.componentRef.setInput('bachelorGradeControl', bachelor.grade);
    fixture.componentRef.setInput('masterDegreeNameControl', master.degreeName);
    fixture.componentRef.setInput('masterDegreeUniversityControl', master.university);
    fixture.componentRef.setInput('masterGradeControl', master.grade);
    fixture.componentRef.setInput('noBachelorDegreeControl', new FormControl(false));
    fixture.componentRef.setInput('noMasterDegreeControl', new FormControl(false));
    fixture.componentRef.setInput('degreeStatusExplanationControl', new FormControl(''));
    fixture.detectChanges();
  });

  const stringInputsFor = (control: FormControl<string | null>): StringInputComponent | undefined =>
    fixture.debugElement
      .queryAll(By.directive(StringInputComponent))
      .map(element => element.injector.get(StringInputComponent))
      .find(input => input.control() === control);

  it.each([
    { degree: 'bachelor', input: 'noBachelorDegree' },
    { degree: 'master', input: 'noMasterDegree' },
  ] as const)('should disable the $degree fields and drop their required marks when the $degree box is ticked', ({ degree, input }) => {
    fixture.componentRef.setInput(input, true);
    fixture.detectChanges();

    const ticked = degree === 'bachelor' ? bachelor : master;
    const other = degree === 'bachelor' ? master : bachelor;
    for (const control of [ticked.degreeName, ticked.university, ticked.grade]) {
      expect(control.disabled).toBe(true);
      expect(control.value).not.toBe('');
      expect(stringInputsFor(control)?.required()).toBe(false);
    }
    for (const control of [other.degreeName, other.university, other.grade]) {
      expect(control.enabled).toBe(true);
      expect(stringInputsFor(control)?.required()).toBe(true);
    }
    expect(fixture.nativeElement.querySelectorAll('[inert]').length).toBe(1);
  });

  it('should show the explanation only while a box is ticked', () => {
    expect(fixture.nativeElement.querySelector('jhi-text-area')).toBeNull();

    fixture.componentRef.setInput('noMasterDegree', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('jhi-text-area')).not.toBeNull();
  });
});
