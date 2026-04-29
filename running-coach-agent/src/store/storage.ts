// ============================================
// LocalStorage Storage Manager - 本地存储管理
// ============================================

import type { UserProfile, RunningRecord, TrainingPlan, Goal, UserPreferences } from '@/models/types'

const STORAGE_KEYS = {
  USER_PROFILE: 'running_coach_user_profile',
  RUNNING_RECORDS: 'running_coach_records',
  TRAINING_PLANS: 'running_coach_plans',
  GOALS: 'running_coach_goals',
  PREFERENCES: 'running_coach_preferences',
  SESSION_MEMORY: 'running_coach_session'
} as const

// ----------------------
// 通用存储操作
// ----------------------
function getItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch (e) {
    console.warn(`Storage get error for ${key}:`, e)
    return defaultValue
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn(`Storage set error for ${key}:`, e)
    // 处理存储满的情况
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error('LocalStorage quota exceeded, consider clearing old data')
    }
  }
}

function removeItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.warn(`Storage remove error for ${key}:`, e)
  }
}

// ----------------------
// 用户资料存储
// ----------------------
export function getUserProfile(): UserProfile | null {
  return getItem<UserProfile | null>(STORAGE_KEYS.USER_PROFILE, null)
}

export function setUserProfile(profile: UserProfile): void {
  setItem(STORAGE_KEYS.USER_PROFILE, profile)
}

export function removeUserProfile(): void {
  removeItem(STORAGE_KEYS.USER_PROFILE)
}

// ----------------------
// 跑步记录存储
// ----------------------
export function getRunningRecords(): RunningRecord[] {
  return getItem<RunningRecord[]>(STORAGE_KEYS.RUNNING_RECORDS, [])
}

export function addRunningRecord(record: RunningRecord): void {
  const records = getRunningRecords()
  records.unshift(record)
  setItem(STORAGE_KEYS.RUNNING_RECORDS, records)
}

export function updateRunningRecord(id: string, updates: Partial<RunningRecord>): void {
  const records = getRunningRecords()
  const index = records.findIndex(r => r.id === id)
  if (index !== -1) {
    records[index] = { ...records[index], ...updates }
    setItem(STORAGE_KEYS.RUNNING_RECORDS, records)
  }
}

export function deleteRunningRecord(id: string): void {
  const records = getRunningRecords()
  const filtered = records.filter(r => r.id !== id)
  setItem(STORAGE_KEYS.RUNNING_RECORDS, filtered)
}

export function clearRunningRecords(): void {
  removeItem(STORAGE_KEYS.RUNNING_RECORDS)
}

// ----------------------
// 训练计划存储
// ----------------------
export function getTrainingPlans(): TrainingPlan[] {
  return getItem<TrainingPlan[]>(STORAGE_KEYS.TRAINING_PLANS, [])
}

export function getActivePlan(): TrainingPlan | null {
  const plans = getTrainingPlans()
  return plans.find(p => p.status === 'active') || null
}

export function addTrainingPlan(plan: TrainingPlan): void {
  const plans = getTrainingPlans()
  // 如果有新计划设为 active，先把其他 active 改为 archived
  if (plan.status === 'active') {
    plans.forEach(p => {
      if (p.status === 'active') p.status = 'archived'
    })
  }
  plans.unshift(plan)
  setItem(STORAGE_KEYS.TRAINING_PLANS, plans)
}

export function updateTrainingPlan(id: string, updates: Partial<TrainingPlan>): void {
  const plans = getTrainingPlans()
  const index = plans.findIndex(p => p.id === id)
  if (index !== -1) {
    plans[index] = { ...plans[index], ...updates }
    setItem(STORAGE_KEYS.TRAINING_PLANS, plans)
  }
}

export function deleteTrainingPlan(id: string): void {
  const plans = getTrainingPlans()
  const filtered = plans.filter(p => p.id !== id)
  setItem(STORAGE_KEYS.TRAINING_PLANS, filtered)
}

export function clearTrainingPlans(): void {
  removeItem(STORAGE_KEYS.TRAINING_PLANS)
}

// ----------------------
// 目标存储
// ----------------------
export function getGoals(): Goal[] {
  return getItem<Goal[]>(STORAGE_KEYS.GOALS, [])
}

export function addGoal(goal: Goal): void {
  const goals = getGoals()
  goals.unshift(goal)
  setItem(STORAGE_KEYS.GOALS, goals)
}

export function updateGoal(id: string, updates: Partial<Goal>): void {
  const goals = getGoals()
  const index = goals.findIndex(g => g.id === id)
  if (index !== -1) {
    goals[index] = { ...goals[index], ...updates }
    setItem(STORAGE_KEYS.GOALS, goals)
  }
}

export function deleteGoal(id: string): void {
  const goals = getGoals()
  const filtered = goals.filter(g => g.id !== id)
  setItem(STORAGE_KEYS.GOALS, filtered)
}

// ----------------------
// 用户偏好存储
// ----------------------
export function getUserPreferences(): UserPreferences {
  return getItem<UserPreferences>(STORAGE_KEYS.PREFERENCES, {
    preferredPace: '',
    availableDays: ['六', '日'],
    injuryHistory: [],
    preferredTrainingStyle: 'balanced'
  })
}

export function setUserPreferences(preferences: UserPreferences): void {
  setItem(STORAGE_KEYS.PREFERENCES, preferences)
}

// ----------------------
// 会话记忆存储（用于恢复对话上下文）
// ----------------------
export function getSessionMemory(): any[] {
  return getItem<any[]>(STORAGE_KEYS.SESSION_MEMORY, [])
}

export function setSessionMemory(messages: any[]): void {
  // 限制存储大小，只保留最近 50 条消息
  const trimmed = messages.slice(-50)
  setItem(STORAGE_KEYS.SESSION_MEMORY, trimmed)
}

export function clearSessionMemory(): void {
  removeItem(STORAGE_KEYS.SESSION_MEMORY)
}

// ----------------------
// 数据统计
// ----------------------
export interface StorageStats {
  recordsCount: number
  plansCount: number
  goalsCount: number
  storageUsed: string
}

export function getStorageStats(): StorageStats {
  let totalSize = 0
  const keys = Object.values(STORAGE_KEYS)
  
  for (const key of keys) {
    const item = localStorage.getItem(key)
    if (item) {
      totalSize += item.length + key.length
    }
  }

  return {
    recordsCount: getRunningRecords().length,
    plansCount: getTrainingPlans().length,
    goalsCount: getGoals().length,
    storageUsed: formatBytes(totalSize)
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// ----------------------
// 清除所有数据
// ----------------------
export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach(key => removeItem(key))
}
