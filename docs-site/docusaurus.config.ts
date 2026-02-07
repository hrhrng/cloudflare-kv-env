import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'cfenv',
  tagline: 'Portable environment management on Cloudflare KV',
  favicon: 'img/logo.svg',

  url: 'https://hrhrng.github.io',
  baseUrl: '/cloudflare-kv-env/',
  trailingSlash: true,

  organizationName: 'hrhrng',
  projectName: 'cloudflare-kv-env',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-CN'],
    localeConfigs: {
      en: {
        label: 'English'
      },
      'zh-CN': {
        label: '简体中文'
      }
    }
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/hrhrng/cloudflare-kv-env/tree/main/docs-site/'
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css'
        }
      } satisfies Preset.Options
    ]
  ],

  themeConfig: {
    image: 'img/logo.svg',
    colorMode: {
      respectPrefersColorScheme: true
    },
    announcementBar: {
      id: 'beta-banner',
      content: 'cfenv is in beta. Feedback and issues are welcome on GitHub.',
      backgroundColor: '#ffe9cc',
      textColor: '#1f2937',
      isCloseable: true
    },
    navbar: {
      title: 'cfenv',
      logo: {
        alt: 'cfenv logo',
        src: 'img/logo.svg'
      },
      items: [
        { to: '/', label: 'Home / 首页', position: 'left' },
        { type: 'docSidebar', sidebarId: 'docsSidebar', label: 'Docs / 文档', position: 'left' },
        { to: '/docs/getting-started', label: 'Quick Start / 快速开始', position: 'left' },
        { href: 'https://www.npmjs.com/package/cfenv-kv-sync', label: 'npm', position: 'right' },
        { href: 'https://pypi.org/project/cfenv-kv-sync-python/', label: 'PyPI', position: 'right' },
        {
          href: 'https://github.com/hrhrng/cloudflare-kv-env',
          label: 'GitHub',
          position: 'right'
        },
        { type: 'localeDropdown', position: 'right' }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting Started', to: '/docs/getting-started' },
            { label: 'CLI Reference', to: '/docs/cli-reference' },
            { label: 'Architecture', to: '/docs/architecture' }
          ]
        },
        {
          title: 'Packages',
          items: [
            { label: 'npm', href: 'https://www.npmjs.com/package/cfenv-kv-sync' },
            { label: 'PyPI', href: 'https://pypi.org/project/cfenv-kv-sync-python/' }
          ]
        },
        {
          title: 'Community',
          items: [{ label: 'GitHub', href: 'https://github.com/hrhrng/cloudflare-kv-env' }]
        }
      ],
      copyright: `Copyright © ${new Date().getFullYear()} cfenv.`
    }
  } satisfies Preset.ThemeConfig
};

export default config;
