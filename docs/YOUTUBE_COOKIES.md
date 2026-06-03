# 解决线上 YouTube 429 限流

Render 等云服务器 IP 容易被 YouTube 限流。

部署最新 API 后，线上会**优先**用网页字幕接口拉取（不经过 yt-dlp），多数视频可直接成功。若仍出现 429，再按下面配置 **Cookies**。

## 步骤（约 3 分钟）

1. 浏览器安装扩展 **Get cookies.txt LOCALLY**（Chrome/Edge）
2. 打开 https://www.youtube.com 并登录（可选）
3. 用扩展导出 `youtube.com` 的 cookies → 得到 `cookies.txt`
4. 把 `cookies.txt` **Base64 编码**：

   **Windows PowerShell：**
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\cookies.txt"))
   ```

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
