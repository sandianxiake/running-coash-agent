// ============================================
// 跑步记录工具
// ============================================

import type { Tool, AgentContext, ToolExecutionResult } from '../types'
import type { RunningRecord } from '@/models/types'

// 模拟数据存储
const recordsStore: RunningRecord[] = []

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
  execute: async (args, context): Promise<ToolExecutionResult> => {
    const { limit = 10 } = args
    const records = recordsStore.slice(0, limit)
    
    return {
      success: true,
      data: {
        records,
        total: recordsStore.length
      }
    }
  }
}

export const addRecordTool: Tool = {
  name: 'add_running_record',
  description: '添加一条新的跑步记录。当用户提供跑步数据时使用，记录距离、时间、配速、心率、跑步感受等信息。',
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
      }
    },
    required: ['distance', 'duration', 'pace']
  },
  execute: async (args, context): Promise<ToolExecutionResult> => {
    const newRecord: RunningRecord = {
      id: Date.now().toString(),
      distance: args.distance,
      duration: args.duration,
      pace: args.pace,
      avgHeartRate: args.avgHeartRate,
      feeling: args.feeling || '一般',
      weather: args.weather,
      notes: args.notes,
      createdAt: new Date().toISOString()
    }
    
    recordsStore.unshift(newRecord)
    
    return {
      success: true,
      data: {
        record: newRecord,
        message: '跑步记录已添加'
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
  execute: async (args, context): Promise<ToolExecutionResult> => {
    const period = args.period || 'all'
    const now = new Date()
    
    let filteredRecords = recordsStore
    
    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      filteredRecords = recordsStore.filter(r => new Date(r.createdAt) >= weekAgo)
    } else if (period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      filteredRecords = recordsStore.filter(r => new Date(r.createdAt) >= monthAgo)
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
    const avgHeartRate = filteredRecords.reduce((sum, r) => sum + (r.avgHeartRate || 0), 0) / filteredRecords.length
    
    // 配速变化（简化版）
    const paceTrend = filteredRecords.length >= 2 
      ? (filteredRecords[0].pace < filteredRecords[filteredRecords.length - 1].pace ? '提升' : '稳定')
      : '数据不足'
    
    return {
      success: true,
      data: {
        period,
        totalRuns: filteredRecords.length,
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalDuration: Math.round(totalDuration * 10) / 10,
        avgPace: `${Math.floor(avgPace)}:${String(Math.round((avgPace % 1) * 60)).padStart(2, '0')}`,
        avgHeartRate: Math.round(avgHeartRate),
        paceTrend,
        message: `在${period === 'week' ? '本周' : period === 'month' ? '本月' : '所有记录'}内，共跑步${filteredRecords.length}次，总距离${totalDistance.toFixed(1)}公里`
      }
    }
  }
}
