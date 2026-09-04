// @ts-check

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Tarun Uppu',
  tagline: 'Notes on system design, AI agents, and backend engineering',
  favicon: 'img/favicon.svg',

  // Google's crawler doesn't reliably resolve an SVG-only favicon (it fell
  // back to a generic globe icon in search results), so PNG/ICO copies are
  // served explicitly alongside the SVG that browsers use directly.
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
    {
      tagName: 'link',
      attributes: {rel: 'icon', type: 'image/x-icon', href: '/favicon.ico'},
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/img/favicon-16.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/img/favicon-32.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '48x48',
        href: '/img/favicon-48.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '96x96',
        href: '/img/favicon-96.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '192x192',
        href: '/img/favicon-192.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '512x512',
        href: '/img/favicon-512.png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/img/apple-touch-icon.png',
      },
    },
  ],

  stylesheets: [
    {
      href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Mono:wght@400;500&display=swap',
      type: 'text/css',
    },
  ],

  // Off deliberately: the v4 flag parses .md as plain CommonMark, which turns
  // admonitions (:::tip) into literal text on the page. Setting
  // markdown.format does not override it — only this does. Revisit when
  // actually upgrading to v4, at which point admonitions need .mdx files.
  future: {
    v4: false,
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
      image: 'img/og-card.png',
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
              {label: 'CI/CD', to: '/ci-cd/overview'},
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
