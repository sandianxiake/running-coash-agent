// ============================================
// 跑步记录工具 - 使用 localStorage 持久化
// ============================================

import type { Tool, ToolExecutionResult } from '../types'
import type { RunningRecord } from '@/models/types'
import { 
  getRunningRecords, 
  addRunningRecord as storageAddRecord
} from '@/store/storage'

export const recordsTool: Tool = {
  name: 'get_running_records',
  description: '获取用户的跑步历史记录。返回按时间倒序排列的所有跑步记录，包含距离、配速、心率、感受等信息。',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: '返回记录数量，默认返回最近10条'
      }
    }
  },
  execute: async (args): Promise<ToolExecutionResult> => {
    const { limit = 10 } = args
    const allRecords = getRunningRecords()
    const records = allRecords.slice(0, limit)
    
    return {
      success: true,
      data: {
        records,
        total: allRecords.length
      }
    }
  }
}

export const addRecordTool: Tool = {
  name: 'add_running_record',
  description: '添加一条新的跑步记录。当用户提供跑步数据时使用，记录距离、时间、配速、心率、步频、步幅、跑步感受等信息。如果用户没有提供步频和步幅，可以根据配速和跑步经验估算一个合理值。',
  parameters: {
    type: 'object',
    properties: {
      distance: {
        type: 'number',
        description: '跑步距离（公里）'
      },
      duration: {
        type: 'number',
        description: '跑步时长（分钟）'
      },
      pace: {
        type: 'string',
        description: '平均配速，格式如 "5:30"（分钟:秒）'
      },
      avgHeartRate: {
        type: 'number',
        description: '平均心率（次/分钟）'
      },
      feeling: {
        type: 'string',
        description: '跑步感受，如"很轻松"、"有点累"、"非常累"'
      },
      weather: {
        type: 'string',
        description: '天气情况，如"晴"、"阴"、"小雨"'
      },
      notes: {
        type: 'string',
        description: '备注说明（可选）'
      },
      runningDate: {
        type: 'string',
        description: '跑步的实际日期，格式YYYY-MM-DD，如 "2024-05-04"（可选，默认使用今天）'
      },
      cadence: {
        type: 'number',
        description: '平均步频（步/分钟），如180'
      },
      stride: {
        type: 'number',
        description: '平均步幅（厘米）'
      }
    },
    required: ['distance', 'duration', 'pace']
  },
  execute: async (args): Promise<ToolExecutionResult> => {
    const newRecord: RunningRecord = {
      id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      distance: args.distance,
      duration: args.duration,
      pace: args.pace,
      avgHeartRate: args.avgHeartRate,
      feeling: args.feeling || '一般',
      weather: args.weather,
      notes: args.notes,
      runningDate: args.runningDate || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      cadence: args.cadence,
      stride: args.stride
    }
    
    storageAddRecord(newRecord)
    
    // 格式化时长为 xx小时xx分钟xx秒
    const formatDuration = (minutes: number) => {
      const totalSeconds = Math.round(minutes * 60)
      const hours = Math.floor(totalSeconds / 3600)
      const mins = Math.floor((totalSeconds % 3600) / 60)
      const secs = totalSeconds % 60
      return `${hours}时${mins}分${secs}秒`
    }
    
    return {
      success: true,
      data: {
        record: newRecord,
        message: `跑步记录已添加：${args.distance}公里，用时${formatDuration(args.duration)}`
      }
    }
  }
}

export const analyzeRecordsTool: Tool = {
  name: 'analyze_running_records',
  description: '分析用户的跑步记录数据，生成统计摘要。包括周/月跑量、平均配速变化、训练负荷等分析。当用户询问训练数据分析或进度评估时使用。',
  parameters: {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        description: '分析周期，选项：week(本周)、month(本月)、all(全部)',
        enum: ['week', 'month', 'all']
      }
    }
  },
  execute: async (args): Promise<ToolExecutionResult> => {
    const period = args.period || 'all'
    const now = new Date()
    
    let filteredRecords = getRunningRecords()
    
    if (period === 'week') {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      weekStart.setHours(0, 0, 0, 0)
      filteredRecords = filteredRecords.filter(r => new Date(r.createdAt) >= weekStart)
    } else if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      filteredRecords = filteredRecords.filter(r => new Date(r.createdAt) >= monthStart)
    }
    
    if (filteredRecords.length === 0) {
      return {
        success: true,
        data: {
          period,
          message: '暂无跑步记录',
          stats: null
        }
      }
    }
    
    // 计算统计
    const totalDistance = filteredRecords.reduce((sum, r) => sum + r.distance, 0)
    const totalDuration = filteredRecords.reduce((sum, r) => sum + r.duration, 0)
    const avgPace = totalDuration / totalDistance
    const recordsWithHeartRate = filteredRecords.filter(r => r.avgHeartRate)
    const avgHeartRate = recordsWithHeartRate.length > 0
      ? recordsWithHeartRate.reduce((sum, r) => sum + (r.avgHeartRate || 0), 0) / recordsWithHeartRate.length
      : 0
    
    // 计算配速趋势
    const paceValues = filteredRecords.map(r => {
      const [min, sec] = r.pace.split(':').map(Number)
      return min + sec / 60
    })
    
    let paceTrend: '提升' | '下降' | '稳定' | '数据不足' = '数据不足'
    if (paceValues.length >= 2) {
      const recentAvg = paceValues.slice(0, Math.ceil(paceValues.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(paceValues.length / 2)
      const olderAvg = paceValues.slice(Math.ceil(paceValues.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(paceValues.length / 2)
      if (recentAvg < olderAvg - 0.1) paceTrend = '提升'
      else if (recentAvg > olderAvg + 0.1) paceTrend = '下降'
      else paceTrend = '稳定'
    }
    
    // 周跑量趋势（近4周）
    const weeklyStats: { week: string; distance: number; count: number }[] = []
    for (let i = 0; i < 4; i++) {
      const weekEnd = new Date(now)
      weekEnd.setDate(now.getDate() - i * 7)
      const weekStart = new Date(weekEnd)
      weekStart.setDate(weekEnd.getDate() - 7)
      
      const weekRecords = filteredRecords.filter(r => {
        const d = new Date(r.createdAt)
        return d >= weekStart && d < weekEnd
      })
      
      if (weekRecords.length > 0) {
        weeklyStats.unshift({
          week: `第${4 - i}周`,
          distance: Math.round(weekRecords.reduce((sum, r) => sum + r.distance, 0) * 100) / 100,
          count: weekRecords.length
        })
      }
    }
    
    return {
      success: true,
      data: {
        period,
        totalRuns: filteredRecords.length,
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalDuration: Math.round(totalDuration * 10) / 10,
        avgPace: `${Math.floor(avgPace)}:${String(Math.round((avgPace % 1) * 60)).padStart(2, '0')}`,
        avgHeartRate: Math.round(avgHeartRate) || null,
        paceTrend,
        weeklyStats,
        message: `在${period === 'week' ? '本周' : period === 'month' ? '本月' : '所有记录'}内，共跑步${filteredRecords.length}次，总距离${totalDistance.toFixed(1)}公里`
      }
    }
  }
}
