# 多环境管理

同一仓库可以配置多个环境目标：

```bash
cfenv setup --project myapp --env development
cfenv setup --project myapp --env preview
cfenv setup --project myapp --env production
```

```bash
cfenv targets
cfenv use --env production
```
