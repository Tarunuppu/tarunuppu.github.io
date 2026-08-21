// @ts-check

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Tarun Uppu',
  tagline: 'Notes on system design, AI agents, and backend engineering',
  favicon: 'img/favicon.svg',

  headTags: [
    {
      tagName: 'link',
      attributes: {rel: 'preconnect', href: 'https://fonts.googleapis.com'},
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: 'anonymous',
      },
    },
  ],

  stylesheets: [
    {
      href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Mono:wght@400;500&display=swap',
      type: 'text/css',
    },
  ],

  future: {
    v4: true,
  },

  // Served on the custom domain. The apex is canonical; www redirects to it.
  // The domain is pinned by static/CNAME, which Docusaurus copies to the build
  // root so the Pages deploy keeps it on every run.
  // baseUrl stays '/' because the repo is named "tarunuppu.github.io" and so
  // serves from the root with no path prefix.
  url: 'https://tarunuppu.com',
  baseUrl: '/',

  organizationName: 'Tarunuppu',
  projectName: 'tarunuppu.github.io',

  onBrokenLinks: 'throw',

  // Renders ```mermaid fences as diagrams (class and sequence diagrams in the
  // low-level design notes).
  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

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
          editUrl: 'https://github.com/Tarunuppu/tarunuppu.github.io/tree/main/',
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
      // Greyscale diagrams — the site's palette is near-monochrome, and
      // mermaid's default theme fights it with saturated fills.
      mermaid: {
        theme: {light: 'neutral', dark: 'dark'},
        options: {
          // A system font, deliberately: mermaid sizes each box by measuring
          // its text, and a webfont that arrives after that measurement makes
          // the text outgrow the box and clip. System fonts are there already.
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        },
      },
      navbar: {
        // Wordmark only — a set-in-type name reads more considered here than a
        // letter-in-a-box icon, which is the default-template look.
        title: 'Tarun Uppu',
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
        // Footer colours are theme-aware in custom.css, so it follows the
        // page rather than being pinned dark.
        style: 'light',
        links: [
          {
            title: 'Notes',
            items: [
              {label: 'Foundations', to: '/foundations/rag'},
              {label: 'Agent patterns', to: '/agent-patterns/overview'},
              {label: 'Multi-agent', to: '/multi-agent/overview'},
              {label: 'Tool use', to: '/tool-use/overview'},
              {label: 'Low-level design', to: '/low-level-design/oop-foundations'},
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
        theme: prismThemes.oneLight,
        darkTheme: prismThemes.oneDark,
      },
    }),
};

export default config;
