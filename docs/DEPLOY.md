# ClipScribe 部署指南（8392/ClipScribe）

## 架构

| 组件 | 平台 | 地址 |
|------|------|------|
| 前端 | GitHub Pages | https://8392.github.io/ClipScribe/ |
| API | Render（Docker） | 创建后形如 `https://clipscribe-api.onrender.com` |

---

## 第一步：部署 API（Render）

1. 打开 [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**
2. 连接 GitHub 仓库 `8392/ClipScribe`，使用根目录的 [`render.yaml`](../render.yaml)
3. 创建服务时填写 **`DASHSCOPE_API_KEY`**（通义千问密钥）
4. 确认环境变量：
   - `CORS_ORIGINS` = `https://8392.github.io`
   - `SUMMARY_LANGUAGE` = `zh`
   - `SUBTITLE_LANG` = `zh`
5. 等待部署完成，记下服务 URL，例如：`https://clipscribe-api.onrender.com`
6. 浏览器访问 `https://<你的服务>/health`，应返回 `"ok": true`

**或手动创建 Web Service：**

- Runtime: Docker  
- Dockerfile Path: `apps/api/Dockerfile`  
- Root Directory: 留空（仓库根目录）

---

## 第二步：配置 GitHub

仓库：https://github.com/8392/ClipScribe

### Settings → Secrets and variables → Actions

| 类型 | 名称 | 值 |
|------|------|-----|
| **Variable** | `API_URL` | Render API 地址，无尾部 `/`，如 `https://clipscribe-api.onrender.com` |
| **Secret**（可选） | `RENDER_DEPLOY_HOOK` | Render → Service → Settings → Deploy Hook |

### Settings → Pages

- **Source**：GitHub Actions（不要选 Deploy from branch）

---

## 第三步：触发部署

推送 `main` 分支，或在 Actions 页手动运行 **Deploy** workflow：

```bash
git push origin main
```

成功后访问：https://8392.github.io/ClipScribe/

---

## 验收

1. `curl https://<api-url>/health` → `ok: true`
2. 打开 Pages 站点，分析一个有字幕的 YouTube 视频
3. 总结为中文（已配置 `SUMMARY_LANGUAGE=zh`）

---

## 常见问题

| 现象 | 处理 |
|------|------|
| Pages 打开空白 / 404 | 确认 Pages 源为 **GitHub Actions**；等待 Deploy workflow 绿勾 |
| 前端无法调 API | 检查 Variable `API_URL` 是否已设并重新跑 Deploy |
| CORS 错误 | Render 中 `CORS_ORIGINS` 必须是 `https://8392.github.io`（无路径） |
| API 冷启动慢 | Render 免费档首次请求约 30–60s，属正常 |
