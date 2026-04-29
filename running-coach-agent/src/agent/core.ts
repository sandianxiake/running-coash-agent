// ============================================
// Agent Core - 智能体核心
// ============================================

import type {
  AgentContext,
  AgentConfig,
  AgentResponse,
  Message,
  ToolCall,
  ToolResult,
  Plan,
  Task
} from './types'
import { toolRegistry } from './tools'
import { MemoryManager } from './memory'
import { chatCompletion } from '@/api/agent'

// 默认系统提示词
const DEFAULT_SYSTEM_PROMPT = `你是「跑步教练」，一个专业、耐心、科学的 AI 跑步教练。

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

## 工作方式
当用户提出问题时：
1. 先理解用户的意图和需求
2. 必要时调用工具获取相关信息（如跑步记录、知识库）
3. 结合上下文给出专业、个性化的回答
4. 回答要简洁有条理，避免长篇大论

## 记住
- 你是教练，不是销售，不要推销任何产品
- 尊重用户的隐私和时间
- 如果不确定某事，坦诚告知，不要瞎编`

// ----------------------
// 任务规划器
// ----------------------
class TaskPlanner {
  private plans: Map<string, Plan> = new Map()

  // 创建计划
  createPlan(goal: string, tasks: string[]): Plan {
    const plan: Plan = {
      id: `plan_${Date.now()}`,
      goal,
      tasks: tasks.map((desc, i) => ({
        id: `task_${i}`,
        description: desc,
        status: 'pending',
        dependencies: []
      })),
      status: 'planning',
      createdAt: Date.now()
    }
    
    this.plans.set(plan.id, plan)
    return plan
  }

  // 获取计划
  getPlan(id: string): Plan | undefined {
    return this.plans.get(id)
  }

  // 执行下一个任务
  getNextTask(planId: string): Task | undefined {
    const plan = this.plans.get(planId)
    if (!plan) return undefined

    return plan.tasks.find(t => 
      t.status === 'pending' && 
      t.dependencies.every(depId => {
        const dep = plan.tasks.find(task => task.id === depId)
        return dep?.status === 'completed'
      })
    )
  }

  // 更新任务状态
  updateTask(planId: string, taskId: string, updates: Partial<Task>): void {
    const plan = this.plans.get(planId)
    if (!plan) return

    const task = plan.tasks.find(t => t.id === taskId)
    if (task) {
      Object.assign(task, updates)
    }
  }

  // 检查计划是否完成
  isPlanComplete(planId: string): boolean {
    const plan = this.plans.get(planId)
    if (!plan) return false

    return plan.tasks.every(t => t.status === 'completed' || t.status === 'failed')
  }
}

// ----------------------
// 智能体核心
// ----------------------
export class RunningCoachAgent {
  private context: AgentContext
  private planner: TaskPlanner
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
    this.planner = new TaskPlanner()
    
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
    // 动态导入所有工具
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

  // 处理用户消息
  async process(userMessage: string): Promise<AgentResponse> {
    const iterations: number = 0
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

      // 4. 解析响应
      const choice = response.choices[0]
      const assistantMessage = choice.message

      // 检查是否有工具调用
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // 执行工具调用
        for (const toolCall of assistantMessage.tool_calls) {
          const tc: ToolCall = {
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments)
          }
          toolCalls.push(tc)

          const result = await toolRegistry.execute(
            tc.name,
            tc.arguments,
            this.context
          )

          toolResults.push({
            toolCallId: tc.id,
            success: result.success,
            result: result.data,
            error: result.error
          })

          // 将工具结果添加到对话
          this.context.memory.shortTerm.add({
            id: `msg_${Date.now()}_tool`,
            role: 'tool',
            content: result.success 
              ? JSON.stringify(result.data) 
              : `Error: ${result.error}`,
            timestamp: Date.now(),
            toolCalls: [tc],
            toolResults: [toolResults[toolResults.length - 1]]
          })
        }

        // 5. 再次调用 LLM 生成最终回复
        const finalMessages = this.buildMessages()
        const finalResponse = await chatCompletion(
          finalMessages,
          undefined, // 第二次不传工具
          {
            model: this.context.config.model,
            temperature: this.context.config.temperature
          }
        )

        const finalContent = finalResponse.choices[0].message.content

        // 添加助手回复到记忆
        const assistantMsg: Message = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: finalContent || '',
          timestamp: Date.now()
        }
        this.context.memory.shortTerm.add(assistantMsg)

        return {
          message: assistantMsg,
          toolCalls,
          toolResults,
          iterations: 1,
          success: true
        }
      }

      // 无工具调用，直接返回文本回复
      const content = assistantMessage.content || ''

      const assistantMsg: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content,
        timestamp: Date.now()
      }
      this.context.memory.shortTerm.add(assistantMsg)

      return {
        message: assistantMsg,
        toolCalls: [],
        toolResults: [],
        iterations: 0,
        success: true
      }

    } catch (error: any) {
      return {
        message: {
          id: `msg_${Date.now()}_error`,
          role: 'assistant',
          content: `抱歉，我遇到了一些问题：${error.message}。请稍后再试。`,
          timestamp: Date.now()
        },
        toolCalls,
        toolResults,
        iterations,
        success: false,
        error: error.message
      }
    }
  }

  // 构建消息列表
  private buildMessages(): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = []

    // 系统消息
    let systemContent = this.context.config.systemPrompt || DEFAULT_SYSTEM_PROMPT
    
    // 添加上下文摘要
    const contextSummary = this.context.memory.getContextSummary()
    if (contextSummary) {
      systemContent += `\n\n## 当前上下文\n${contextSummary}`
    }
    
    messages.push({ role: 'system', content: systemContent })

    // 对话历史
    const conversation = this.context.memory.shortTerm.getConversation()
    messages.push(...conversation.map(m => ({
      role: m.role,
      content: m.content
    })))

    return messages
  }

  // 获取对话历史
  getHistory(): Message[] {
    return this.context.memory.shortTerm.getConversation()
  }

  // 清除对话
  clearHistory(): void {
    this.context.memory.shortTerm.clear()
  }

  // 设置用户资料
  setUserProfile(profile: any): void {
    this.context.memory.longTerm.updateProfile(profile)
    this.context.memory.save()
  }
}

// ----------------------
// 导出默认实例
// ----------------------
let agentInstance: RunningCoachAgent | null = null

export function getAgent(): RunningCoachAgent {
  if (!agentInstance) {
    agentInstance = new RunningCoachAgent()
  }
  return agentInstance
}
