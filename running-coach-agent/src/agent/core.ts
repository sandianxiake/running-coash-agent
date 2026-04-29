// ============================================
// Agent Core - 智能体核心（支持流式输出）
// ============================================

import type {
  AgentContext,
  AgentConfig,
  AgentResponse,
  Message,
  ToolCall,
  ToolResult
} from './types'
import { toolRegistry } from './tools'
import { MemoryManager } from './memory'
import { chatCompletion, chatCompletionStream, type Message as ApiMessage } from '@/api/agent'

// 默认系统提示词
const DEFAULT_SYSTEM_PROMPT = `你是「跑步教练」，一个专业、耐心、科学的 AI 跑步教练。

## 你的能力
1. **专业跑步知识**：掌握跑步训练、运动生理、营养补给、伤痛预防等专业知识，可以搜索最新网络资源
2. **个性化指导**：根据用户的年龄、体能、目标制定专属训练计划
3. **数据分析**：分析跑步数据，提供配速、心率、训练负荷等分析建议
4. **目标追踪**：帮助用户设定和达成跑步目标

## 你的原则
- 科学第一：所有建议基于运动科学，不夸大效果
- 安全优先：提醒用户注意运动安全，避免过度训练
- 循序渐进：强调"慢慢来"的训练哲学
- 鼓励为主：用积极的方式激励用户

## 工作方式
当用户提出问题时：
1. 先理解用户的意图和需求
2. 必要时调用工具获取相关信息（如跑步记录、知识库）
3. 结合上下文给出专业、个性化的回答
4. 回答要简洁有条理，使用表情符号增加可读性

## 记住
- 你是教练，不是销售，不要推销任何产品
- 尊重用户的隐私和时间
- 如果不确定某事，坦诚告知，不要瞎编
- 可以使用网络搜索获取最新的跑步资讯和科学知识`

// ----------------------
// 智能体核心
// ----------------------
export class RunningCoachAgent {
  private context: AgentContext
  private memory: MemoryManager

  constructor(config: Partial<AgentConfig> = {}) {
    const fullConfig: AgentConfig = {
      model: 'qwen-plus',
      temperature: 0.7,
      maxIterations: 5,
      enableRAG: true,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      ...config
    }

    this.memory = new MemoryManager()
    
    this.context = {
      userId: 'default_user',
      sessionId: `session_${Date.now()}`,
      memory: this.memory,
      tools: [],
      config: fullConfig
    }

    // 注册所有工具
    this.registerTools()
  }

  // 注册工具
  private registerTools(): void {
    import('./tools').then(({ 
      ragTool, 
      recordsTool, 
      addRecordTool, 
      analyzeRecordsTool,
      generatePlanTool,
      getPlanTool,
      completeWorkoutTool,
      getUserProfileTool,
      updateUserProfileTool,
      assessAbilityTool
    }) => {
      toolRegistry.registerAll([
        ragTool,
        recordsTool,
        addRecordTool,
        analyzeRecordsTool,
        generatePlanTool,
        getPlanTool,
        completeWorkoutTool,
        getUserProfileTool,
        updateUserProfileTool,
        assessAbilityTool
      ])
      
      this.context.tools = toolRegistry.getAll()
    })
  }

  // 获取上下文中的工具
  getTools() {
    return toolRegistry.getAll()
  }

