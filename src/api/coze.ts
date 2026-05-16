// ============================================
// Coze Workflow API - 调用扣子工作流识别跑步数据
// ============================================

// 扣子工作流配置
const COZE_WORKFLOW_ID = '7639997536598278163'

// API 端点 - 火山引擎函数代理
const API_URL = 'https://sd848bm9c18sqnli48l90.apigateway-cn-guangzhou.volceapi.com/api/coze-proxy'

// 从环境变量获取扣子 Token
function getCozeToken(): string {
  // 优先使用环境变量
  const envToken = import.meta.env.VITE_COZE_TOKEN
  if (envToken && envToken !== 'pat_xxxxxxxxxxxx') {
    return envToken
  }
  // 兼容 localStorage（开发时使用）
  return localStorage.getItem('coze_token') || 'cztei_hYMIns5fCJMVN8NLrSButZCmqWhYSbA8UnLFGu2ZhWGxeTlMvVDYjte8DxzU8uLG9'
}

// 调用扣子工作流识别图片
// 跑步数据识别结果接口
export interface SimpleRunningData {
  date: string
  duration: string
  distance: number
  pace: string
  avgHeartRate: number | null
  cadence: number | null
}

export async function recognizeRunningData(imageBase64: string): Promise<SimpleRunningData | null> {
  const token = getCozeToken()
  
  if (!token) {
    console.error('未配置扣子 Token')
    return null
  }

  try {
    const response = await fetch(API_URL, {
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
      const output = data.data.output || data.data
      
      let raw: any
      if (typeof output === 'string') {
        raw = JSON.parse(output)
      } else {
        raw = output
      }
      
      // 只提取需要的字段
      return {
        date: raw.date || '',
        duration: raw.duration || '',
        distance: raw.distance || 0,
        pace: raw.pace || '',
        avgHeartRate: raw.avg_heart_rate || null,
        cadence: raw.avg_step_frequency || null
      }
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
export function convertToRunningRecord(result: SimpleRunningData) {
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
    avgHeartRate: result.avgHeartRate || undefined,
    runningDate: result.date || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    cadence: result.cadence || undefined,
    notes: '通过图片识别导入'
  }
}
