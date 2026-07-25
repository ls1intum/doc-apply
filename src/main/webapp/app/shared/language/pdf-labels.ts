import { TranslateService } from '@ngx-translate/core';

export function getApplicationPDFLabels(translate: TranslateService): Record<string, string> {
  return {
    ...getApplicationHeaderLabel(translate),
    ...getOverviewItemLabel(translate),
    ...getPersonalStatementsLabel(translate),
    ...getPersonalInformationsLabel(translate),
    ...getFooterLabels(translate),

    application: translate.instant('evaluation.application'),
    headline: translate.instant('entity.application_detail.headline'),
    overview: translate.instant('entity.application_detail.position_overview'),

    // Overview item researchgroup is only needed for applications and will therefore not be part of the getOverviewItemLabel function
    researchGroup: translate.instant('jobDetailPage.header.researchGroup'),
  };
}

export function getJobPDFLabels(translate: TranslateService): Record<string, string> {
  return {
    ...getJobHeaderLabel(translate),
    ...getOverviewItemLabel(translate),
    ...getResearchGroupDetailsLabel(translate),
    ...getFooterLabels(translate),

    jobPdfEnding: translate.instant('pdf.jobPdfEnding'),
    overview: translate.instant('jobDetailPage.cards.positionOverview'),
  };
}

// ----------- Helper functions to group related labels together -----------

function getApplicationHeaderLabel(translate: TranslateService): Record<string, string> {
  return {
    applicationBy: translate.instant('pdf.headerItems.applicationBy'),
    forPosition: translate.instant('pdf.headerItems.forPosition'),
    status: translate.instant('pdf.headerItems.status'),
  };
}

function getJobHeaderLabel(translate: TranslateService): Record<string, string> {
  return {
    jobBy: translate.instant('pdf.headerItems.jobBy'),
    forJob: translate.instant('pdf.headerItems.forJob'),
    status: translate.instant('pdf.headerItems.status'),
  };
}

function getOverviewItemLabel(translate: TranslateService): Record<string, string> {
  return {
    supervisor: translate.instant('jobDetailPage.header.supervisor'),
    location: translate.instant('jobDetailPage.header.location'),
    subjectArea: `${translate.instant('jobDetailPage.labels.subjectArea')}:`,
    researchArea: `${translate.instant('jobDetailPage.labels.researchArea')}:`,
    workload: `${translate.instant('jobDetailPage.labels.workload')}:`,
    hoursPerWeek: translate.instant('jobDetailPage.units.hoursPerWeek'),
    duration: `${translate.instant('jobDetailPage.labels.contractDuration')}:`,
    year: translate.instant('jobDetailPage.units.year'),
    years: translate.instant('jobDetailPage.units.years'),
    fundingType: `${translate.instant('jobDetailPage.labels.fundingType')}:`,
    tvlGrade: `${translate.instant('jobDetailPage.labels.tvlGrade')}:`,
    referenceLettersRequired: `${translate.instant('jobDetailPage.labels.referenceLetters')}:`,
    startDate: `${translate.instant('jobDetailPage.labels.startDate')}:`,
    endDate: `${translate.instant('jobDetailPage.labels.applicationEndDate')}:`,
    suitableForDisabled: `${translate.instant('jobCreationForm.basicInformationSection.positionOptions.suitableForDisabled.label')}:`,
    uponAgreement: translate.instant('jobCreationForm.basicInformationSection.positionOptions.uponArrangement.label'),
    yes: translate.instant('pdf.values.yes'),
    no: translate.instant('pdf.values.no'),
    jobDetails: translate.instant('pdf.sections.jobDetails'),
    lang: translate.getCurrentLang(),
  };
}

function getPersonalInformationsLabel(translate: TranslateService): Record<string, string> {
  return {
    personalInformation: translate.instant('entity.application_detail.personal_information'),
    applicantInfo: translate.instant('entity.detail_card.applicant_info'),
    name: translate.instant('entity.detail_card.name'),
    email: translate.instant('entity.applicationPage1.label.email'),
    phoneNumber: translate.instant('entity.applicationPage1.label.phoneNumber'),
    desiredStartDate: translate.instant('entity.detail_card.desired_start_date'),
    gender: translate.instant('entity.detail_card.gender'),
    nationality: translate.instant('entity.detail_card.nationality'),
    address: translate.instant('entity.applicationPage1.label.street'),
    country: translate.instant('entity.applicationPage1.label.country'),
    website: translate.instant('entity.detail_card.website'),
    linkedIn: translate.instant('entity.detail_card.linkedin'),
    bachelorInfo: translate.instant('entity.detail_card.bachelor_info'),
    masterInfo: translate.instant('entity.detail_card.master_info'),
    degreeName: translate.instant('entity.detail_card.name'),
    university: translate.instant('entity.detail_card.university'),
    grade: translate.instant('entity.detail_card.grade'),
  };
}

function getPersonalStatementsLabel(translate: TranslateService): Record<string, string> {
  return {
    personalStatements: translate.instant('entity.application_detail.personal_statements'),
    motivation: translate.instant('entity.applicationDetail.motivation'),
    skills: translate.instant('entity.applicationDetail.skills'),
    researchExperience: translate.instant('entity.applicationDetail.researchExperience'),
    references: translate.instant('entity.application_detail.reference_letters'),
    referenceStatusAdded: translate.instant('entity.application_detail.reference_status.added'),
    referenceStatusRequested: translate.instant('entity.application_detail.reference_status.requested'),
    referenceStatusSubmitted: translate.instant('entity.application_detail.reference_status.submitted'),
    referenceStatusExpired: translate.instant('entity.application_detail.reference_status.expired'),
    referenceStatusDeclined: translate.instant('entity.application_detail.reference_status.declined'),
    referenceStatusCancelled: translate.instant('entity.application_detail.reference_status.cancelled'),
  };
}

function getResearchGroupDetailsLabel(translate: TranslateService): Record<string, string> {
  return {
    researchGroup: translate.instant('jobDetailPage.cards.researchGroup'),
    contactDetails: translate.instant('pdf.sections.contactDetails'),
    address: translate.instant('researchGroup.groupInfo.fields.section3'),
    email: translate.instant('researchGroup.groupInfo.fields.email'),
    website: translate.instant('researchGroup.groupInfo.fields.website'),
  };
}

function getFooterLabels(translate: TranslateService): Record<string, string> {
  return {
    thisDocumentWasGeneratedOn: translate.instant('pdf.metaData.thisDocumentWasGeneratedOn'),
    byUser: translate.instant('pdf.metaData.byUser'),
    usingTumapply: translate.instant('pdf.metaData.usingTumapply'),
    metaEndText: translate.instant('pdf.metaData.metaEndText'),
    page: translate.instant('pdf.pageCount.page'),
    of: translate.instant('pdf.pageCount.of'),
  };
}

// ----------- Other helper functions related to PDF generation -----------

export function formatGradeDisplay(translate: TranslateService, grade?: string, upperLimit?: string, lowerLimit?: string): string {
  if (grade === undefined || grade === '') return '-';
  if (upperLimit === undefined || upperLimit === '' || lowerLimit === undefined || lowerLimit === '') return grade;

  const scale = translate.instant('entity.applicationPage2.helperText.gradingScale', { upperLimit, lowerLimit });
  return `${grade} (${scale})`;
}
