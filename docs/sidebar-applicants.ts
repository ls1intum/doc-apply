import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  applicantsSidebar: [
    {
      type: 'category',
      label: 'Applicants',
      collapsed: false,
      link: {
        type: 'generated-index',
        description:
          'All information for applicants: from account creation and login to submitting and managing your applications.',
      },
      items: [
        'account-creation',
        'login',
        'settings',
        'browse-positions',
        {
          type: 'category',
          label: 'Apply',
          link: {type: 'doc', id: 'apply'},
          items: ['ai-extraction', 'recommendation-letters'],
        },
        'application-dashboard',
      ],
    },
  ],
};

export default sidebars;
