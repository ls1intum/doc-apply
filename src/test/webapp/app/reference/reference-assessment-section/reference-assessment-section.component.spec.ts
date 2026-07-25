import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideTranslateMock } from 'util/translate.mock';
import { ReferenceAssessmentSectionComponent } from 'app/shared/components/molecules/reference-assessment-section/reference-assessment-section.component';
import { ReferenceRequestDTO } from 'app/generated/model/reference-request-dto';

const submitted: ReferenceRequestDTO = {
  referenceRequestId: 'submitted-id',
  title: 'Prof.',
  firstName: 'Ada',
  lastName: 'Lovelace',
  status: 'SUBMITTED',
  relationship: 'RESEARCH_SUPERVISOR',
  acquaintanceDuration: 'THREE_TO_FIVE_YEARS',
  acquaintanceDepth: 'VERY_WELL',
  ratingIntellectualAbility: 'TOP_FIVE_PERCENT',
  ratingResearchPotential: 'TOP_TEN_PERCENT',
  ratingMotivation: 'TOP_ONE_TO_TWO_PERCENT',
  ratingCommunication: 'TOP_TWENTY_FIVE_PERCENT',
  ratingLeadership: 'TOP_FIFTY_PERCENT',
  ratingCollaboration: 'CANNOT_JUDGE',
  overallRecommendation: 'STRONGLY_RECOMMEND',
};

const pending: ReferenceRequestDTO = {
  referenceRequestId: 'pending-id',
  firstName: 'Grace',
  lastName: 'Hopper',
  status: 'REQUESTED',
};

describe('ReferenceAssessmentSectionComponent', () => {
  let fixture: ComponentFixture<ReferenceAssessmentSectionComponent>;

  const render = async (assessments: ReferenceRequestDTO[]): Promise<HTMLElement> => {
    await TestBed.configureTestingModule({
      imports: [ReferenceAssessmentSectionComponent],
      providers: [provideTranslateMock()],
    }).compileComponents();

    fixture = TestBed.createComponent(ReferenceAssessmentSectionComponent);
    fixture.componentRef.setInput('assessments', assessments);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render a card only for references that carry a submitted assessment', async () => {
    const root = await render([submitted, pending]);

    expect(root.textContent).toContain('Prof. Ada Lovelace');
    expect(root.textContent).not.toContain('Grace Hopper');
  });

  it('should show the overall recommendation and relationship summary label keys', async () => {
    const root = await render([submitted]);

    expect(root.textContent).toContain('reference.questions.overall.options.stronglyRecommend');
    expect(root.textContent).toContain('reference.questions.relationship.capacity.options.researchSupervisor');
    expect(root.textContent).toContain('reference.questions.relationship.duration.options.threeToFiveYears');
    expect(root.textContent).toContain('reference.questions.relationship.depth.options.veryWell');
  });

  it('should render every rating row with its value label key', async () => {
    const root = await render([submitted]);

    expect(root.textContent).toContain('reference.questions.rating.rows.intellectualAbility');
    expect(root.textContent).toContain('reference.questions.rating.options.top5');
    expect(root.textContent).toContain('reference.questions.rating.rows.collaboration');
    expect(root.textContent).toContain('reference.questions.rating.options.cannotJudge');
  });

  it('should render nothing when no reference has an assessment', async () => {
    const root = await render([pending]);

    expect(root.querySelector('div.border')).toBeNull();
  });
});
