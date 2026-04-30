// ============================================
// 通义千问 API - 支持多模态（图片输入）
// ============================================

const QWEN_API_KEY = import.meta.env.VITE_QWEN_API_KEY || 'your-api-key'
const QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

export interface ChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
}

// 通义千问支持的文本内容
export interface QwenTextContent {
  type: 'text'
  text: string
}

// 通义千问支持的单张图片内容
export interface QwenImageContent {
  type: 'image_url'
  image_url: {
    url: string
  }
}

// 通义千问消息内容类型
export type QwenMessageContent = string | (QwenTextContent | QwenImageContent)[]

export interface QwenMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: QwenMessageContent
  name?: string
  tool_call_id?: string
  tool_calls?: any[]
}

export interface QwenChatCompletionResponse {
  id: string
  choices: Array<{
    message: {
      role: string
      content: string | null
      tool_calls?: any[]
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// ----------------------
// 通义千问 API 调用（普通模式，支持图片）
// ----------------------
export async function qwenChatCompletion(
  messages: QwenMessage[],
  tools?: any[],
  options: ChatOptions = {}
): Promise<QwenChatCompletionResponse> {
  const {
    model = 'qwen-vl-max',  // 使用支持视觉的模型
    temperature = 0.7,
    maxTokens = 2000
  } = options

  const body: any = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  }

  // 如果有工具定义，添加 tools 参数
  if (tools && tools.length > 0) {
    body.tools = tools
  }

  const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${QWEN_API_KEY}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Qwen API Error: ${response.status} - ${error.error?.message || 'Unknown error'}`)
  }

  return response.json()
}

// ----------------------
// 通义千问 流式 API（支持图片）
// ----------------------
export async function* qwenChatCompletionStream(
  messages: QwenMessage[],
  options: ChatOptions = {}
): AsyncGenerator<string> {
  const {
    model = 'qwen-vl-max',
    temperature = 0.7
  } = options

  const body: any = {
    model,
    messages,
    temperature,
    stream: true
  }

  const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${QWEN_API_KEY}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Qwen API Error: ${response.status} - ${error.error?.message || 'Unknown error'}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') return

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) yield content
          } catch {}
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
