# ClipScribe

YouTube 字幕提取 + AI 视频总结。Monorepo：Vue 3 前端 + Bun API，默认使用**通义千问（DashScope）**，字幕优先 **yt-dlp**。

## 功能

- 输入 YouTube URL → 提取字幕（yt-dlp）
- AI 结构化总结（主题、要点、结论、适合人群）
- 下载字幕：TXT / SRT / VTT
- LLM 可通过环境变量切换（`qwen` / `openai`）

## 项目结构

```
apps/api     # Bun HTTP API
apps/web     # Vue 3 + Vuetify + Tailwind
packages/shared
```

## 本地开发

### 前置依赖

1. [Bun](https://bun.sh)
2. [yt-dlp](https://github.com/yt-dlp/yt-dlp)（在 PATH 中）
3. 阿里云 [DashScope API Key](https://dashscope.console.aliyun.com/)

### 配置

```bash
cp .env.example apps/api/.env
# 编辑 apps/api/.env，填入 DASHSCOPE_API_KEY
```

`apps/api/.env` 示例：

```env
PORT=3000
CORS_ORIGINS=http://localhost:5173
LLM_PROVIDER=qwen
LLM_MODEL=qwen-turbo
DASHSCOPE_API_KEY=sk-xxx
YTDLP_PATH=yt-dlp
TEMP_DIR=./tmp/clipscribe
```

### 启动

```bash
bun install
bun run --filter @clipscribe/shared build
bun run dev
```

- 前端：http://localhost:5173（代理 `/api` → API）
- API：http://localhost:3000/health

### 切换模型

| 变量 | 说明 |
|------|------|
| `LLM_PROVIDER` | `qwen`（默认）或 `openai` |
| `LLM_MODEL` | 如 `qwen-turbo`、`qwen-plus`、`qwen-max` |
| `SUMMARY_LANGUAGE` | `zh`（中文总结，默认）或 `en` |
| `SUBTITLE_LANG` | `zh`（优先中文字幕）或 `en` |
| `DASHSCOPE_API_KEY` | 通义千问 |
| `OPENAI_API_KEY` | 当 `LLM_PROVIDER=openai` 时使用 |

修改后重启 API。

## API

### `GET /health`

### `POST /api/analyze`

```json
{ "url": "https://www.youtube.com/watch?v=xxxx" }
```

详细步骤见 [docs/DEPLOY.md](docs/DEPLOY.md)（含 Render Blueprint 与 GitHub Pages 配置）。

**线上地址（部署完成后）：** https://8392.github.io/ClipScribe/

**若 Pages 显示 404：** 到仓库 [Settings → Pages](https://github.com/8392/ClipScribe/settings/pages)，Source 选 **Deploy from a branch**，Branch 选 **`gh-pages`** / **root**。详见 [docs/DEPLOY.md](docs/DEPLOY.md)。

## 部署（GitHub + Render）

前端：**GitHub Pages**  
后端：**Render**（Docker，含 yt-dlp + ffmpeg）

### 1. Render（API）

1. [Render](https://render.com) → New **Web Service** → 连接本仓库  
2. **Root Directory**：留空（仓库根目录）  
3. **Dockerfile Path**：`apps/api/Dockerfile`  
4. **Environment**：Docker  
5. 环境变量：
   - `DASHSCOPE_API_KEY`
   - `LLM_PROVIDER=qwen`
   - `LLM_MODEL=qwen-turbo`
   - `CORS_ORIGINS=https://<你的用户名>.github.io`
   - `PORT=3000`
   - `TEMP_DIR=/tmp/clipscribe`
6. 复制 **Deploy Hook** URL

### 2. GitHub Actions

仓库 **Settings → Secrets and variables → Actions**：

| 类型 | 名称 | 值 |
|------|------|-----|
| Secret | `RENDER_DEPLOY_HOOK` | Render Deploy Hook URL |
| Variable | `API_URL` | Render 服务 URL，如 `https://clipscribe-api.onrender.com` |

**Settings → Pages → Build and deployment → Source**：**GitHub Actions**

### 3. 首次推送

```bash
git push origin main
```

- `deploy.yml` 构建并发布前端到 Pages  
- 若配置了 `RENDER_DEPLOY_HOOK`，会触发 API  redeploy  

Pages 地址：`https://<username>.github.io/<repo>/`  
（构建时 `VITE_BASE_PATH` 自动设为 `/<repo>/`）

### 4. CORS

`CORS_ORIGINS` 必须包含 Pages 完整源，例如：

```
https://heli2.github.io
```

若仍跨域失败，可加上带路径的源或临时使用 `*`（不推荐生产）。

## 常见错误

| `code` | 含义 | 处理 |
|--------|------|------|
| `YTDLP_FAILED` | 本机未安装/找不到 yt-dlp | 安装 [yt-dlp](https://github.com/yt-dlp/yt-dlp#installation) 并确保 `yt-dlp --version` 可用 |
| `NO_SUBTITLES` | 视频无字幕轨道 | 换一个有 CC/自动字幕的视频 |
| `RATE_LIMITED` | YouTube 429 限流 | 等 5–15 分钟；在 `.env` 设置 `YTDLP_COOKIES_FROM_BROWSER=chrome` |
| `WHISPER_NOT_AVAILABLE` | 仅在未来显式调用 Whisper 时出现 | MVP 不会自动走 Whisper |

若曾看到 Whisper 报错而实际是没装 yt-dlp，请更新代码后重启 API。

## Whisper 备用

MVP 未实现。无字幕视频请换有 CC 的视频。

## 脚本

```bash
bun run dev          # API + Web
bun run dev:api      # 推荐：自动加载 apps/api/.env
bun run dev:web
bun run build
bun run lint
bun run typecheck
bun run test:e2e     # 端到端测试（需 API 已启动）
```

**配置 Key**：写在 `apps/api/.env`（不是 `.env.example`）。

**Cookies（可选）**：`.env` 里 `YTDLP_COOKIES_FROM_BROWSER=chrome` 需在**关闭 Chrome** 后启动 API，否则会失败；不配置也能正常使用。

## License

MIT
