import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  professorsSidebar: [
    {
      type: 'category',
      label: 'Professors / Employees',
      collapsed: false,
      link: {
        type: 'generated-index',
        description:
          'All information for professors and employees: from first login and research group setup to managing applications and email templates.',
      },
      items: [
        'account-creation',
        'login',
        'research-groups',
        {
          type: 'category',
          label: 'Create Job',
          link: {type: 'doc', id: 'create-job'},
          items: ['ai-writing-and-translation'],
        },
        'manage-jobs',
        'application-review',
        'interview',
      ],
    },
  ],
};

export default sidebars;
