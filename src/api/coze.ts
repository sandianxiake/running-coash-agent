// ============================================
// 火山方舟 API - 调用豆包视觉理解模型识别跑步数据
// ============================================

// API 端点 - 火山引擎函数代理
const API_URL = 'https://sd848bm9c18sqnli48l90.apigateway-cn-guangzhou.volceapi.com/api/ark-proxy'

// 豆包视觉理解提示词
const SYSTEM_PROMPT = `你是一个专业的跑步数据提取助手。请从截图中提取以下跑步数据：

## 必须提取的字段
| 字段名 | 说明 | 格式要求 |
|--------|------|----------|
| date | 跑步日期 | YYYY-MM-DD |
| duration | 运动时间 | HH:MM:SS |
| distance | 总距离(公里) | 数字，保留2位小数 |
| pace | 平均配速 | M'S''/km |
| avg_heart_rate | 平均心率(次/分钟) | 纯数字 |
| avg_step_frequency | 平均步频(步/分钟) | 纯数字 |

## 输出要求
1. 如果某字段在图片中找不到，标记为 null
2. 所有数值不要带单位
3. 只返回JSON，不要任何解释

## 输出格式
{
  "date": "",
  "duration": "",
  "distance": 0,
  "pace": "",
  "avg_heart_rate": null,
  "avg_step_frequency": null
}`

// 跑步数据识别结果接口
export interface SimpleRunningData {
  date: string
  duration: string
  distance: number
  pace: string
  avgHeartRate: number | null
  cadence: number | null
}

// 调用火山方舟 API 识别图片
export async function recognizeRunningData(imageBase64: string): Promise<SimpleRunningData | null> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'doubao-seed-2-0-lite-260428',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_image',
                image_url: `data://internal/base64/${imageBase64}`
              },
              {
                type: 'input_text',
                text: SYSTEM_PROMPT
              }
            ]
          }
        ]
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('方舟 API 请求失败:', response.status, errorData)
      throw new Error(`API 请求失败: ${response.status}`)
    }

    const data = await response.json()
    console.log('方舟 API 返回:', data)

    // 解析返回结果
    if (data.output && data.output.text) {
      const content = data.output.text

      // 尝试提取 JSON
      let jsonStr = content
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonStr = jsonMatch[0]
      }

      const raw = JSON.parse(jsonStr)

      return {
        date: raw.date || '',
        duration: raw.duration || '',
        distance: raw.distance || 0,
        pace: raw.pace || '',
        avgHeartRate: raw.avg_heart_rate || null,
        cadence: raw.avg_step_frequency || null
      }
    } else {
      console.error('方舟 API 返回格式错误:', data)
      return null
    }
  } catch (error) {
    console.error('识别跑步数据失败:', error)
    throw error
  }
}

// 将返回的数据转换为 RunningRecord 格式
export function convertToRunningRecord(result: SimpleRunningData) {
  // 解析 duration (HH:MM:SS -> 分钟)
  const parseDuration = (duration: string): number => {
    const parts = duration.split(':')
    if (parts.length === 3) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]) + parseInt(parts[2]) / 60
    }
    return 0
  }

  return {
    date: result.date,
    duration: parseDuration(result.duration),
    distance: result.distance,
    pace: result.pace,
    avgHeartRate: result.avgHeartRate,
    cadence: result.cadence
  }
}
