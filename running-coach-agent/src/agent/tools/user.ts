// ============================================
// 用户资料工具
// ============================================

import type { Tool, AgentContext, ToolExecutionResult } from '../types'
import type { UserProfile } from '@/models/types'

// 模拟用户数据
let currentUser: UserProfile | null = null

export const getUserProfileTool: Tool = {
  name: 'get_user_profile',
  description: '获取当前用户的个人信息，包括年龄、性别、体重、跑步能力等。当需要了解用户基本情况来给出个性化建议时使用。',
  parameters: {
    type: 'object',
    properties: {}
  },
  execute: async (args, context): Promise<ToolExecutionResult> => {
    if (!currentUser) {
      return {
        success: true,
        data: {
          message: '用户未完善资料',
          profile: null
        }
      }
    }
    
    return {
      success: true,
      data: {
        profile: currentUser,
        message: `用户：${currentUser.nickname}，${currentUser.age}岁${currentUser.gender}`
      }
    }
  }
}

export const updateUserProfileTool: Tool = {
  name: 'update_user_profile',
  description: '更新用户的个人信息和跑步能力标签。当用户提供个人信息或能力评估时使用。',
  parameters: {
    type: 'object',
    properties: {
      nickname: {
        type: 'string',
        description: '昵称'
      },
      age: {
        type: 'number',
        description: '年龄'
      },
      gender: {
        type: 'string',
        description: '性别：男/女'
      },
      height: {
        type: 'number',
        description: '身高（cm）'
      },
      weight: {
        type: 'number',
        description: '体重（kg）'
      },
      abilityLevel: {
        type: 'string',
        description: '能力水平：初学者/有经验/进阶/精英'
      },
      injuryHistory: {
        type: 'string',
        description: '伤病史（如有）'
      },
      goals: {
        type: 'string',
        description: '跑步目标'
      }
    }
  },
  execute: async (args, context): Promise<ToolExecutionResult> => {
    currentUser = {
      ...currentUser,
      ...args,
      updatedAt: new Date().toISOString()
    } as UserProfile
    
    return {
      success: true,
      data: {
        profile: currentUser,
        message: '用户资料已更新'
      }
    }
  }
}

export const assessAbilityTool: Tool = {
  name: 'assess_running_ability',
  description: '根据用户的跑步数据评估其能力水平。当用户提供近期跑步数据后使用，用于给出个性化的训练建议。',
  parameters: {
    type: 'object',
    properties: {
      recentRuns: {
        type: 'number',
        description: '近期跑步次数'
      },
      avgPace: {
        type: 'string',
        description: '平均配速，格式如"5:30"'
      },
      longestRun: {
        type: 'number',
        description: '最长跑步距离（公里）'
      },
      weeklyMileage: {
        type: 'number',
        description: '周跑量（公里）'
      }
    },
    required: ['recentRuns', 'avgPace']
  },
  execute: async (args, context): Promise<ToolExecutionResult> => {
    const { avgPace, longestRun = 0, weeklyMileage = 0 } = args
    
    // 简单能力评估
    const paceMinutes = parseInt(avgPace.split(':')[0])
    const paceSeconds = parseInt(avgPace.split(':')[1])
    const paceValue = paceMinutes + paceSeconds / 60
    
    let level: string
    let description: string
    
    if (paceValue < 4.5 && longestRun > 30) {
      level = '精英'
      description = '你已经达到了精英跑者的水平，可以尝试冲击更高级别的比赛'
    } else if (paceValue < 5 && longestRun > 21) {
      level = '进阶'
      description = '你是进阶跑者，有良好的有氧基础，可以尝试更高强度的训练'
    } else if (paceValue < 6 && longestRun > 10) {
      level = '有经验'
      description = '你是有经验的跑者，基础扎实，继续保持科学训练'
    } else {
      level = '初学者'
      description = '你是跑步新手，建议从慢跑开始，逐步增加跑量和强度'
    }
    
    return {
      success: true,
      data: {
        abilityLevel: level,
        description,
        recommendations: generateRecommendations(level, { longestRun, weeklyMileage })
      }
    }
  }
}

function generateRecommendations(level: string, data: { longestRun?: number; weeklyMileage?: number }) {
  const recs: string[] = []
  
  switch (level) {
    case '精英':
      recs.push('建议进行个性化周期训练')
      recs.push('可以尝试高原训练提升有氧能力')
      break
    case '进阶':
      recs.push('增加间歇训练的频率')
      recs.push('尝试跑坡训练增强力量')
      if (data.longestRun && data.longestRun < 30) {
        recs.push('建议逐步增加到30km以上的长距离')
      }
      break
    case '有经验':
      recs.push('保持每周训练的一致性')
      recs.push('可以尝试节奏跑提升乳酸阈值')
      if (data.weeklyMileage && data.weeklyMileage < 40) {
        recs.push('周跑量可以逐步提升到40km以上')
      }
      break
    default:
      recs.push('重点是建立跑步习惯')
      recs.push('建议多跑有氧轻松跑，打好有氧基础')
      recs.push('每周至少跑3次，让身体适应')
  }
  
  return recs
}
