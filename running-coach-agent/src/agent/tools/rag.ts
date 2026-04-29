// ============================================
// 知识检索工具 - RAG Tool
// ============================================

import type { Tool, AgentContext, ToolExecutionResult } from '../types'

// 模拟跑步知识库
const RUNNING_KNOWLEDGE = [
  {
    topic: '跑步姿势',
    content: '正确的跑步姿势包括：身体略微前倾，头部保持正直，目视前方。手臂弯曲约90度，随着步伐自然摆动。脚掌中部着地，避免脚跟先着地的冲击。步幅不宜过大，保持舒适的节奏。'
  },
  {
    topic: '热身准备',
    content: '跑步前的热身非常重要：1. 慢走2-3分钟 2. 动态拉伸（腿部摆动、踢臀、高抬腿等）3. 关节活动（踝关节、膝关节、髋关节）热身时间建议5-10分钟，以身体微微发热为准。'
  },
  {
    topic: '跑后恢复',
    content: '跑后恢复同样重要：1. 慢走或轻松慢跑5分钟，让心率逐渐恢复 2. 静态拉伸，重点关注腿部肌肉 3. 补充水分和电解质 4. 及时补充碳水化合物和蛋白质 5. 保证充足睡眠，建议7-9小时。'
  },
  {
    topic: '训练计划',
    content: '科学的跑步训练应包括：1. 有氧基础跑（低强度，长时间）2. 间歇跑（高强度，短时间）3. 节奏跑（中等到高强度）4. 长跑（慢速，长距离）5. 休息日或交叉训练。建议遵循10%规则，每周跑量增幅不超过10%。'
  },
  {
    topic: '心率训练',
    content: '根据心率划分训练强度：1. 热身区（50-60%最大心率）2. 燃脂区（60-70%最大心率）3. 有氧耐力区（70-80%最大心率）4. 乳酸阈值区（80-90%最大心率）5. 无氧区（90-100%最大心率）。最大心率约等于220减去年龄。'
  },
  {
    topic: '跑步伤痛',
    content: '常见跑步伤痛及应对：1. 跑步膝（髂胫束综合症）：休息、冰敷、加强臀部肌肉 2. 足底筋膜炎：拉伸足底、滚动冰冻水瓶 3. 小腿酸痛：拉伸、冰敷、减少跑量 4. 黑指甲：选择合适跑鞋、减慢下坡速度。如疼痛持续，请及时就医。'
  },
  {
    topic: '补给策略',
    content: '跑步补给原则：1. 1小时以内的跑步一般不需要额外补给 2. 超过1小时建议每30分钟补充碳水化合物 3. 长距离跑步需要电解质补充 4. 比赛前2-4小时进食易消化碳水化合物 5. 比赛中少量多次补水，避免一次性大量饮水。'
  },
  {
    topic: '马拉松准备',
    content: '马拉松备战建议：1. 系统训练至少16-20周 2. 赛前2-3周开始减量 3. 赛前一周保持充足睡眠 4. 比赛日提前2-3小时起床 5. 前5公里控制速度，留有余地 6. 撞墙期（30-35公里）是正常现象，要有心理准备。'
  }
]

// 简单向量检索
function retrieveKnowledge(query: string, topK: number = 3): string[] {
  const queryLower = query.toLowerCase()
  const scores: Array<{ topic: string; content: string; score: number }> = []
  
  for (const item of RUNNING_KNOWLEDGE) {
    let score = 0
    const words = queryLower.split(/\s+/)
    
    for (const word of words) {
      if (item.topic.toLowerCase().includes(word)) score += 3
      if (item.content.toLowerCase().includes(word)) score += 1
    }
    
    if (score > 0) {
      scores.push({ ...item, score })
    }
  }
  
  // 返回得分最高的结果
  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => `[${item.topic}]: ${item.content}`)
}

export const ragTool: Tool = {
  name: 'search_knowledge',
  description: '搜索跑步相关的专业知识库。适用于回答跑步训练、姿势、恢复、补给等问题。当用户询问跑步技巧、训练方法、运动知识时使用。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '用户的问题或关键词，例如："跑步时如何控制心率"、"马拉松赛前如何准备"'
      },
      top_k: {
        type: 'number',
        description: '返回最相关的知识条目数量，默认3条'
      }
    },
    required: ['query']
  },
  execute: async (args, context): Promise<ToolExecutionResult> => {
    const { query, top_k = 3 } = args
    const results = retrieveKnowledge(query, top_k)
    
    return {
      success: true,
      data: {
        query,
        results,
        total: results.length
      }
    }
  }
}
