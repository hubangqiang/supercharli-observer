# supercharli-observer（中文说明）

SuperCharli 观测系统（只读）。用于可视化查看记忆、学习、成长与运行状态。

## 边界原则
- 该仓库仅用于观察，不承载核心对话、记忆写入或学习决策逻辑。
- 大模型能力由核心系统调用的外部模型承担。
- 观测系统用于帮助你看清系统状态，不替代模型智能。

## 运行
```bash
cd /Users/apple/Documents/code/supercharli-observer
npm start
```

打开：`http://localhost:4100`

## 数据源
默认读取：`~/supercharli-runtime/data/supercharli.db`

可选环境变量：
- `PORT`（默认 `4100`）
- `SUPERCHARLI_DB_PATH`
- `SUPERCHARLI_LEARNING_SCOPE`（默认 `daemon-main`）
- `SUPERCHARLI_SELF_SCOPE`（默认 `daemon-main`）

## 只读 API
- `/api/observer/summary`
- `/api/observer/memory`
- `/api/observer/learning`
- `/api/observer/runtime`
- `/api/observer/sessions`
- `/api/observer/skills`

`/api/observer/skills` 同时包含：
- 注入 skill（prompt pack）目录与注入历史
- 管理 skill（方法资产）目录与使用历史
