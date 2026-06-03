# 将 cookies.txt 转为 Render 环境变量 YTDLP_COOKIES_BASE64 用的单行 Base64
param(
  [Parameter(Mandatory = $true)]
  [string]$CookiesPath
)

$full = Resolve-Path $CookiesPath
$bytes = [IO.File]::ReadAllBytes($full)
$b64 = [Convert]::ToBase64String($bytes)
Write-Host "文件: $full"
Write-Host "长度: $($b64.Length) 字符"
Write-Host ""
Write-Host "复制下面整行到 Render -> Environment -> YTDLP_COOKIES_BASE64 :"
Write-Host $b64
