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
import { chatCompletion, chatCompletionStream } from '@/api/agent'
import { reflect, generateReflectionMessage, type ReflectionResult } from './reflection'


// 默认系统提示词
const DEFAULT_SYSTEM_PROMPT = `【最重要】回复规则（必须遵守）：
- 每次回复不超过 30 字
- 先给核心建议（1-2句话）
- 等用户追问，再给详细说明
- 保存数据时：只说"✅ 已保存"

你是「跑步教练」，一个专业、耐心、科学的 AI 跑步教练。

## 你的能力
1. **专业跑步知识**：掌握跑步训练、运动生理、营养补给、伤痛预防等专业知识
2. **个性化指导**：根据用户的年龄、体能、目标制定专属训练计划
3. **数据分析**：分析跑步数据，提供配速、心率、训练负荷等分析建议
4. **目标追踪**：帮助用户设定和达成跑步目标

## 你的原则
- 科学第一：所有建议基于运动科学，不夸大效果
- 安全优先：提醒用户注意运动安全，避免过度训练
- 循序渐进：强调"慢慢来"的训练哲学
- 鼓励为主：用积极的方式激励用户

## 记录跑步数据
当用户提供跑步数据并要求保存时：

**无论数据是否完整**
- → 先询问用户："是否保存这条数据？"
- → 用户肯定回答（如"好的"、"保存"、"是"等）
- → 才调用 add_running_record 工具保存
- → 保存成功后回复"✅ 已保存"

**禁止行为**：
- ❌ 禁止自己编造跑步数据
- ❌ 禁止未经用户确认就保存数据
- ❌ 禁止在没有数据时回复"已保存"

**工具参数格式**：
- distance: 距离（公里）
- duration: 时长（分钟）
- pace: 配速（如"6:15"）
- runningDate: 日期（YYYY-MM-DD）
- avgHeartRate: 心率（次/分钟）
- cadence: 步频（步/分钟）
- stride: 步幅（厘米）

## 知识库使用规则
- 如果你在上一轮回复中已经提供了相关知识
- 则不要再重复显示知识库内容
- 直接基于已有知识给出建议即可

## 记住
- 如果不确定某事，坦诚告知，不要瞎编
- 涉及医疗问题（如伤病）时，建议用户咨询专业医生`

// ----------------------
// 智能体核心
// ----------------------
export class RunningCoachAgent {
  private context: AgentContext
  private memory: MemoryManager

  constructor(config: Partial<AgentConfig> = {}) {
    const fullConfig: AgentConfig = {
      model: 'deepseek-chat',
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
      assessAbilityTool,
      analyzeImageTool,
      saveImageRecordTool
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
        assessAbilityTool,
        analyzeImageTool,
        saveImageRecordTool
      ])
      
      this.context.tools = toolRegistry.getAll()
    })
  }

  // 获取上下文中的工具
  getTools() {
    return toolRegistry.getAll()
  }

  // 构建 API 消息
  private buildMessages(): any[] {
    const messages: any[] = []
    
    // 添加系统提示词
    messages.push({
      role: 'system',
      content: this.context.config.systemPrompt || DEFAULT_SYSTEM_PROMPT
    })
    
    // 添加记忆中的对话历史
    const history = this.context.memory.shortTerm.getConversation()
    for (const msg of history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        // 如果消息包含图片，构建多模态格式
        if (msg.images && msg.images.length > 0 && msg.role === 'user') {
          const content: any[] = [{ type: 'text', text: msg.content || '' }]
          for (const img of msg.images) {
            content.push({ type: 'image_url', image_url: { url: img } })
          }
          messages.push({ role: 'user', content })
        } else {
          messages.push({ role: msg.role, content: msg.content || '' })
        }
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
        console.log('[Agent] 检测到工具调用:', calls)
        toolCalls.push(...calls)

        // 执行工具
        for (const call of calls) {
          console.log('[Agent] 执行工具:', call.name, call.arguments)
          const result = await toolRegistry.execute(call.name, call.arguments, this.context)
          console.log('[Agent] 工具执行结果:', result)
          toolResults.push({
            toolCallId: call.id,
            success: result.success,
            result: result.data,
            error: result.error
          })
        }

        // 添加工具调用到消息历史（必须包含 tool_calls 字段）
        const assistantMsgForHistory: any = {
          role: 'assistant' as const,
          content: assistantMessage.content || ''
        }
        if (assistantMessage.tool_calls) {
          assistantMsgForHistory.tool_calls = assistantMessage.tool_calls
        }
        messages.push(assistantMsgForHistory)
        
        // 添加工具结果
        for (const tr of toolResults) {
          messages.push({
            role: 'tool' as const,
            tool_call_id: tr.toolCallId,
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

        // 自我反思检查
        const reflectionResult = await performReflection(
          userMessage,
          finalMessage.content || '',
          {
            hasUserProfile: this.context.userProfile !== null,
            toolResults: toolResults.map(r => r.success ? r.result?.message?.substring(0, 50) : '')
          }
        )

        // 如果需要纠错，更新回复
        let finalContent = finalMessage.content || ''
        if (reflectionResult.needsCorrection && reflectionResult.correctedResponse) {
          finalContent = reflectionResult.correctedResponse
          responseMsg.content = finalContent
        } else if (reflectionResult.issues.length > 0 && reflectionResult.confidence < 0.6) {
          // 置信度低但不需要完全纠错，追加反思提示
          const reflectionNote = generateReflectionMessage(reflectionResult)
          if (reflectionNote) {
            finalContent += reflectionNote
            responseMsg.content = finalContent
          }
        }

        return {
          message: responseMsg,
          toolCalls,
          toolResults,
          iterations: 1,
          success: true,
          reflection: reflectionResult
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
      const tools = toolRegistry.getFunctionDefinitions()

      // 3. 先用普通模式检查是否需要工具调用
      const response = await chatCompletion(
        messages,
        tools,
        {
          model: this.context.config.model,
          temperature: this.context.config.temperature
        }
      )

      const choice = response.choices[0]
      console.log('[Agent] DeepSeek 响应:', JSON.stringify(response, null, 2))
      
      // 如果有工具调用，使用普通模式（不支持流式）
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        console.log('[Agent] 检测到工具调用:', choice.message.tool_calls)
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

        // 添加工具调用和结果到消息历史
        messages.push({
          role: 'assistant' as const,
          content: '',
          tool_calls: choice.message.tool_calls
        })
        
        for (const tr of toolResults) {
          messages.push({
            role: 'tool' as const,
            tool_call_id: tr.toolCallId,
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
        // 无工具调用，直接流式输出回复
        let fullContent = ''
        for await (const chunk of chatCompletionStream(
          messages,
          [],
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

// ----------------------
// 自我反思辅助函数
// ----------------------
async function performReflection(
  userQuestion: string,
  aiResponse: string,
  context?: {
    hasUserProfile?: boolean
    hasRunningRecords?: boolean
    hasTrainingPlan?: boolean
    toolResults?: string[]
  }
): Promise<ReflectionResult> {
  try {
    return await reflect(userQuestion, aiResponse, context)
  } catch (error) {
    console.error('Reflection error:', error)
    return {
      passed: true,
      issues: [],
      suggestions: [],
      confidence: 0.5,
      needsCorrection: false
    }
  }
}
