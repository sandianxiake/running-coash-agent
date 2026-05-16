// ============================================
// Coze Workflow API - 调用扣子工作流识别跑步数据
// ============================================

// 扣子工作流配置
const COZE_WORKFLOW_ID = '7639997536598278163'
const COZE_API_URL = 'https://api.coze.cn/v1/workflow/Run'

// 从 localStorage 获取用户 token（需要用户登录扣子）
function getCozeToken(): string {
  return localStorage.getItem('coze_token') || ''
}

// 跑步数据识别结果接口
export interface RunningDataResult {
  date: string
  time: string
  duration: string
  distance: number
  pace: string
  calories: number
  avg_heart_rate: number | null
  steps: number
  avg_step_frequency: number | null
  elevation_gain: number
  elevation_loss: number
}

// 调用扣子工作流识别图片
export async function recognizeRunningData(imageBase64: string): Promise<RunningDataResult | null> {
  const token = getCozeToken()
  
  if (!token) {
    console.error('未配置扣子 Token，请先设置 coze_token')
    return null
  }

  try {
    const response = await fetch(COZE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workflow_id: COZE_WORKFLOW_ID,
        parameters: {
          image: imageBase64
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('扣子 API 请求失败:', response.status, errorData)
      throw new Error(`API 请求失败: ${response.status}`)
    }

    const data = await response.json()
    
    // 解析返回结果
    if (data.code === 0 && data.data) {
      // 工作流返回的数据在 data.output 中
      const output = data.data.output || data.data
      
      // 尝试解析 output 字段（可能是字符串或对象）
      let result: RunningDataResult
      if (typeof output === 'string') {
        result = JSON.parse(output)
      } else {
        result = output
      }
      
      // 转换格式以匹配本地存储的 RunningRecord
      return result
    } else {
      console.error('扣子 API 返回错误:', data.msg || '未知错误')
      return null
    }
  } catch (error) {
    console.error('识别跑步数据失败:', error)
    throw error
  }
}

// 将扣子返回的数据转换为 RunningRecord 格式
export function convertToRunningRecord(result: RunningDataResult) {
  // 解析 duration (HH:MM:SS -> 分钟)
  const parseDuration = (duration: string): number => {
    const parts = duration.split(':')
    if (parts.length === 3) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]) + parseInt(parts[2]) / 60
    } else if (parts.length === 2) {
      return parseInt(parts[0]) + parseInt(parts[1]) / 60
    }
    return 0
  }

  // 解析 pace (6'37''/km -> 分钟)
  const parsePace = (pace: string): string => {
    // 匹配 6'37'' 或 6'37"
    const match = pace.match(/(\d+)'(\d+)''?/)
    if (match) {
      return `${match[1]}:${match[2]}`
    }
    return '0:00'
  }

  const durationMinutes = parseDuration(result.duration)
  
  return {
    id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    distance: result.distance,
    duration: durationMinutes,
    pace: parsePace(result.pace),
    avgHeartRate: result.avg_heart_rate || undefined,
    runningDate: result.date || new Date().toISOString().split('T')[0],
    createdAt: result.time 
      ? `${result.date} ${result.time}` 
      : new Date().toISOString(),
    cadence: result.avg_step_frequency || undefined,
    notes: `通过图片识别导入 | 热量: ${result.calories}千卡 | 步数: ${result.steps} | 爬升: ${result.elevation_gain}米`
  }
}
