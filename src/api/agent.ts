// ============================================
// Agent API - DeepSeek API 调用
// ============================================

export const DEEPSEEK_API_KEY = 'sk-a551054c8b714b30ba51885a0a74ac06'
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

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

// ----------------------
// 生成快捷问题
// ----------------------
const QUICK_QUESTIONS_PROMPT = `你是一个跑步教练助手。请根据用户可能的跑步需求，生成4个不同的快捷问题，用于快速提问。

要求：
1. 问题要简短（15字以内）
2. 问题要多样化，覆盖训练计划、数据分析、跑步知识、健康建议等不同方面
3. 不要重复相同类型的问题
4. 只输出问题，用换行分隔，不要编号，不要其他说明

示例：
如何制定训练计划
我最近配速下降了什么原因
跑步时呼吸急促怎么办
半马训练需要多久`

export async function generateQuickQuestions(): Promise<string[]> {
  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: QUICK_QUESTIONS_PROMPT }
        ],
        temperature: 0.9,
        max_tokens: 200
      })
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    // 解析问题（按换行分割，去除空白字符）
    const questions = content
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0 && q.length <= 30)
      .slice(0, 4)

    // 如果解析失败，返回默认值
    if (questions.length < 4) {
      return getDefaultQuickQuestions()
    }

    return questions
  } catch (error) {
    console.error('生成快捷问题失败:', error)
    return getDefaultQuickQuestions()
  }
}

function getDefaultQuickQuestions(): string[] {
  return [
    '制定一个半马训练计划',
    '分析我的跑步数据',
    '跑步时膝盖疼怎么办',
    '如何提高配速'
  ]
}
