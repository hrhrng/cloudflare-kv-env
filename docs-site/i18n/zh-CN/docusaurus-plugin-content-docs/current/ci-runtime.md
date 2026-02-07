# CI 与运行时集成

部署前导出环境变量：

```bash
cfenv export --env production --format dotenv --out .env --overwrite
```

建议：

- 不要在日志打印 secret
- `.env` 不要提交到仓库
- 生产环境使用专用 Token
