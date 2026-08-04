import { Routes } from '@angular/router';
import { UserRouteAccessService } from 'app/core/auth/user-route-access.service';
import { InterviewProcessDetailComponent } from 'app/interview/interview-process-detail/interview-process-detail.component';
import { UserShortDTORolesEnum } from 'app/generated/model/user-short-dto';

import { errorRoute } from './layouts/error/error.route';

const routes: Routes = [
  // ======================================================================================
  // Home
  // ======================================================================================
  {
    path: '',
    canActivate: [UserRouteAccessService],
    data: { authorities: [] },
    loadComponent: () => import('./shared/pages/landing-page/landing-page.component').then(m => m.LandingPageComponent),
    title: 'global.routes.landingPage.applicant',
  },
  {
    path: 'professor',
    canActivate: [UserRouteAccessService],
    data: { authorities: [] },
    loadComponent: () =>
      import('./shared/pages/professor-landing-page/professor-landing-page.component').then(m => m.ProfessorLandingPageComponent),
    title: 'global.routes.landingPage.professor',
  },

  // ======================================================================================
  // Job
  // ======================================================================================
  {
    path: 'job/detail/:job_id',
    canActivate: [UserRouteAccessService],
    data: { authorities: [] },
    loadComponent: () => import('./job/job-detail/job-detail.component').then(m => m.JobDetailComponent),
    title: 'global.routes.job.detail',
  },
  {
    path: 'job/create',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin, UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee] },
    loadComponent: () => import('./job/job-creation-form/job-creation-form.component').then(m => m.JobCreationFormComponent),
    title: 'global.routes.job.creation',
  },
  {
    path: 'job/edit/:job_id',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin, UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee] },
    loadComponent: () => import('./job/job-creation-form/job-creation-form.component').then(m => m.JobCreationFormComponent),
    title: 'global.routes.job.edit',
  },
  {
    path: 'job-overview',
    canActivate: [UserRouteAccessService],
    data: { authorities: [] },
    loadComponent: () => import('./job/job-overview/job-overview-page/job-overview-page.component').then(m => m.JobOverviewPageComponent),
    title: 'global.routes.job.overview',
  },
  {
    path: 'my-positions',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin, UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee] },
    loadComponent: () => import('./job/my-positions/my-positions-page.component').then(m => m.MyPositionsPageComponent),
    title: 'global.routes.job.myPositions',
  },
  {
    path: 'all-positions',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin] },
    loadComponent: () => import('./job/all-positions/all-positions-page.component').then(m => m.AllPositionsPageComponent),
    title: 'global.routes.job.allPositions',
  },

  // ======================================================================================
  // Application
  // ======================================================================================
  // New unified application form route
  {
    path: 'application/form',
    canActivate: [UserRouteAccessService],
    data: { authorities: [] },
    loadComponent: () => import('./application/application-creation/application-creation-form/application-creation-form.component'),
    title: 'global.routes.application.creation',
  },

  // TODO temporary - Keep the old routes for backward compatibility
  {
    path: 'application/create/:job_id',
    redirectTo(route) {
      const jobId = route.params.job_id;
      return `/application/form?job=${jobId}`;
    },
    title: 'global.routes.application.creation',
  },
  {
    path: 'application/edit/:application_id',
    redirectTo(route) {
      const applicationId = route.params.application_id;
      return `/application/form?application=${applicationId}`;
    },
  },
  {
    path: 'application/overview',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin, UserShortDTORolesEnum.Applicant] },
    loadComponent: () => import('./application/application-overview-for-applicant/application-overview-for-applicant.component'),
    title: 'global.routes.application.overview',
  },
  {
    path: 'application/detail/:application_id',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin, UserShortDTORolesEnum.Applicant] },
    loadComponent: () => import('./application/application-detail-for-applicant/application-detail-for-applicant.component'),
    title: 'global.routes.application.detail',
  },
  {
    path: 'applications',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin] },
    loadComponent: () => import('./application/all-applications/all-applications-page.component').then(m => m.AllApplicationsPageComponent),
    title: 'global.routes.application.allApplications',
  },

  // ======================================================================================
  // Evaluation
  // ======================================================================================
  {
    path: 'evaluation/overview',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin, UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee] },
    loadComponent: () =>
      import('./evaluation/application-overview/application-overview.component').then(m => m.ApplicationOverviewComponent),
    title: 'global.routes.evaluation.overview',
  },
  {
    path: 'evaluation/application',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin, UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee] },
    loadComponent: () => import('./evaluation/application-detail/application-detail.component').then(m => m.ApplicationDetailComponent),
    title: 'global.routes.evaluation.detail',
  },

  // ======================================================================================
  // Footer
  // ======================================================================================
  {
    path: 'imprint',
    canActivate: [UserRouteAccessService],
    data: { authorities: [] },
    loadComponent: () => import('./shared/pages/imprint-page/imprint-page.component').then(m => m.ImprintPageComponent),
    title: 'global.routes.footer.imprint',
  },
  {
    path: 'privacy',
    canActivate: [UserRouteAccessService],
    data: { authorities: [] },
    loadComponent: () => import('./shared/pages/privacy-page/privacy-page.component').then(m => m.PrivacyPageComponent),
    title: 'global.routes.footer.privacy',
  },

  // ======================================================================================
  // Settings Page
  // ======================================================================================
  {
    path: 'settings',
    canActivate: [UserRouteAccessService],
    data: {
      authorities: [
        UserShortDTORolesEnum.Admin,
        UserShortDTORolesEnum.Professor,
        UserShortDTORolesEnum.Applicant,
        UserShortDTORolesEnum.Employee,
      ],
    },
    loadComponent: () => import('./shared/settings/settings.component').then(m => m.SettingsComponent),
    title: 'global.routes.settings',
  },

  // ======================================================================================
  // Research Group
  // ======================================================================================
  {
    path: 'research-group/admin-view',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin] },
    loadComponent: () =>
      import('./usermanagement/research-group/research-group-admin-view/research-group-admin-view.component').then(
        m => m.ResearchGroupAdminView,
      ),
    title: 'global.routes.researchGroup.adminView',
  },
  {
    path: 'research-group/detail/:researchGroupId',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin] },
    loadComponent: () =>
      import('./usermanagement/research-group/research-group-admin-view/research-group-detail-view/research-group-detail-view.component').then(
        m => m.ResearchGroupDetailViewComponent,
      ),
    title: 'researchGroup.detailView.title',
  },
  {
    path: 'research-group/departments',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin] },
    loadComponent: () =>
      import('./usermanagement/research-group/research-group-departments/research-group-departments.component').then(
        m => m.ResearchGroupDepartmentsComponent,
      ),
    title: 'global.routes.researchGroup.adminView',
  },
  {
    path: 'research-group/schools',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin] },
    loadComponent: () =>
      import('./usermanagement/research-group/research-group-schools/research-group-schools.component').then(
        m => m.ResearchGroupSchoolsComponent,
      ),
    title: 'global.routes.researchGroup.schools',
  },
  {
    path: 'research-group/departments/images',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin] },
    loadComponent: () =>
      import('./usermanagement/research-group/research-group-departments/department-images/department-images.component').then(
        m => m.DepartmentImages,
      ),
    title: 'researchGroup.departments.images.title',
  },
  {
    path: 'research-group/admin-view/images',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin] },
    loadComponent: () =>
      import('./usermanagement/research-group/research-group-images/research-group-images.component').then(
        m => m.ResearchGroupImagesComponent,
      ),
    title: 'global.routes.researchGroup.adminImages',
  },
  {
    path: 'research-group/templates',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee] },
    loadComponent: () =>
      import('./usermanagement/research-group/research-group-templates/research-group-templates').then(m => m.ResearchGroupTemplates),
    title: 'global.routes.researchGroup.templates',
  },
  {
    path: 'research-group/images',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee] },
    loadComponent: () =>
      import('./usermanagement/research-group/research-group-images/research-group-images.component').then(
        m => m.ResearchGroupImagesComponent,
      ),
    title: 'global.routes.researchGroup.images',
  },
  {
    path: 'research-group/template/new',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee] },
    loadComponent: () =>
      import('./usermanagement/research-group/research-group-template-edit/research-group-template-edit').then(
        m => m.ResearchGroupTemplateEdit,
      ),
    title: 'global.routes.researchGroup.templateCreation',
  },
  {
    path: 'research-group/template/:templateId/edit',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee] },
    loadComponent: () =>
      import('./usermanagement/research-group/research-group-template-edit/research-group-template-edit').then(
        m => m.ResearchGroupTemplateEdit,
      ),
    title: 'global.routes.researchGroup.templateEdit',
  },
  {
    path: 'research-group/:id/members',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin] },
    loadComponent: () =>
      import('./usermanagement/research-group/research-group-members/research-group-members.component').then(
        m => m.ResearchGroupMembersComponent,
      ),
    title: 'researchGroup.memberHeader',
  },
  {
    path: 'research-group/members',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Admin, UserShortDTORolesEnum.Employee] },
    loadComponent: () =>
      import('./usermanagement/research-group/research-group-members/research-group-members.component').then(
        m => m.ResearchGroupMembersComponent,
      ),
    title: 'researchGroup.memberHeader',
  },
  {
    path: 'research-group/info',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Employee] },
    loadComponent: () =>
      import('./usermanagement/research-group/research-group-info/research-group-info.component').then(m => m.ResearchGroupInfoComponent),
    title: 'global.routes.researchGroup.info',
  },

  // ======================================================================================
  // About Us
  // ======================================================================================
  {
    path: 'about-us',
    canActivate: [UserRouteAccessService],
    data: { authorities: [] },
    loadComponent: () => import('./shared/pages/about-us-page/about-us-page.component').then(m => m.AboutUsPageComponent),
    title: 'global.routes.about-us',
  },

  // ======================================================================================
  // Interview
  // ======================================================================================
  {
    path: 'interviews',
    children: [
      {
        path: 'overview',
        canActivate: [UserRouteAccessService],
        loadComponent: () =>
          import('./interview/interview-processes-overview/interview-processes-overview.component').then(
            m => m.InterviewProcessesOverviewComponent,
          ),
        title: 'global.routes.interview.overview',
        data: {
          authorities: [UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Admin, UserShortDTORolesEnum.Employee],
        },
      },
      {
        path: ':processId',
        canActivate: [UserRouteAccessService],
        component: InterviewProcessDetailComponent,
        title: 'global.routes.interview.detail',
        data: {
          authorities: [UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Admin, UserShortDTORolesEnum.Employee],
        },
      },
      {
        path: 'process/:processId/interviewee/:intervieweeId/assessment',
        canActivate: [UserRouteAccessService],
        data: {
          authorities: [UserShortDTORolesEnum.Professor, UserShortDTORolesEnum.Admin, UserShortDTORolesEnum.Employee],
        },
        loadComponent: () =>
          import('./interview/interviewee-assessment/interviewee-assessment.component').then(m => m.IntervieweeAssessmentComponent),
        title: 'global.routes.interview.assessment',
      },
    ],
  },
  {
    path: 'interview-booking/:processId',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Applicant] },
    loadComponent: () => import('./interview/interview-booking/interview-booking.component').then(m => m.InterviewBookingComponent),
    title: 'interview.booking.title',
  },

  // ======================================================================================
  // External recommendation letter upload (token-only, no auth)
  // ======================================================================================
  {
    path: 'reference/:token',
    loadComponent: () =>
      import('./reference/reference-letter-upload/reference-letter-upload.component').then(m => m.ReferenceLetterUploadComponent),
    title: 'reference.pageTitle',
  },

  // ======================================================================================
  // Data Export
  // ======================================================================================
  {
    path: 'data-export/download/:token',
    canActivate: [UserRouteAccessService],
    data: { authorities: [] },
    loadComponent: () =>
      import('./shared/pages/download-data-export/download-data-export.component').then(m => m.DownloadDataExportComponent),
    title: 'global.routes.dataExport.download',
  },

  // ======================================================================================
  // Admin - AI Analytics
  // ======================================================================================
  {
    path: 'analytics',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin] },
    loadComponent: () => import('./admin/analytics/admin-analytics.component').then(m => m.AdminAnalyticsComponent),
    title: 'global.routes.admin.analytics',
  },

  // ======================================================================================
  // Admin - Dependencies
  // ======================================================================================
  {
    path: 'dependencies',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin] },
    loadComponent: () => import('./admin/dependencies/admin-dependencies.component').then(m => m.AdminDependenciesComponent),
    title: 'global.routes.admin.dependencies',
  },

  // ======================================================================================
  // Admin - Bulk Exports
  // ======================================================================================
  {
    path: 'admin-exports',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin] },
    loadComponent: () => import('./admin/exports/admin-exports.component').then(m => m.AdminExportsComponent),
    title: 'global.routes.admin.exports',
  },

  // ======================================================================================
  // Admin - System Settings
  // ======================================================================================
  {
    path: 'system-settings',
    canActivate: [UserRouteAccessService],
    data: { authorities: [UserShortDTORolesEnum.Admin] },
    loadComponent: () => import('./admin/system-settings/admin-system-settings.component').then(m => m.AdminSystemSettingsComponent),
    title: 'global.routes.admin.systemSettings',
  },

  // ======================================================================================
  // Error Handling
  // ======================================================================================
  ...errorRoute,
];

export default routes;
