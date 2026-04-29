// ============================================
// 训练计划工具
// ============================================

import type { Tool, AgentContext, ToolExecutionResult } from '../types'
import type { TrainingPlan } from '@/models/types'

// 模拟训练计划存储
const plansStore: TrainingPlan[] = []

export const generatePlanTool: Tool = {
  name: 'generate_training_plan',
  description: '根据用户的目标和当前能力，生成科学的跑步训练计划。当用户提供目标（如参加马拉松、减肥、提高配速等）和时间框架时使用。',
  parameters: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description: '训练目标，如"参加全程马拉松"、"半马破2小时"、"减重5公斤"'
      },
      deadline: {
        type: 'string',
        description: '目标日期，格式YYYY-MM-DD'
      },
      currentWeeklyMileage: {
        type: 'number',
        description: '当前每周跑量（公里）'
      },
      currentLongestRun: {
        type: 'number',
        description: '当前最长跑步距离（公里）'
      },
      avgPace: {
        type: 'string',
        description: '当前平均配速，格式如"5:30"'
      },
      availableDaysPerWeek: {
        type: 'number',
        description: '每周可跑步的天数'
      }
    },
    required: ['target', 'currentWeeklyMileage']
  },
  execute: async (args, context): Promise<ToolExecutionResult> => {
    const { target, deadline, currentWeeklyMileage, currentLongestRun, avgPace, availableDaysPerWeek = 4 } = args
    
    // 计算训练周期
    const weeks = deadline 
      ? Math.ceil((new Date(deadline).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
      : 12
    
    // 简单的训练计划生成
    const plan: TrainingPlan = {
      id: Date.now().toString(),
      target,
      startDate: new Date().toISOString().split('T')[0],
      endDate: deadline || new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalWeeks: weeks,
      weeklyPlans: generateWeeklyPlans(weeks, currentWeeklyMileage, availableDaysPerWeek, target),
      currentWeek: 1,
      status: 'active',
      createdAt: new Date().toISOString()
    }
    
    plansStore.unshift(plan)
    
    return {
      success: true,
      data: {
        plan,
        message: `已生成${weeks}周训练计划，目标是${target}`
      }
    }
  }
}

function generateWeeklyPlans(totalWeeks: number, baseMileage: number, daysPerWeek: number, target: string) {
  const plans = []
  
  for (let week = 1; week <= totalWeeks; week++) {
    // 逐渐增加跑量（遵循10%规则）
    const progressFactor = Math.min(week / totalWeeks, 1)
    const mileage = Math.round(baseMileage * (1 + progressFactor * 0.5) * 10) / 10
    
    // 训练类型分配
    const longRunDay = daysPerWeek === 1 ? 0 : Math.floor(Math.random() * (daysPerWeek - 1))
    
    const workouts = []
    for (let day = 0; day < daysPerWeek; day++) {
      let type: string
      let description: string
      
      if (day === longRunDay) {
        type = 'long_run'
        description = `长跑 ${Math.round(mileage * 0.4)}km，控制在目标配速`
      } else if (day === (longRunDay + 1) % daysPerWeek) {
        type = 'interval'
        description = '间歇训练：8x400m 全力，休息200m'
      } else if (day === (longRunDay + 2) % daysPerWeek) {
        type = 'tempo'
        description = '节奏跑：20分钟热身 + 30分钟目标配速 + 10分钟放松'
      } else {
        type = 'easy'
        description = `轻松跑 ${Math.round(mileage * 0.2)}km，保持可以对话的强度`
      }
      
      workouts.push({
        day: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][day],
        type,
        description,
        completed: false
      })
    }
    
    plans.push({
      week,
      totalMileage: mileage,
      workouts
    })
  }
  
  return plans
}

export const getPlanTool: Tool = {
  name: 'get_training_plan',
  description: '获取当前激活的训练计划及其详情。当用户询问训练计划或需要查看本周训练安排时使用。',
  parameters: {
    type: 'object',
    properties: {
      week: {
        type: 'number',
        description: '查看特定周的训练计划，不传则返回整个计划'
      }
    }
  },
  execute: async (args, context): Promise<ToolExecutionResult> => {
    const activePlan = plansStore.find(p => p.status === 'active')
    
    if (!activePlan) {
      return {
        success: true,
        data: {
          message: '暂无激活的训练计划'
        }
      }
    }
    
    if (args.week) {
      const weekPlan = activePlan.weeklyPlans.find(w => w.week === args.week)
      return {
        success: true,
        data: {
          plan: activePlan,
          weekPlan
        }
      }
    }
    
    return {
      success: true,
      data: {
        plan: activePlan,
        message: `当前训练计划：${activePlan.target}，第${activePlan.currentWeek}/${activePlan.totalWeeks}周`
      }
    }
  }
}

export const completeWorkoutTool: Tool = {
  name: 'complete_workout',
  description: '标记某次训练为已完成，并记录实际完成的感受和数据。当用户完成训练后使用。',
  parameters: {
    type: 'object',
    properties: {
      week: {
        type: 'number',
        description: '第几周'
      },
      day: {
        type: 'string',
        description: '训练日，如"周三"'
      },
      actualDistance: {
        type: 'number',
        description: '实际完成的距离（公里）'
      },
      actualDuration: {
        type: 'number',
        description: '实际用时（分钟）'
      },
      feeling: {
        type: 'string',
        description: '完成感受'
      }
    },
    required: ['week', 'day']
  },
  execute: async (args, context): Promise<ToolExecutionResult> => {
    const activePlan = plansStore.find(p => p.status === 'active')
    
    if (!activePlan) {
      return {
        success: false,
        error: '没有激活的训练计划'
      }
    }
    
    const weekPlan = activePlan.weeklyPlans.find(w => w.week === args.week)
    if (!weekPlan) {
      return {
        success: false,
        error: `第${args.week}周的计划不存在`
      }
    }
    
    const workout = weekPlan.workouts.find(w => w.day === args.day)
    if (!workout) {
      return {
        success: false,
        error: `${args.day}没有安排的训练`
      }
    }
    
    workout.completed = true
    if (args.actualDistance) workout.actualDistance = args.actualDistance
    if (args.actualDuration) workout.actualDuration = args.actualDuration
    if (args.feeling) workout.feeling = args.feeling
    
    return {
      success: true,
      data: {
        message: `${args.day}的训练已完成`,
        workout
      }
    }
  }
}
