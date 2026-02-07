import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

const featureCards = [
  {
    title: 'Vercel-like Pull Flow',
    description:
      'Use setup, push, pull, and export commands to keep local .env files in sync across machines.',
    href: '/docs/getting-started'
  },
  {
    title: 'Multi-Environment Ready',
    description: 'Manage development, staging, and production with isolated keys and one CLI.',
    href: '/docs/multi-environment'
  },
  {
    title: 'Node + Python Runtime SDKs',
    description: 'Load environment values at runtime and support hot update in long-running services.',
    href: '/docs/ci-runtime'
  }
];

const quickPath = [
  'npm install -g cfenv-kv-sync',
  'cfenv setup --project demo --env development',
  'cfenv push --project demo --env development --file .env.local',
  'cfenv pull --project demo --env development --output .env'
];

export default function Home(): JSX.Element {
  return (
    <Layout
      title="cfenv | Cloudflare KV Environment Hub"
      description="cfenv syncs environment variables across machines using Cloudflare KV."
    >
      <main className="home-main">
        <section className="home-hero">
          <div className="home-orb home-orb-one" />
          <div className="home-orb home-orb-two" />
          <div className="home-hero-inner">
            <p className="home-badge">Cloudflare KV Environment Platform</p>
            <h1>One KV Source. Every Machine.</h1>
            <p className="home-subtitle">
              Keep .env files portable and consistent across personal devices, CI, and runtime services.
            </p>
            <div className="home-cta">
              <Link className={clsx('button button--primary button--lg home-button')} to="/docs/getting-started">
                Start with Docs
              </Link>
              <Link className={clsx('button button--secondary button--lg home-button')} to="/docs/architecture">
                View Architecture
              </Link>
            </div>
          </div>
        </section>

        <section className="home-grid">
          {featureCards.map((card) => (
            <Link key={card.title} to={card.href} className="home-card">
              <h2>{card.title}</h2>
              <p>{card.description}</p>
            </Link>
          ))}
        </section>

        <section className="home-shell">
          <h2>Quick Path</h2>
          <p>Four commands to initialize and sync environment variables.</p>
          <pre>
            <code>{quickPath.join('\n')}</code>
          </pre>
        </section>
      </main>
    </Layout>
  );
}
