// ============================================
// 图片分析工具 - 分析跑步相关图片
// ============================================

import type { Tool, ToolExecutionResult } from '../types'
import { addRunningRecord } from '@/store/storage'

// DeepSeek API 配置
const DEEPSEEK_API_KEY = 'sk-a551054c8b714b30ba51885a0a74ac06'

export const analyzeImageTool: Tool = {
  name: 'analyze_image',
  description: '分析用户上传的跑步相关图片，提取跑步数据。当用户发送跑步手表截图、运动APP数据截图、跑步路线图等图片时使用。可以从图片中提取距离、配速、心率、时间等数据。',
  parameters: {
    type: 'object',
    properties: {
      image_base64: {
        type: 'string',
        description: '图片的 base64 编码数据'
      },
      additional_context: {
        type: 'string',
        description: '用户提供的额外上下文信息，如"这是昨天的跑步"等'
      }
    },
    required: ['image_base64']
  },
  execute: async (args): Promise<ToolExecutionResult> => {
    const { image_base64, additional_context = '' } = args

    try {
      // 调用 DeepSeek API 分析图片
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `你是一个专业的跑步数据分析师。请分析这张图片中的跑步数据。

请从图片中提取以下信息（如果可见）：
1. 距离（公里）
2. 时长（分钟或小时:分钟:秒）
3. 配速（分钟:秒/公里）
4. 平均心率（如果显示）
5. 步频（如果显示）
6. 卡路里/能量消耗（如果显示）
7. 跑步日期（如果显示）

${additional_context ? `用户补充信息：${additional_context}` : ''}

请以 JSON 格式返回分析结果：
{
  "distance": 数字或null,
  "duration": 数字（分钟）或null,
  "pace": "分钟:秒"格式或null,
  "avgHeartRate": 数字或null,
  "cadence": 数字或null,
  "calories": 数字或null,
  "date": "YYYY-MM-DD"格式或null,
  "confidence": "high/medium/low",
  "notes": "备注说明"
}

如果图片中没有跑步相关数据，返回：
{
  "error": "无法从图片中识别跑步数据",
  "confidence": "low",
  "notes": "说明原因"
}

只返回 JSON，不要其他内容。`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${image_base64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.3
        })
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const data = await response.json()
      const analysis = data.choices?.[0]?.message?.content || ''

      // 解析 JSON 结果
      let parsedResult: any
      try {
        // 尝试提取 JSON（可能包含在 markdown 代码块中）
        const jsonMatch = analysis.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, analysis]
        const jsonStr = jsonMatch[1] || analysis
        parsedResult = JSON.parse(jsonStr.trim())
      } catch (e) {
        // 如果 JSON 解析失败，尝试提取关键数据
        parsedResult = {
          error: '解析失败',
          rawResponse: analysis,
          confidence: 'low'
        }
      }

      // 如果识别成功，构建返回消息
      if (parsedResult.distance && !parsedResult.error) {
        const pace = parsedResult.pace || (parsedResult.duration && parsedResult.distance 
          ? `${Math.floor(parsedResult.duration / parsedResult.distance)}:${String(Math.round((parsedResult.duration / parsedResult.distance % 1) * 60)).padStart(2, '0')}`
          : null)
        
        const message = `📊 图片分析完成！

✅ 识别到以下跑步数据：
• 距离：${parsedResult.distance} 公里
• 时长：${parsedResult.duration} 分钟
• 配速：${pace || '未知'}
${parsedResult.avgHeartRate ? `• 平均心率：${parsedResult.avgHeartRate} bpm` : ''}
${parsedResult.cadence ? `• 步频：${parsedResult.cadence} spm` : ''}
${parsedResult.calories ? `• 卡路里：${parsedResult.calories} kcal` : ''}
${parsedResult.date ? `• 日期：${parsedResult.date}` : ''}
${parsedResult.notes ? `• 备注：${parsedResult.notes}` : ''}

📌 识别可信度：${parsedResult.confidence === 'high' ? '高' : parsedResult.confidence === 'medium' ? '中' : '低'}

请问需要我帮你保存这条记录吗？或者有什么其他问题？`

        return {
          success: true,
          data: {
            ...parsedResult,
            message,
            canSave: true,
            saveData: pace ? {
              distance: parsedResult.distance,
              duration: parsedResult.duration,
              pace: pace,
              avgHeartRate: parsedResult.avgHeartRate,
              notes: parsedResult.notes || ''
            } : null
          }
        }
      } else {
        return {
          success: true,
          data: {
            error: parsedResult.error || '无法识别跑步数据',
            confidence: parsedResult.confidence || 'low',
            notes: parsedResult.notes || '请尝试上传更清晰的跑步数据截图',
            message: `抱歉，无法从图片中识别出跑步数据。

可能原因：
• 图片不够清晰
• 不是跑步相关的数据截图
• 数据格式无法识别

💡 建议：
• 请上传跑步手表或APP的截图
• 确保数据清晰可见
• 可以手动告诉我跑步数据，我来帮你记录`
          }
        }
      }
    } catch (error: any) {
      console.error('Image analysis error:', error)
      return {
        success: true,
        data: {
          error: '图片分析失败',
          message: `分析图片时出错：${error.message}。请稍后重试。`
        }
      }
    }
  }
}

export const saveImageRecordTool: Tool = {
  name: 'save_image_record',
  description: '将图片分析得到的跑步数据保存到记录中。当用户确认要保存从图片中识别的跑步数据时使用。',
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
        description: '配速，格式如 "5:30"'
      },
      avgHeartRate: {
        type: 'number',
        description: '平均心率'
      },
      cadence: {
        type: 'number',
        description: '步频'
      },
      calories: {
        type: 'number',
        description: '卡路里'
      },
      notes: {
        type: 'string',
        description: '备注'
      },
      sourceImage: {
        type: 'string',
        description: '图片的 base64 数据（可选，用于关联）'
      }
    },
    required: ['distance', 'duration', 'pace']
  },
  execute: async (args): Promise<ToolExecutionResult> => {
    const { distance, duration, pace, avgHeartRate, cadence, calories, notes, sourceImage } = args

    // 生成配速格式
    let paceStr = pace
    if (typeof pace === 'number') {
      const min = Math.floor(pace)
      const sec = Math.round((pace - min) * 60)
      paceStr = `${min}:${String(sec).padStart(2, '0')}`
    }

    const record = {
      id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      distance,
      duration,
      pace: paceStr,
      avgHeartRate,
      cadence,
      calories,
      notes: notes || '',
      sourceImage: sourceImage ? `data:image/jpeg;base64,${sourceImage}` : undefined,
      createdAt: new Date().toISOString()
    }

    // 保存到 localStorage
    addRunningRecord(record)

    return {
      success: true,
      data: {
        record,
        message: `✅ 跑步记录已保存！

📊 记录详情：
• 距离：${distance} 公里
• 时长：${duration} 分钟
• 配速：${paceStr}/km
${avgHeartRate ? `• 心率：${avgHeartRate} bpm` : ''}
${cadence ? `• 步频：${cadence} spm` : ''}
${calories ? `• 卡路里：${calories} kcal` : ''}
${notes ? `• 备注：${notes}` : ''}

你可以随时查看历史记录或让我分析你的跑步趋势！`
      }
    }
  }
}
