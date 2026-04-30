// ============================================
// Agent API - DeepSeek API 调用
// ============================================

const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || 'your-api-key'
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

export interface ChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

// DeepSeek 支持的文本内容
export interface TextContent {
  type: 'text'
  text: string
}

// DeepSeek 支持的图片内容
export interface ImageUrlContent {
  type: 'image_url'
  image_url: {
    url: string
  }
}

// DeepSeek 消息内容类型
export type MessageContent = string | (TextContent | ImageUrlContent)[]

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: MessageContent
  name?: string          // tool 消息中的 name 字段
  tool_call_id?: string  // DeepSeek API 要求
  tool_calls?: any[]      // assistant 消息中的工具调用
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ChatCompletionResponse {
  id: string
  choices: Array<{
    message: {
      role: string
      content: string | null
      tool_calls?: ToolCall[]
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
// LLM API 调用
// ----------------------
export async function chatCompletion(
  messages: Message[],
  tools?: any[],
  options: ChatOptions = {}
): Promise<ChatCompletionResponse> {
  const {
    model = 'deepseek-chat',
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

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`API Error: ${response.status} - ${error.error?.message || 'Unknown error'}`)
  }

  return response.json()
}

// ----------------------
// 流式 API 调用
// ----------------------
export async function* chatCompletionStream(
  messages: Message[],
  tools: any[],
  options: ChatOptions = {}
): AsyncGenerator<string> {
  const {
    model = 'deepseek-chat',
    temperature = 0.7,
    maxTokens = 2000
  } = options

  const body: any = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true
  }

  // 如果有工具定义，添加 tools 参数
  if (tools && tools.length > 0) {
    body.tools = tools
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') return
        
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            yield content
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
}
