# CLI 命令参考

## 核心命令

- `cfenv setup`
- `cfenv login`
- `cfenv profiles`
- `cfenv link`
- `cfenv targets`
- `cfenv use`
- `cfenv push`
- `cfenv pull`
- `cfenv export`
- `cfenv history`
- `cfenv keygen`

## 存储模式

### `flat`（默认）

- 每个环境变量对应一个 KV key
- 结构直观，便于排查

### `snapshot`

- 版本化快照
- 支持加密快照负载
