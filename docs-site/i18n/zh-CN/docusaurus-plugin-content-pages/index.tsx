import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

const featureCards = [
  {
    title: '类 Vercel 的拉取体验',
    description: '通过 setup、push、pull、export 命令，把多台机器上的 .env 流程统一起来。',
    href: '/docs/getting-started'
  },
  {
    title: '原生多环境支持',
    description: '用同一套 CLI 管理 development、staging、production，键空间彼此隔离。',
    href: '/docs/multi-environment'
  },
  {
    title: 'Node + Python 运行时 SDK',
    description: '服务启动时拉取配置，并支持长运行服务中的热更新能力。',
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
    <Layout title="cfenv | Cloudflare KV 环境管理" description="cfenv 使用 Cloudflare KV 在多设备间同步环境变量。">
      <main className="home-main">
        <section className="home-hero">
          <div className="home-orb home-orb-one" />
          <div className="home-orb home-orb-two" />
          <div className="home-hero-inner">
            <p className="home-badge">Cloudflare KV 环境变量平台</p>
            <h1>一份 KV 源，多端一致。</h1>
            <p className="home-subtitle">让个人电脑、CI 流水线和在线服务共用同一套环境变量来源。</p>
            <div className="home-cta">
              <Link className={clsx('button button--primary button--lg home-button')} to="/docs/getting-started">
                开始使用
              </Link>
              <Link className={clsx('button button--secondary button--lg home-button')} to="/docs/architecture">
                查看架构
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
          <h2>快速路径</h2>
          <p>4 条命令完成初始化与同步。</p>
          <pre>
            <code>{quickPath.join('\n')}</code>
          </pre>
        </section>
      </main>
    </Layout>
  );
}
