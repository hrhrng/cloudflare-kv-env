import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'index',
    {
      type: 'category',
      label: 'Quick Start',
      items: ['getting-started', 'cli-reference', 'multi-environment']
    },
    {
      type: 'category',
      label: 'SDKs',
      items: ['node-sdk', 'python-sdk']
    },
    {
      type: 'category',
      label: 'Operations',
      items: ['ci-runtime', 'architecture', 'production-checklist', 'release-guide', 'user-flow-simulation']
    }
  ]
};

export default sidebars;
