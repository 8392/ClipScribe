# ClipScribe 部署指南

## 线上地址

- 前端：https://8392.github.io/ClipScribe/
- API（Render）：创建后如 `https://clipscribe-api.onrender.com`

---

## 一、前端 GitHub Pages（解决 404）

### 1. 等待 Deploy 工作流成功

推送代码后打开：https://github.com/8392/ClipScribe/actions  
确认 **Deploy** 为绿色，且会生成 **`gh-pages`** 分支。

### 2. 开启 Pages（必做，否则一直 404）

打开：**https://github.com/8392/ClipScribe/settings/pages**

| 设置项 | 选择 |
|--------|------|
| **Source** | Deploy from a branch |
| **Branch** | `gh-pages` |
| **Folder** | `/ (root)` |

点击 **Save**，等待 1–2 分钟。

### 3. 访问

https://8392.github.io/ClipScribe/

若仍 404：确认 `gh-pages` 分支已有 `index.html`（Actions 跑成功后会有）。

---

## 二、后端 Render API

1. https://dashboard.render.com/ → **New** → **Blueprint**
2. 连接仓库 `8392/ClipScribe`，使用 [`render.yaml`](../render.yaml)
3. 填写 **`DASHSCOPE_API_KEY`**
4. 部署完成后访问：`https://<服务名>.onrender.com/health`

环境变量确认：

- `CORS_ORIGINS` = `https://8392.github.io`
- `SUMMARY_LANGUAGE` = `zh`
- `SUBTITLE_LANG` = `zh`

---

## 三、让前端连上 API

https://github.com/8392/ClipScribe/settings/variables/actions

添加 **Variable**：

| 名称 | 值 |
|------|-----|
| `API_URL` | Render 地址，无尾部 `/`，如 `https://clipscribe-api.onrender.com` |

保存后：**Actions → Deploy → Run workflow** 重新部署前端。

---

## 验收

1. Pages 能打开，不是 404
2. 分析有字幕的 YouTube 视频
3. 总结为中文
