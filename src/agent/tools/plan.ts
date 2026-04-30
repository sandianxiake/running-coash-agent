// ============================================
// 训练计划工具 - 使用 localStorage 持久化
// ============================================

import type { Tool, ToolExecutionResult } from '../types'
import type { TrainingPlan } from '@/models/types'
import {
  getActivePlan,
  addTrainingPlan as storageAddPlan,
  updateTrainingPlan as storageUpdatePlan
} from '@/store/storage'

// 生成每周训练计划
function generateWeeklyPlans(totalWeeks: number, baseMileage: number, daysPerWeek: number) {
  const plans = []
  const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  
  for (let week = 1; week <= totalWeeks; week++) {
    // 遵循 10% 规则，逐渐增加跑量
    const progressFactor = Math.min(week / totalWeeks, 1)
    // 前半程增加，后半程保持或减量（赛前减量）
    const mileage = week <= totalWeeks * 0.7
      ? Math.round(baseMileage * (1 + progressFactor * 0.6) * 10) / 10
      : Math.round(baseMileage * (1.3 - (week - totalWeeks * 0.7) / (totalWeeks * 0.3) * 0.3) * 10) / 10
    
    // 训练类型分配
    const workouts = []
    const usedDays = new Set<number>()
    
    // 长跑日
    const longRunDay = Math.floor(Math.random() * daysPerWeek)
    usedDays.add(longRunDay)
    
    // 间歇训练日
    let intervalDay = (longRunDay + 2) % daysPerWeek
    while (usedDays.has(intervalDay) && usedDays.size < daysPerWeek) {
      intervalDay = (intervalDay + 1) % daysPerWeek
    }
    usedDays.add(intervalDay)
    
    // 节奏跑日
    let tempoDay = (longRunDay + 4) % daysPerWeek
    while (usedDays.has(tempoDay) && usedDays.size < daysPerWeek) {
      tempoDay = (tempoDay + 1) % daysPerWeek
    }
    usedDays.add(tempoDay)
    
    for (let day = 0; day < daysPerWeek; day++) {
      let type: string
      let description: string
      
      if (day === longRunDay) {
        type = 'long_run'
        description = `长跑 ${Math.round(mileage * 0.35)}km，控制在目标配速，注意补给`
      } else if (day === intervalDay) {
        type = 'interval'
        description = '间歇训练：6-8组400m全力跑，组间休息200m慢跑'
      } else if (day === tempoDay) {
        type = 'tempo'
        description = '节奏跑：10分钟热身 + 25分钟目标配速 + 10分钟放松'
      } else {
        type = 'easy'
        description = `轻松跑 ${Math.round(mileage * 0.15)}km，保持可以对话的强度`
      }
      
      workouts.push({
        day: dayNames[day % 7],
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
  execute: async (args): Promise<ToolExecutionResult> => {
    const { 
      target, 
      deadline, 
      currentWeeklyMileage, 
      availableDaysPerWeek = 4 
    } = args
    
    // 计算训练周期
    let weeks: number
    if (deadline) {
      const deadlineDate = new Date(deadline)
      weeks = Math.max(1, Math.ceil((deadlineDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
    } else {
      // 根据目标设定默认周期
      if (target.includes('马拉松') || target.includes('全马')) {
        weeks = 20
      } else if (target.includes('半马')) {
        weeks = 12
      } else {
        weeks = 8
      }
    }
    
    // 生成训练计划
    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + weeks * 7 * 24 * 60 * 60 * 1000)
    
    const plan: TrainingPlan = {
      id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      target,
      startDate: startDate.toISOString().split('T')[0],
      endDate: deadline || endDate.toISOString().split('T')[0],
      totalWeeks: weeks,
      weeklyPlans: generateWeeklyPlans(weeks, currentWeeklyMileage, availableDaysPerWeek),
      currentWeek: 1,
      status: 'active',
      createdAt: new Date().toISOString()
    }
    
    storageAddPlan(plan)
    
    // 生成计划摘要
    const firstWeek = plan.weeklyPlans[0]
    const lastWeek = plan.weeklyPlans[plan.weeklyPlans.length - 1]
    
    return {
      success: true,
      data: {
        plan,
        message: `已生成${weeks}周训练计划！
📌 目标：${target}
📅 时间：${plan.startDate} 至 ${plan.endDate}
📊 跑量：从每周${firstWeek.totalMileage}km逐步增加到${lastWeek.totalMileage}km
🏃 训练安排：每周${availableDaysPerWeek}天，包含长跑、间歇、节奏跑和轻松跑`
      }
    }
  }
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
  execute: async (args): Promise<ToolExecutionResult> => {
    const activePlan = getActivePlan()
    
    if (!activePlan) {
      return {
        success: true,
        data: {
          message: '暂无激活的训练计划。你可以告诉我你的跑步目标和计划完成时间，我会帮你制定训练计划。'
        }
      }
    }
    
    // 计算当前是第几周
    const startDate = new Date(activePlan.startDate)
    const now = new Date()
    const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
    const currentWeek = Math.min(Math.floor(daysSinceStart / 7) + 1, activePlan.totalWeeks)
    
    if (args.week) {
      const weekPlan = activePlan.weeklyPlans.find(w => w.week === args.week)
      if (!weekPlan) {
        return {
          success: true,
          data: {
            message: `没有找到第${args.week}周的训练计划`
          }
        }
      }
      
      const workoutList = weekPlan.workouts.map(w => {
        const status = w.completed ? '✅' : '⬜'
        return `${status} ${w.day}：${w.description}`
      }).join('\n')
      
      return {
        success: true,
        data: {
          week: args.week,
          totalMileage: weekPlan.totalMileage,
          workouts: weekPlan.workouts,
          message: `📅 第${args.week}周训练计划（总里程${weekPlan.totalMileage}km）：\n${workoutList}`
        }
      }
    }
    
    // 返回整个计划摘要
    const completedWeeks = activePlan.weeklyPlans.filter(w => w.week < currentWeek && w.workouts.every(workout => workout.completed)).length
    const currentWeekPlan = activePlan.weeklyPlans.find(w => w.week === currentWeek)
    
    let message = `📋 当前训练计划\n`
    message += `━━━━━━━━━━━━━━━━\n`
    message += `🎯 目标：${activePlan.target}\n`
    message += `📅 周期：第${currentWeek}/${activePlan.totalWeeks}周\n`
    message += `📊 进度：已完成${completedWeeks}周\n`
    
    if (currentWeekPlan) {
      message += `\n📌 本周训练（总里程${currentWeekPlan.totalMileage}km）：\n`
      currentWeekPlan.workouts.forEach(w => {
        const status = w.completed ? '✅' : '⬜'
        message += `${status} ${w.day}：${w.description}\n`
      })
    }
    
    return {
      success: true,
      data: {
        plan: activePlan,
        currentWeek,
        currentWeekPlan,
        completedWeeks,
        message: message.trim()
      }
    }
  }
}

export const completeWorkoutTool: Tool = {
  name: 'complete_workout',
  description: '标记某次训练为完成。当用户完成训练后使用，可以更新本周训练计划的完成状态。',
  parameters: {
    type: 'object',
    properties: {
      week: {
        type: 'number',
        description: '训练所属周次'
      },
      day: {
        type: 'string',
        description: '训练日，如"周一"、"周二"'
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
        description: '训练感受'
      }
    },
    required: ['week', 'day']
  },
  execute: async (args): Promise<ToolExecutionResult> => {
    const { week, day, actualDistance, actualDuration, feeling } = args
    const activePlan = getActivePlan()
    
    if (!activePlan) {
      return {
        success: true,
        data: {
          message: '暂无激活的训练计划'
        }
      }
    }
    
    const weekPlan = activePlan.weeklyPlans.find(w => w.week === week)
    if (!weekPlan) {
      return {
        success: true,
        data: {
          message: `没有找到第${week}周的训练计划`
        }
      }
    }
    
    const workout = weekPlan.workouts.find(w => w.day === day)
    if (!workout) {
      return {
        success: true,
        data: {
          message: `第${week}周${day}没有安排训练`
        }
      }
    }
    
    // 更新训练状态
    workout.completed = true
    if (actualDistance) workout.actualDistance = actualDistance
    if (actualDuration) workout.actualDuration = actualDuration
    if (feeling) workout.feeling = feeling
    
    storageUpdatePlan(activePlan.id, { weeklyPlans: activePlan.weeklyPlans })
    
    // 计算本周完成进度
    const completedCount = weekPlan.workouts.filter(w => w.completed).length
    const totalCount = weekPlan.workouts.length
    const progress = Math.round((completedCount / totalCount) * 100)
    
    return {
      success: true,
      data: {
        week,
        day,
        completed: true,
        progress,
        message: `✅ ${day}训练已记录完成！\n本周进度：${completedCount}/${totalCount} ({progress}%)\n${feeling ? `感受：${feeling}` : ''}`
      }
    }
  }
}
