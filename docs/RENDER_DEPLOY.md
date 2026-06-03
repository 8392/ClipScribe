# Render 后端部署（5 分钟）

## 方式 A：一键部署（推荐）

1. 打开：**https://render.com/deploy?repo=https://github.com/8392/ClipScribe**
2. 登录 Render（可用 GitHub 登录）
3. 在环境变量里填写 **`DASHSCOPE_API_KEY`**（通义千问密钥，与本地 `apps/api/.env` 相同）
4. 点击 **Apply** / **Deploy**，等待约 5–10 分钟（Docker 构建较慢）
5. 部署完成后复制服务地址，一般为：**https://clipscribe-api.onrender.com**
6. 浏览器打开 `https://clipscribe-api.onrender.com/health`，应看到 `"ok": true`

## 方式 B：Dashboard 手动创建

1. https://dashboard.render.com/ → **New +** → **Blueprint**
2. 选择仓库 `8392/ClipScribe`
3. 填写 `DASHSCOPE_API_KEY` → 部署

## 部署后（可选，推荐）

在 GitHub 添加变量，便于以后自动构建前端时写入 API 地址：

https://github.com/8392/ClipScribe/settings/variables/actions

| 名称 | 值 |
|------|-----|
| `API_URL` | `https://clipscribe-api.onrender.com` |

然后 **Actions → Deploy → Run workflow** 重新部署前端。

> 未设置 `API_URL` 时，线上前端也会默认请求 `https://clipscribe-api.onrender.com`。

## 验收

在 https://8392.github.io/ClipScribe/ 分析一个有字幕的 YouTube 视频。