  // 构建 API 消息
  private buildMessages(): ApiMessage[] {
    const messages: ApiMessage[] = []
    
    // 添加系统提示词
    messages.push({
      role: 'system',
      content: this.context.config.systemPrompt || DEFAULT_SYSTEM_PROMPT
    })
    
    // 添加记忆中的对话历史
    const history = this.context.memory.shortTerm.getConversation()
    for (const msg of history) {
      if (msg.role !== 'system') {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })
      }
    }
    
    return messages
  }

  // 处理用户消息（普通模式）
  async process(userMessage: string): Promise<AgentResponse> {
    const toolCalls: ToolCall[] = []
    const toolResults: ToolResult[] = []

    // 1. 添加用户消息到记忆
    const userMsg: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    }
    this.context.memory.shortTerm.add(userMsg)

    try {
      // 2. 构建 API 消息
      const messages = this.buildMessages()

      // 3. 调用 LLM（带工具调用）
      const response = await chatCompletion(
        messages,
        toolRegistry.getFunctionDefinitions(),
        {
          model: this.context.config.model,
          temperature: this.context.config.temperature
        }
      )

      const choice = response.choices[0]
      const assistantMessage = choice.message

      // 检查是否有工具调用
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // 执行工具调用
        const calls = assistantMessage.tool_calls.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        }))
        toolCalls.push(...calls)

        // 执行工具
        for (const call of calls) {
          const result = await toolRegistry.execute(call.name, call.arguments, this.context)
          toolResults.push({
            toolCallId: call.id,
            success: result.success,
            result: result.data,
            error: result.error
          })
        }

        // 添加工具调用到消息历史
        messages.push({
          role: 'assistant' as const,
          content: assistantMessage.content || ''
        })
        
        // 添加工具结果
        for (const tr of toolResults) {
          messages.push({
            role: 'tool',
            content: JSON.stringify(tr.result || { error: tr.error })
          })
        }

        // 再次调用 LLM 获取最终回复
        const finalResponse = await chatCompletion(
          messages,
          undefined,
          {
            model: this.context.config.model,
            temperature: this.context.config.temperature
          }
        )

        const finalMessage = finalResponse.choices[0].message
        
        const responseMsg: Message = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: finalMessage.content || '',
          timestamp: Date.now(),
          toolCalls,
          toolResults
        }
        
        this.context.memory.shortTerm.add(responseMsg)

        return {
          message: responseMsg,
          toolCalls,
          toolResults,
          iterations: 1,
          success: true
        }
      }

      // 无工具调用，直接返回
      const responseMsg: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: assistantMessage.content || '',
        timestamp: Date.now()
      }
      
      this.context.memory.shortTerm.add(responseMsg)

      return {
        message: responseMsg,
        toolCalls: [],
        toolResults: [],
        iterations: 0,
        success: true
      }
    } catch (error: any) {
      console.error('Agent process error:', error)
      return {
        message: {
          id: `msg_${Date.now()}_error`,
          role: 'assistant',
          content: `处理消息时出错：${error.message}`,
          timestamp: Date.now()
        },
        toolCalls,
        toolResults,
        iterations: 0,
        success: false,
        error: error.message
      }
    }
  }

  // 处理用户消息（流式模式）
  async *processStream(userMessage: string): AsyncGenerator<{
    type: 'content' | 'tool_call' | 'tool_result' | 'done' | 'error';
    data: any;
  }> {
    const toolCalls: ToolCall[] = []
    const toolResults: ToolResult[] = []

    // 1. 添加用户消息到记忆
    const userMsg: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    }
    this.context.memory.shortTerm.add(userMsg)

    try {
      // 2. 构建 API 消息
      const messages = this.buildMessages()

      // 3. 流式调用 LLM
      let fullContent = ''

      for await (const chunk of chatCompletionStream(
        messages,
        toolRegistry.getFunctionDefinitions(),
        {
          model: this.context.config.model,
          temperature: this.context.config.temperature
        }
      )) {
        fullContent += chunk
        yield {
          type: 'content',
          data: chunk
        }
      }

      // 检查是否有工具调用（需要解析完整的 assistant 消息）
      // 由于流式返回无法直接获取 tool_calls，需要重新调用
      const response = await chatCompletion(
        messages,
        toolRegistry.getFunctionDefinitions(),
        {
          model: this.context.config.model,
          temperature: this.context.config.temperature
        }
      )

      const choice = response.choices[0]
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        const calls = choice.message.tool_calls.map((tc: any) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        }))
        toolCalls.push(...calls)

        yield {
          type: 'tool_call',
          data: calls
        }

        // 执行工具
        for (const call of calls) {
          const result = await toolRegistry.execute(call.name, call.arguments, this.context)
          const toolResult: ToolResult = {
            toolCallId: call.id,
            success: result.success,
            result: result.data,
            error: result.error
          }
          toolResults.push(toolResult)

          yield {
            type: 'tool_result',
            data: {
              toolName: call.name,
              result: result.data
            }
          }
        }

        // 添加工具调用到消息历史
        messages.push({
          role: 'assistant' as const,
          content: fullContent || ''
        })
        
        // 添加工具结果
        for (const tr of toolResults) {
          messages.push({
            role: 'tool',
            content: JSON.stringify(tr.result || { error: tr.error })
          })
        }

        // 再次调用 LLM 获取最终回复（流式）
        let finalContent = ''
        for await (const chunk of chatCompletionStream(
          messages,
          [],
          {
            model: this.context.config.model,
            temperature: this.context.config.temperature
          }
        )) {
          finalContent += chunk
          yield {
            type: 'content',
            data: chunk
          }
        }

        const responseMsg: Message = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: finalContent,
          timestamp: Date.now(),
          toolCalls,
          toolResults
        }
        
        this.context.memory.shortTerm.add(responseMsg)
      } else {
        // 无工具调用
        const responseMsg: Message = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: fullContent,
          timestamp: Date.now()
        }
        
        this.context.memory.shortTerm.add(responseMsg)
      }

      yield {
        type: 'done',
        data: {
          toolCalls,
          toolResults,
          success: true
        }
      }
    } catch (error: any) {
      console.error('Agent stream process error:', error)
      yield {
        type: 'error',
        data: error.message
      }
    }
  }

  // 清空对话历史
  clearHistory(): void {
    this.context.memory.shortTerm.clear()
  }
}

// ----------------------
// 单例导出
// ----------------------
let agentInstance: RunningCoachAgent | null = null

export function getAgent(): RunningCoachAgent {
  if (!agentInstance) {
    agentInstance = new RunningCoachAgent()
  }
  return agentInstance
}
