# 部署检查清单

一次性配置完成后，每次推送到 `main` 会自动部署前端；API 在配置 Deploy Hook 后同步触发。

## GitHub

### Secrets

| 名称 | 说明 |
|------|------|
| `RENDER_DEPLOY_HOOK` | Render → Service → Settings → Deploy Hook |

### Variables

| 名称 | 示例 | 说明 |
|------|------|------|
| `API_URL` | `https://clipscribe-api.onrender.com` | 无尾部斜杠；用于构建前端 `VITE_API_BASE` |

### Pages

- Settings → Pages → **GitHub Actions**
- 站点 URL：`https://<username>.github.io/<repository>/`

## Render

| 变量 | 示例 |
|------|------|
| `DASHSCOPE_API_KEY` | `sk-...` |
| `LLM_PROVIDER` | `qwen` |
| `LLM_MODEL` | `qwen-turbo` |
| `CORS_ORIGINS` | `https://<username>.github.io` |
| `PORT` | `3000` |
| `TEMP_DIR` | `/tmp/clipscribe` |

- Root Directory：**（空）**
- Dockerfile Path：`apps/api/Dockerfile`

## 验收

1. `curl https://<api>/health` → `{"ok":true,...}`
2. 打开 Pages URL，分析带字幕的 YouTube 视频
3. 下载 TXT / SRT / VTT 成功

## 本地验收

```bash
bun install
bun run --filter @clipscribe/shared build
# 配置 apps/api/.env
bun run dev:api
# 另一终端
bun run dev:web
```

测试 URL 示例（需有英文字幕）：`https://www.youtube.com/watch?v=jNQXAC9IVRw`
