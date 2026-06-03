# 解决线上 YouTube 429 限流

Render 等云服务器 IP 容易被 YouTube 限流。

部署最新版后，**GitHub Pages 会先用您浏览器的网络**（Piped/Invidious 代理）拉字幕，再交给 Render 只做 AI 总结，避免机房 IP 被 YouTube 限流。若仍失败，再按下面配置 **Cookies**。

## 步骤（约 3 分钟）

1. 浏览器安装扩展 **Get cookies.txt LOCALLY**（Chrome/Edge）
2. 打开 https://www.youtube.com 并登录（可选）
3. 用扩展导出 `youtube.com` 的 cookies → 得到 `cookies.txt`
4. 把 `cookies.txt` **Base64 编码**（任选一种）：

   **项目脚本（推荐）：**
   ```powershell
   cd e:\artist_project\ClipScribe
   .\scripts\encode-youtube-cookies.ps1 -CookiesPath "C:\path\to\cookies.txt"
   ```

   **或手动：**
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\cookies.txt"))
   ```

   > 导出前请先在浏览器打开 https://www.youtube.com 并**登录**，否则 cookies 无效。

5. Render → **clipscribe-api** → **Environment** → 新增：
   - Key: `YTDLP_COOKIES_BASE64`
   - Value: 粘贴整段 Base64 字符串（一行）

6. **Manual Deploy** 重新部署服务

## 本地开发

在 `apps/api/.env`：

```env
YTDLP_COOKIES_FROM_BROWSER=chrome
```

需**完全关闭 Chrome** 后重启 API。
