# 快速开始

## 安装

```bash
npm install -g cfenv-kv-sync@beta
```

## 快速路径（复用 Wrangler 登录）

```bash
cfenv setup --project myapp --env development
cfenv push --env development --file .env
cfenv pull --env development --out .env --overwrite
```

## Token 路径

```bash
cfenv login --profile default --account-id <ACCOUNT_ID> --api-token <API_TOKEN>
cfenv link --project myapp --env development --namespace-id <NAMESPACE_ID>
cfenv push --env development --file .env
```
