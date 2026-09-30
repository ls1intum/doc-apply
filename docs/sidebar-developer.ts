import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  developerSidebar: [
    {
      type: 'category',
      label: 'Developers',
      collapsed: false,
      link: {
        type: 'generated-index',
        description:
          'All information for developers: from setting up your local environment to coding guidelines, testing, and deployment.',
      },
      items: [
        {
          type: 'category',
          label: 'Getting Started',
          items: [
            'getting-started/development-environment',
            'getting-started/local-llm-setup',
          ],
        },
        {
          type: 'category',
          label: 'General Guidelines',
          items: [
            'general-guidelines/branch-guidelines',
            'general-guidelines/pull-request-guidelines',
            'general-guidelines/openapi',
            'general-guidelines/writing-documentation',
          ],
        },
        {
          type: 'category',
          label: 'Server Guidelines',
          items: [
            'server-guidelines/server-development',
            'server-guidelines/server-tests',
            'server-guidelines/api-testing-with-postman',
            'server-guidelines/database-and-performance',
            'server-guidelines/liquibase-guidelines',
            'server-guidelines/error-handling',
          ],
        },
        {
          type: 'category',
          label: 'Client Guidelines',
          items: [
            'client-guidelines/client-development',
            'client-guidelines/client-styling',
            'client-guidelines/client-tests',
            'client-guidelines/language-guidelines',
            'client-guidelines/color-theming',
          ],
        },
        {
          type: 'category',
          label: 'Infrastructure & CI/CD',
          items: [
            'infrastructure-and-cicd/environment-variables',
            'infrastructure-and-cicd/testserver-deployment',
          ],
        },
        {
          type: 'category',
          label: 'Authentication & Authorization',
          items: [
            'authentication-and-authorization/authentication-flow',
            'authentication-and-authorization/authorization',
            {
              type: 'category',
              label: 'Keycloak',
              items: [
                'authentication-and-authorization/keycloak/overview',
                'authentication-and-authorization/keycloak/development-setup',
                'authentication-and-authorization/keycloak/test-users',
              ],
            },
          ],
        },
      ],
    },
  ],
};

export default sidebars;
