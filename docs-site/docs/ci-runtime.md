# CI and Runtime Integration

Use export before build/deploy:

```bash
cfenv export --env production --format dotenv --out .env --overwrite
```

Guidelines:

- Never print secret values
- Keep `.env` out of git
- Prefer dedicated service tokens in CI/prod
