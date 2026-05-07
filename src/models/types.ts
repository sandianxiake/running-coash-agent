// ============================================
// Types - 共享类型定义
// ============================================

export interface UserProfile {
  phone?: string
  password?: string
  nickname: string
  age: number
  gender: '男' | '女'
  height: number
  weight: number
  abilityTags?: string[]
  goals?: string
  createdAt?: string
  updatedAt?: string
}

export interface RunningRecord {
  id: string
  distance: number      // 公里
  duration: number     // 分钟
  pace: string         // 配速 "5:30"
  avgHeartRate?: number
  maxHeartRate?: number
  feeling?: string
  weather?: string
  notes?: string
  actualDistance?: number
  actualDuration?: number
  runningDate: string  // 跑步的实际日期（YYYY-MM-DD）
  createdAt: string    // 记录创建时间
  cadence?: number     // 平均步频（步/分钟）
  stride?: number       // 平均步幅（厘米）
}

export interface Workout {
  day: string
  type: string
  description: string
  completed?: boolean
  actualDistance?: number
  actualDuration?: number
  feeling?: string
}

export interface WeeklyPlan {
  week: number
  totalMileage: number
  workouts: Workout[]
}

export interface TrainingPlan {
  id: string
  target: string
  startDate: string
  endDate: string
  totalWeeks: number
  weeklyPlans: WeeklyPlan[]
  currentWeek: number
  status: 'active' | 'paused' | 'completed' | 'archived'
  createdAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface RacePrediction {
  halfMarathon: string
  fullMarathon: string
  paceRange: {
    easy: string
    tempo: string
    interval: string
  }
  recommendations: string[]
}

// ----------------------
// 额外类型（供 Agent 使用）
// ----------------------

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
