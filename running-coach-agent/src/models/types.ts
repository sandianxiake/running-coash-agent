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
  createdAt: string
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
