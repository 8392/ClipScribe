import { config } from '../../config'

export function buildSummaryPrompt(transcript: string, videoTitle: string): string {
  const truncated = transcript.length > 80_000
    ? `${transcript.slice(0, 80_000)}\n\n[... 字幕已截断 ...]`
    : transcript

  const langRule = config.summaryLanguage === 'zh'
    ? '【重要】JSON 中所有字段的值必须使用简体中文撰写（专有名词可保留英文）。不得使用英文段落。'
    : 'All JSON field values must be written in English.'

  return `你是一个专业视频分析助手，请对以下字幕内容进行结构化总结。

${langRule}

视频标题：${videoTitle}

请严格只输出一个 JSON 对象，不要 markdown 代码块，不要其他文字。字段如下：
{
  "title": "视频主题",
  "summary": "一段话总结",
  "keyPoints": ["核心观点1", "核心观点2", "共3-7条"],
  "details": "关键细节",
  "conclusion": "重要结论",
  "audience": "适合人群"
}

字幕内容：
${truncated}`
}

export function buildSystemMessage(): string {
  if (config.summaryLanguage === 'zh') {
    return '你是视频分析助手。只输出合法 JSON，不要 markdown。所有文本字段必须使用简体中文。'
  }
  return 'You are a video analysis assistant. Output valid JSON only, no markdown. Use English for all text fields.'
}
