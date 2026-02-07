---
id: index
slug: /
title: 总览
---

# 总览

cfenv 使用 Cloudflare KV 作为跨设备、CI 流水线、运行时服务的统一环境变量来源。

<div className="hero-note">
<b>Beta 状态：</b>CLI、Node SDK、Python SDK 已发布并经过端到端验证。
</div>

## 核心能力

- 类似 `vercel pull` 的本地流程（`setup/push/pull/export`）
- 单仓库多环境管理
- Node 与 Python SDK 运行时集成能力
- GitHub Actions 自动化发布与文档部署

## 包分发地址

- npm: [`cfenv-kv-sync`](https://www.npmjs.com/package/cfenv-kv-sync)
- PyPI: [`cfenv-kv-sync-python`](https://pypi.org/project/cfenv-kv-sync-python/)
