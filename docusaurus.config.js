// @ts-check

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Tarun Uppu',
  tagline: 'Notes on system design, AI agents, and backend engineering',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  // Using GitHub Pages for now (no custom domain yet).
  // Name your repo exactly "tarunuppu.github.io" so it serves at the root
  // with no path prefix — that way baseUrl stays '/' even after you add a
  // custom domain later; you'll only need to change the url below at that point.
  url: 'https://tarunuppu.github.io',
  baseUrl: '/',

  // TODO: replace 'tarunuppu' with your actual GitHub username if different
  organizationName: 'tarunuppu',
  projectName: 'tarunuppu.github.io',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/', // serve docs at the site root, e.g. tarunuppu.dev/agent-patterns
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/tarunuppu/tarunuppu.github.io/tree/main/',
        },
        blog: false, // not used — this is a docs-only site
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/docusaurus-social-card.jpg',
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Tarun Uppu',
        logo: {
          alt: 'Tarun Uppu logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Notes',
          },
          {
            href: 'https://github.com/tarunuppu',
            label: 'GitHub',
            position: 'right',
          },
          {
            href: 'https://linkedin.com/in/tarunuppu',
            label: 'LinkedIn',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Notes',
            items: [
              {label: 'Foundations', to: '/foundations/rag'},
              {label: 'Agent patterns', to: '/agent-patterns/overview'},
              {label: 'Multi-agent', to: '/multi-agent/overview'},
              {label: 'Tool use', to: '/tool-use/overview'},
            ],
          },
          {
            title: 'Elsewhere',
            items: [
              {label: 'GitHub', href: 'https://github.com/tarunuppu'},
              {label: 'LinkedIn', href: 'https://linkedin.com/in/tarunuppu'},
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Tarun Uppu.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
