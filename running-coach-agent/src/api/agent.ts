// ============================================
// Agent API - 通义千问 API 调用
// ============================================

const QWEN_API_KEY = import.meta.env.VITE_QWEN_API_KEY || 'your-api-key'
const QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

export interface ChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
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
    model = 'qwen-plus',
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
    model = 'qwen-plus',
    temperature = 0.7,
    maxTokens = 2000
  } = options

  const body: any = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
    tools
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
