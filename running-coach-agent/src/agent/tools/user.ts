// ============================================
// 用户资料工具 - 使用 localStorage 持久化
// ============================================

import type { Tool, ToolExecutionResult } from '../types'
import type { UserProfile } from '@/models/types'
import { 
  getUserProfile, 
  setUserProfile,
  getUserPreferences,
  setUserPreferences 
} from '@/store/storage'

export const getUserProfileTool: Tool = {
  name: 'get_user_profile',
  description: '获取当前用户的个人信息，包括年龄、性别、体重、跑步能力等。当需要了解用户基本情况来给出个性化建议时使用。',
  parameters: {
    type: 'object',
    properties: {}
  },
  execute: async (): Promise<ToolExecutionResult> => {
    const profile = getUserProfile()
    
    if (!profile) {
      return {
        success: true,
        data: {
          message: '用户未完善资料',
          profile: null,
          suggestion: '请告诉我你的基本信息，例如：年龄、性别、跑步经验等'
        }
      }
    }
    
    const preferences = getUserPreferences()
    
    // 计算 BMI
    let bmi = 0
    let bmiStatus = ''
    if (profile.height && profile.weight) {
      const heightM = profile.height / 100
      bmi = profile.weight / (heightM * heightM)
      if (bmi < 18.5) bmiStatus = '偏瘦'
      else if (bmi < 24) bmiStatus = '正常'
      else if (bmi < 28) bmiStatus = '偏胖'
      else bmiStatus = '肥胖'
    }
    
    const abilityLevel = profile.abilityTags?.[0] || '未评估'
    
    return {
      success: true,
      data: {
        profile,
        preferences,
        bmi: Math.round(bmi * 10) / 10,
        bmiStatus,
        abilityLevel,
        message: `用户资料：
👤 ${profile.nickname || '跑友'}，${profile.age || '?'}岁${profile.gender || ''}
📏 身高${profile.height || '?'}cm，体重${profile.weight || '?'}kg（BMI ${bmi ? bmi.toFixed(1) : '?'}，${bmiStatus}）
🏃 能力水平：${abilityLevel}
${profile.abilityTags?.length ? `🏷️ 标签：${profile.abilityTags.join('、')}` : ''}
${profile.goals ? `🎯 目标：${profile.goals}` : ''}`
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
    },
    required: []
  },
  execute: async (args): Promise<ToolExecutionResult> => {
    const existingProfile = getUserProfile()
    const now = new Date().toISOString()
    
    // 处理能力标签
    let abilityTags: string[] = existingProfile?.abilityTags || []
    if (args.abilityLevel) {
      abilityTags = abilityTags.filter(t => !['初学者', '有经验', '进阶', '精英'].includes(t))
      abilityTags.push(args.abilityLevel)
    }
    
    const updatedProfile: UserProfile = {
      nickname: args.nickname || existingProfile?.nickname || '跑友',
      age: args.age || existingProfile?.age || 0,
      gender: args.gender || existingProfile?.gender || '男',
      height: args.height ?? existingProfile?.height,
      weight: args.weight ?? existingProfile?.weight,
      abilityTags,
      goals: args.goals || existingProfile?.goals,
      phone: existingProfile?.phone,
      password: existingProfile?.password,
      createdAt: existingProfile?.createdAt || now,
      updatedAt: now
    }
    
    setUserProfile(updatedProfile)
    
    // 根据能力水平更新训练偏好
    const preferences = getUserPreferences()
    if (args.abilityLevel) {
      if (args.abilityLevel === '初学者') {
        preferences.preferredTrainingStyle = 'gradual'
      } else if (args.abilityLevel === '有经验') {
        preferences.preferredTrainingStyle = 'balanced'
      } else if (args.abilityLevel === '进阶') {
        preferences.preferredTrainingStyle = 'intense'
      } else if (args.abilityLevel === '精英') {
        preferences.preferredTrainingStyle = 'competition'
      }
      setUserPreferences(preferences)
    }
    
    return {
      success: true,
      data: {
        profile: updatedProfile,
        message: `用户资料已更新！
👤 ${updatedProfile.nickname}
📅 ${updatedProfile.age}岁${updatedProfile.gender}
${updatedProfile.height && updatedProfile.weight ? `📏 身高${updatedProfile.height}cm，体重${updatedProfile.weight}kg` : ''}
${abilityTags.length ? `🏃 能力：${abilityTags.join('、')}` : ''}
${updatedProfile.goals ? `🎯 目标：${updatedProfile.goals}` : ''}`
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
  execute: async (args): Promise<ToolExecutionResult> => {
    const { recentRuns, avgPace, longestRun = 0, weeklyMileage = 0 } = args
    
    // 解析配速
    const paceParts = avgPace.split(':')
    const paceMinutes = parseInt(paceParts[0])
    const paceSeconds = parseInt(paceParts[1])
    const paceValue = paceMinutes + paceSeconds / 60
    
    // 能力评估逻辑
    let level: string
    let description: string
    let suggestions: string[]
    let trainingFocus: string
    
    if (paceValue < 4 && longestRun >= 30 && weeklyMileage >= 100) {
      level = '精英'
      description = '你已经达到了精英跑者的水平，马拉松成绩应该在330以内'
      suggestions = [
        '系统化周期训练，冲刺更高目标',
        '加入速度训练，提升冲刺能力',
        '注重恢复和营养，避免过度训练'
      ]
      trainingFocus = '精细化配速控制、高强度间歇、比赛策略'
    } else if (paceValue < 5 && longestRun >= 21) {
      level = '进阶'
      description = '你是进阶跑者，具备良好的有氧基础，可以挑战更高强度的训练'
      suggestions = [
        '增加间歇训练频次，提升速度耐力',
        '尝试跑坡训练，增强腿部力量',
        '开始系统备战半马/全马'
      ]
      trainingFocus = '间歇训练、配速稳定、长距离拉练'
    } else if (paceValue < 6 && longestRun >= 10 && recentRuns >= 10) {
      level = '有经验'
      description = '你是有经验的跑者，基础扎实，继续保持科学训练'
      suggestions = [
        '保持每周稳定跑量，不要突然增加',
        '每月加入1-2次长跑',
        '注意跑后恢复和拉伸'
      ]
      trainingFocus = '有氧基础维持、轻松跑为主、偶尔强度'
    } else if (paceValue < 7 && longestRun >= 5) {
      level = '初学者'
      description = '你是跑步新手，建议从慢跑开始，逐步增加跑量和强度'
      suggestions = [
        '不要太在意配速，以能说话为准',
        '从跑一休一开始，给身体适应时间',
        '每次跑后做好拉伸放松'
      ]
      trainingFocus = '建立习惯、轻松跑为主、逐步加量'
    } else {
      level = '入门'
      description = '刚开始跑步，建议先培养运动习惯，不要急于追求速度'
      suggestions = [
        '从快走开始，逐渐过渡到慢跑',
        '每次运动20-30分钟即可',
        '重点是坚持，不是跑多快'
      ]
      trainingFocus = '培养习惯、逐步适应、享受跑步'
    }
    
    // 更新用户能力标签
    const profile = getUserProfile()
    if (profile) {
      const abilityTags = profile.abilityTags?.filter(t => !['初学者', '有经验', '进阶', '精英', '入门'].includes(t)) || []
      abilityTags.unshift(level)
      setUserProfile({ ...profile, abilityTags })
    }
    
    return {
      success: true,
      data: {
        abilityLevel: level,
        description,
        suggestions,
        trainingFocus,
        stats: {
          avgPace,
          longestRun,
          weeklyMileage,
          recentRuns
        },
        message: `🏃 能力评估结果：${level}

📊 数据分析：
• 平均配速：${avgPace}/km
• 最长距离：${longestRun}km
• 周跑量：${weeklyMileage}km
• 近期跑步：${recentRuns}次

💡 ${description}

🎯 训练重点：${trainingFocus}

📋 建议：
${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      }
    }
  }
}
