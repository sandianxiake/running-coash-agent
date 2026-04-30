// ============================================
// Memory System - 记忆系统
// ============================================

import type { 
  Memory, 
  ShortTermMemory, 
  LongTermMemory, 
  Message
} from './types'
import type {
  UserProfile,
  RunningRecord,
  TrainingPlan,
  Goal,
  UserPreferences
} from '@/models/types'

// ----------------------
// 短期记忆（对话上下文）- 支持 localStorage 持久化
// ----------------------
const SESSION_STORAGE_KEY = 'running_coach_conversation'

class ShortTermMemoryStore implements ShortTermMemory {
  messages: Message[] = []
  maxSize: number

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize
    this.loadFromStorage()
  }

  // 从 localStorage 加载对话历史
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY)
      if (stored) {
        this.messages = JSON.parse(stored)
      }
    } catch (e) {
      console.warn('Failed to load conversation from storage:', e)
      this.messages = []
    }
  }

  // 保存到 localStorage
  private saveToStorage(): void {
    try {
      // 只保存非系统消息
      const conversation = this.messages.filter(m => m.role !== 'system')
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(conversation))
    } catch (e) {
      console.warn('Failed to save conversation to storage:', e)
    }
  }

  // 添加消息
  add(message: Message): void {
    this.messages.push(message)
    
    // 超过上限时，保留系统消息和最近的对话
    if (this.messages.length > this.maxSize) {
      const systemMessages = this.messages.filter(m => m.role === 'system')
      const otherMessages = this.messages.filter(m => m.role !== 'system')
      
      // 保留最新的消息
      const keptMessages = otherMessages.slice(-(this.maxSize - systemMessages.length))
      this.messages = [...systemMessages, ...keptMessages]
    }
    
    // 保存到 localStorage
    this.saveToStorage()
  }

  // 获取最近 N 条消息
  getRecent(count: number): Message[] {
    return this.messages.slice(-count)
  }

  // 获取对话历史（不含系统消息）
  getConversation(): Message[] {
    return this.messages.filter(m => m.role !== 'system')
  }

  // 清除所有消息
  clear(): void {
    const systemMessages = this.messages.filter(m => m.role === 'system')
    this.messages = systemMessages
    // 清除 localStorage
    localStorage.removeItem(SESSION_STORAGE_KEY)
  }

  // 更新消息
  updateMessage(id: string, updates: Partial<Message>): void {
    const index = this.messages.findIndex(m => m.id === id)
    if (index !== -1) {
      this.messages[index] = { ...this.messages[index], ...updates }
    }
  }
}

// ----------------------
// 长期记忆（用户数据）
// ----------------------
class LongTermMemoryStore implements LongTermMemory {
  userProfile: UserProfile | null = null
  runningRecords: RunningRecord[] = []
  trainingPlans: TrainingPlan[] = []
  goals: Goal[] = []
  preferences: UserPreferences

  constructor() {
    this.preferences = {
      preferredPace: '',
      availableDays: ['六', '日'],
      injuryHistory: [],
      preferredTrainingStyle: 'balanced'
    }
  }

  // 更新用户资料
  updateProfile(profile: UserProfile): void {
    this.userProfile = profile
    this.updatePreferencesFromProfile(profile)
  }

  // 从用户资料更新偏好
  private updatePreferencesFromProfile(profile: UserProfile): void {
    if (profile.abilityTags) {
      // 根据能力标签设置训练风格偏好
      if (profile.abilityTags.includes('初学者')) {
        this.preferences.preferredTrainingStyle = 'gradual'
      } else if (profile.abilityTags.includes('进阶')) {
        this.preferences.preferredTrainingStyle = 'intense'
      }
    }
  }

  // 添加跑步记录
  addRecord(record: RunningRecord): void {
    this.runningRecords.unshift(record)
    // 只保留最近 100 条
    if (this.runningRecords.length > 100) {
      this.runningRecords = this.runningRecords.slice(0, 100)
    }
    // 更新偏好（分析跑步数据）
    this.updatePreferencesFromRecords()
  }

