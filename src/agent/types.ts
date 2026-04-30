// ============================================
// Agent Core Types - 智能体核心类型定义
// ============================================

import type { UserProfile, RunningRecord, TrainingPlan } from '@/models/types'

// ----------------------
// 消息与对话
// ----------------------
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  images?: string[]  // base64 图片数据
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

export interface ToolResult {
  toolCallId: string
  success: boolean
  result?: any
  error?: string
}

// ----------------------
// 工具系统
// ----------------------
export interface Tool {
  name: string
  description: string
  parameters: ToolParameterSchema
  execute: (args: Record<string, any>, context: AgentContext) => Promise<ToolExecutionResult>
}

export interface ToolParameterSchema {
  type: 'object'
  properties: Record<string, ToolParameterProperty>
  required?: string[]
}

export interface ToolParameterProperty {
  type: string
  description: string
  enum?: string[]
}

export interface ToolExecutionResult {
  success: boolean
  data?: any
  error?: string
}

// ----------------------
// 记忆系统
// ----------------------
export interface Memory {
  // 短期记忆：当前对话
  shortTerm: ShortTermMemory
  // 长期记忆：用户画像和历史
  longTerm: LongTermMemory
}

export interface ShortTermMemory {
  messages: Message[]
  maxSize: number
  add(message: Message): void
  getRecent(count: number): Message[]
  getConversation(): Message[]
  clear(): void
}

export interface LongTermMemory {
  userProfile: UserProfile | null
  runningRecords: RunningRecord[]
  trainingPlans: TrainingPlan[]
  goals: Goal[]
  preferences: UserPreferences
}

export interface Goal {
  id: string
  type: 'race' | 'weight' | 'mileage' | 'custom'
  target: string
  deadline?: string
  progress: number
  createdAt: string
}

export interface UserPreferences {
  preferredPace: string
  availableDays: string[]
  injuryHistory: string[]
  preferredTrainingStyle: string
}

// ----------------------
// 智能体上下文
// ----------------------
export interface AgentContext {
  userId: string
  sessionId: string
  memory: Memory
  tools: Tool[]
  config: AgentConfig
}

export interface AgentConfig {
  model: string
  temperature: number
  maxIterations: number
  enableRAG: boolean
  systemPrompt?: string
}

// ----------------------
// 规划系统
// ----------------------
export interface Task {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  dependencies: string[]
  result?: any
  error?: string
}

export interface Plan {
  id: string
  goal: string
  tasks: Task[]
  status: 'planning' | 'executing' | 'completed' | 'failed'
  createdAt: number
}

// ----------------------
// Agent 执行结果
// ----------------------
export interface AgentResponse {
  message: Message
  plan?: Plan
  toolCalls: ToolCall[]
  toolResults: ToolResult[]
  iterations: number
  success: boolean
  error?: string
}
