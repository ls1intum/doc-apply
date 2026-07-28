import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'DocApply',
  tagline: 'Documentation for Users',
  favicon: 'img/docapply-logo.svg',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://ls1intum.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/doc-apply/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'ls1intum', // Usually your GitHub org/user name.
  projectName: 'doc-apply', // Usually your repo name.

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn'
    }
  },

  presets: [
    [
      'classic',
      {
        docs: false,
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true
          },
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/ls1intum/doc-apply/tree/main/docs',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn'
        },
        theme: {
          customCss: './src/css/custom.css'
        }
      } satisfies Preset.Options
    ]
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'applicants',
        path: 'docs/applicants',
        routeBasePath: 'applicants',
        sidebarPath: './sidebar-applicants.ts',
        editUrl: 'https://github.com/ls1intum/doc-apply/tree/main/docs',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'professors',
        path: 'docs/professors-and-employees',
        routeBasePath: 'professors',
        sidebarPath: './sidebar-professors.ts',
        editUrl: 'https://github.com/ls1intum/doc-apply/tree/main/docs',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'developer',
        path: 'docs/developer',
        routeBasePath: 'developer',
        sidebarPath: './sidebar-developer.ts',
        editUrl: 'https://github.com/ls1intum/doc-apply/tree/main/docs',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'admin',
        path: 'docs/admins',
        routeBasePath: 'admin',
        sidebarPath: './sidebar-admin.ts',
        editUrl: 'https://github.com/ls1intum/doc-apply/tree/main/docs',
      },
    ],
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        docsRouteBasePath: ['applicants', 'professors', 'developer', 'admin'],
        docsPluginIdForPreferredVersion: 'applicants',
        searchContextByPaths: ['applicants', 'professors', 'developer', 'admin'],
        hideSearchBarWithNoSearchContext: true,
      },
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'DocApply Docs',
      logo: {
        alt: 'DocApply Logo',
        src: 'img/docapply-logo.svg'
      },
      items: [
        {
          to: '/applicants/category/applicants',
          label: 'Applicants',
          position: 'left',
        },
        {
          to: '/professors/category/professors--employees',
          label: 'Professors',
          position: 'left',
        },
        {
          to: '/developer/category/developers',
          label: 'Developers',
          position: 'left',
        },
        {
          to: '/admin/category/admins',
          label: 'Admins',
          position: 'left',
        },
        {
          href: 'https://github.com/ls1intum/doc-apply',
          label: 'GitHub',
          position: 'right'
        }
      ]
    },
    footer: {
      style: 'dark',
      links: [],
      copyright: `© 2026 Technische Universität München – Built with ❤️ by the DocApply Team at Applied Education Technologies (AET)`
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula
    }
  } satisfies Preset.ThemeConfig
};

export default config;