  // 从记录更新偏好
  private updatePreferencesFromRecords(): void {
    if (this.runningRecords.length === 0) return
    
    // 计算平均配速
    const avgPace = this.runningRecords.reduce((sum, r) => {
      const [min, sec] = r.pace.split(':').map(Number)
      return sum + min + sec / 60
    }, 0) / this.runningRecords.length
    
    const paceMin = Math.floor(avgPace)
    const paceSec = Math.round((avgPace % 1) * 60)
    this.preferences.preferredPace = `${paceMin}:${String(paceSec).padStart(2, '0')}`
  }

  // 添加训练计划
  addPlan(plan: TrainingPlan): void {
    // 将其他计划标记为非活跃
    this.trainingPlans.forEach(p => p.status = 'archived')
    this.trainingPlans.unshift(plan)
  }

  // 设置目标
  setGoal(goal: Goal): void {
    const existingIndex = this.goals.findIndex(g => g.id === goal.id)
    if (existingIndex !== -1) {
      this.goals[existingIndex] = goal
    } else {
      this.goals.unshift(goal)
    }
  }

  // 获取活跃目标
  getActiveGoals(): Goal[] {
    return this.goals.filter(g => g.progress < 100)
  }

  // 序列化（用于持久化）
  serialize(): string {
    return JSON.stringify({
      userProfile: this.userProfile,
      runningRecords: this.runningRecords,
      trainingPlans: this.trainingPlans,
      goals: this.goals,
      preferences: this.preferences
    })
  }

  // 反序列化（从持久化恢复）
  deserialize(data: string): void {
    try {
      const parsed = JSON.parse(data)
      this.userProfile = parsed.userProfile || null
      this.runningRecords = parsed.runningRecords || []
      this.trainingPlans = parsed.trainingPlans || []
      this.goals = parsed.goals || []
      this.preferences = { ...this.preferences, ...parsed.preferences }
    } catch (e) {
      console.error('Failed to deserialize memory:', e)
    }
  }
}

// ----------------------
// 统一记忆管理器
// ----------------------
export class MemoryManager implements Memory {
  shortTerm: ShortTermMemoryStore
  longTerm: LongTermMemoryStore

  constructor(shortTermMaxSize: number = 20) {
    this.shortTerm = new ShortTermMemoryStore(shortTermMaxSize)
    this.longTerm = new LongTermMemoryStore()
  }

  // 获取上下文摘要（用于 LLM 调用）
  getContextSummary(): string {
    const parts: string[] = []
    
    // 用户信息
    if (this.longTerm.userProfile) {
      const p = this.longTerm.userProfile
      parts.push(`用户信息：${p.nickname}，${p.age}岁${p.gender}，${p.height}cm/${p.weight}kg`)
    }
    
    // 最近跑步
    if (this.longTerm.runningRecords.length > 0) {
      const recent = this.longTerm.runningRecords.slice(0, 3)
      parts.push(`最近跑步：${recent.map(r => `${r.distance}km/${r.pace}`).join('、')}`)
    }
    
    // 当前目标
    const activeGoals = this.longTerm.getActiveGoals()
    if (activeGoals.length > 0) {
      parts.push(`当前目标：${activeGoals.map(g => g.target).join('、')}`)
    }
    
    // 训练计划
    const activePlan = this.longTerm.trainingPlans.find(p => p.status === 'active')
    if (activePlan) {
      parts.push(`训练计划：第${activePlan.currentWeek}/${activePlan.totalWeeks}周，${activePlan.target}`)
    }
    
    return parts.join('\n')
  }

  // 获取对话历史（用于 API 调用）
  getConversationForAPI(): Array<{ role: string; content: string }> {
    return this.shortTerm.getConversation().map(m => ({
      role: m.role,
      content: m.content
    }))
  }

  // 清除短期记忆（保留长期）
  clearShortTerm(): void {
    this.shortTerm.clear()
  }

  // 保存到本地存储
  save(): void {
    localStorage.setItem('agent_memory_longterm', this.longTerm.serialize())
  }

  // 从本地存储恢复
  load(): void {
    const data = localStorage.getItem('agent_memory_longterm')
    if (data) {
      this.longTerm.deserialize(data)
    }
  }
}

// 导出默认实例
export const memoryManager = new MemoryManager()
