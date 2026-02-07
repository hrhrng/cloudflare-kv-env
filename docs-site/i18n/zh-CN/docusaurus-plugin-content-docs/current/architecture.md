# 架构概览

## 组件

- TypeScript CLI
- Cloudflare REST API
- KV 存储（project + env 维度）

## 数据模型

### flat 模式

- `cfenv:<project>:<env>:vars:<KEY>`
- `cfenv:<project>:<env>:meta`

### snapshot 模式

- `cfenv:<project>:<env>:current`
- `cfenv:<project>:<env>:versions:<versionId>`
