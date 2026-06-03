# 解决线上 YouTube 429 限流

Render 等云服务器 IP 容易被 YouTube 限流。

线上由 **Render API** 通过 Piped/Invidious 代理拉字幕（浏览器无法直连这些代理，会 CORS 报错）。代理失败或 YouTube 限流时，再按下面配置 **Cookies**（可选）。

## 一键配置（推荐）

1. 浏览器安装扩展 **Get cookies.txt LOCALLY**（Chrome/Edge）
2. 打开 https://www.youtube.com 并 **登录**
3. 用扩展导出 `youtube.com` cookies，保存为：
   ```
   apps/api/youtube-cookies.txt
   ```
4. 在项目根目录运行（会自动写入 `.env` 并 **复制 Base64 到剪贴板**）：
   ```powershell
   cd e:\artist_project\ClipScribe
   .\scripts\setup-youtube-cookies.ps1
   ```
5. Render → **clipscribe-api** → **Environment** → 新增：
   - Key: `YTDLP_COOKIES_BASE64`
   - Value: `Ctrl+V` 粘贴（上一步已复制）
6. **Save Changes** → **Manual Deploy**

验证：`https://clipscribe-api.onrender.com/health` 里应为 `"ytdlpCookiesConfigured": true`

## 手动 Base64（可选）

```powershell
.\scripts\encode-youtube-cookies.ps1 -CookiesPath "C:\path\to\cookies.txt"
```

## 本地开发

在 `apps/api/.env`：

```env
YTDLP_COOKIES_FROM_BROWSER=chrome
```

需**完全关闭 Chrome** 后重启 API。
