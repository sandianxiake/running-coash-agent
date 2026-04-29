// ============================================
// Tool Registry - 工具注册与执行系统
// ============================================

import type { Tool, ToolExecutionResult, AgentContext } from './types'

// 工具注册表
class ToolRegistry {
  private tools: Map<string, Tool> = new Map()

  // 注册工具
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} already registered, overwriting...`)
    }
    this.tools.set(tool.name, tool)
  }

  // 批量注册
  registerAll(tools: Tool[]): void {
    tools.forEach(tool => this.register(tool))
  }

  // 获取工具
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  // 获取所有工具
  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  // 获取工具的 Function Calling 格式
  getFunctionDefinitions(): any[] {
    return this.getAll().map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }))
  }

  // 执行工具
  async execute(
    name: string, 
    args: Record<string, any>, 
    context: AgentContext
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name)
    
    if (!tool) {
      return {
        success: false,
        error: `Tool ${name} not found`
      }
    }

    try {
      // 参数验证
      if (tool.parameters.required) {
        for (const required of tool.parameters.required) {
          if (args[required] === undefined) {
            return {
              success: false,
              error: `Missing required parameter: ${required}`
            }
          }
        }
      }

      const result = await tool.execute(args, context)
      return result
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Tool execution failed'
      }
    }
  }

  // 批量执行工具调用
  async executeAll(
    calls: Array<{ name: string; arguments: Record<string, any> }>,
    context: AgentContext
  ): Promise<ToolExecutionResult[]> {
    return Promise.all(
      calls.map(call => this.execute(call.name, call.arguments, context))
    )
  }
}

// 全局工具注册表
export const toolRegistry = new ToolRegistry()
