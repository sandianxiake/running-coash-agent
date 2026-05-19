// ============================================
// Web Search Service - 增强版 RAG 搜索服务
// 支持：关键词匹配 + DeepSeek Embedding 语义检索
// ============================================

// DeepSeek API 配置
const DEEPSEEK_API_KEY = 'sk-a551054c8b714b30ba51885a0a74ac06'
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

// DeepSeek API 配置
const EMBEDDING_MODEL = 'deepseek-chat'
const EMBEDDING_DIM = 1536  // DeepSeek embedding 维度

// 内置跑步知识库（精简版，约35个主题）
const RUNNING_KNOWLEDGE = [
  // === 基础篇 ===
  {
    id: 1,
    topic: '跑步姿势',
    keywords: ['姿势', '跑姿', '步态', '落地', '前倾', '摆臂'],
    content: `跑步姿势要点：
• 身体略微前倾，保持挺直
• 手臂弯曲约90度，自然摆动
• 脚掌中部着地，避免脚跟重击
• 步频建议170-180步/分钟`
  },
  {
    id: 2,
    topic: '热身准备',
    keywords: ['热身', '准备', '拉伸', '活动', '动态', '关节'],
    content: `跑步前热身（5-10分钟）：
• 慢走2-3分钟，身体微微发热
• 动态拉伸：腿部摆动、踢臀、高抬腿
• 轻松跑3-5分钟过渡`
  },
  {
    id: 3,
    topic: '跑后恢复',
    keywords: ['恢复', '放松', '拉伸', '休息', '冷身', '按摩'],
    content: `跑后恢复要点：
• 冷身：慢走5分钟，心率逐渐恢复
• 静态拉伸：每个动作30秒
• 补充碳水+蛋白质，及时补水
• 保证7-9小时睡眠`
  },
  {
    id: 4,
    topic: '跑步呼吸',
    keywords: ['呼吸', '喘气', '氧气', '腹式', '节奏'],
    content: `跑步呼吸技巧：
• 腹式呼吸：鼻子吸气，口鼻呼气
• 轻松跑：2-3步一吸，2-3步一呼
• 呼吸困难时：放慢速度深呼吸`
  },

  // === 训练类型 ===
  {
    id: 5,
    topic: '有氧基础跑',
    keywords: ['有氧', 'E跑', '基础跑', '轻松跑', '慢跑', '燃脂'],
    content: `有氧基础跑（E跑）：
• 强度：最大心率50-70%
• 感觉：可以轻松说话
• 好处：建立有氧基础、燃烧脂肪`
  },
  {
    id: 6,
    topic: '间歇跑',
    keywords: ['间歇', 'I跑', '间歇跑', '速度训练', '冲刺'],
    content: `间歇跑训练（I跑）：
• 强度：最大心率90-100%
• 方式：400米×8-10组，组间休息
• 好处：提升速度和摄氧量
• 每周1-2次即可`
  },
  {
    id: 7,
    topic: '节奏跑',
    keywords: ['节奏跑', 'T跑', '乳酸阈值', '配速跑', '阈值跑'],
    content: `节奏跑训练（T跑）：
• 强度：最大心率80-90%
• 时长：20-40分钟
• 好处：提升乳酸阈值、配速更稳`
  },
  {
    id: 8,
    topic: '长跑训练',
    keywords: ['长跑', 'L跑', '长距离', '周末跑', 'lsd'],
    content: `长跑训练（L跑）：
• 强度：最大心率60-75%
• 距离：超过平时训练的1.5倍
• 好处：增强耐力、建立信心`
  },
  {
    id: 9,
    topic: '心率训练',
    keywords: ['心率', '强度', '区间', '最大', '燃脂', '有氧'],
    content: `心率训练五区间：
• 热身区50-60%：非常轻松
• 燃脂区60-70%：舒适可坚持
• 有氧区70-80%：提高有氧能力
• 乳酸阈值区80-90%：提升无氧
• 无氧区90-100%：高强度
最大心率=220-年龄`
  },

  // === 伤痛处理 ===
  {
    id: 10,
    topic: '髂胫束综合征',
    keywords: ['膝盖外侧', '髂胫束', '跑步膝', '大腿外侧疼'],
    content: `髂胫束综合征（膝盖外侧疼）：
• 症状：膝盖外侧刺痛
• 应对：停跑休息、冰敷、拉伸
• 康复：加强臀中肌训练
⚠️ 疼痛持续请及时就医`
  },
  {
    id: 11,
    topic: '足底筋膜炎',
    keywords: ['足底', '脚底', '脚跟', '足跟', '足弓疼', '早晨'],
    content: `足底筋膜炎：
• 症状：足跟刺痛，早晨第一步明显
• 应对：冰敷、滚冰冻水瓶、拉伸
• 康复：抓毛巾训练、矫形鞋垫
⚠️ 疼痛持续请及时就医`
  },
  {
    id: 12,
    topic: '小腿伤痛',
    keywords: ['小腿', '小腿肚', '胫骨', '肌肉酸痛', '抽筋'],
    content: `小腿伤痛处理：
• 胫骨疼：小腿前侧按压痛感
• 肌肉酸痛：24-72小时延迟性酸痛
• 抽筋：反向拉伸、补电解质
• 预防：热身、循序渐进`
  },

  // === 补给 ===
  {
    id: 13,
    topic: '短距离补给',
    keywords: ['补给', '喝水', '能量', '饮食', '1小时'],
    content: `短距离跑步补给：
• 1小时以内：一般不需额外补给
• 跑前正常饮食即可
• 跑后补充水分即可`
  },
  {
    id: 14,
    topic: '马拉松补给',
    keywords: ['马拉松', '能量胶', '电解质', '长距离', '比赛补给'],
    content: `马拉松/长距离补给：
• 每30分钟补碳水约30-60克
• 每15-20分钟少量补水
• 提前适应比赛补给品
• 赛前2-4小时进食碳水`
  },

  // === 备战 ===
  {
    id: 15,
    topic: '全马训练',
    keywords: ['全马', '马拉松', '42公里', '备战', '训练计划'],
    content: `全马备战训练：
• 周期：16-20周
• 关键：完成1-2次30km+长跑
• 赛前2-3周开始减量
• 每周跑量增幅不超10%`
  },
  {
    id: 16,
    topic: '半马训练',
    keywords: ['半马', '21公里', '半程马拉松', '备战'],
    content: `半马备战训练：
• 周期：8-12周
• 关键：完成1-2次15km+长跑
• 赛前2周开始减量
• 重点：有氧耐力和节奏感`
  },
  {
    id: 17,
    topic: '撞墙应对',
    keywords: ['撞墙', '极点', '30公里', '极限', '撞墙期'],
    content: `撞墙期应对：
• 出现在30-35公里很正常
• 应对：降低配速或走一段
• 补充能量胶或运动饮料
• 心理暗示鼓励自己`
  },

  // === 跑鞋 ===
  {
    id: 18,
    topic: '缓震跑鞋',
    keywords: ['缓震', '缓震跑鞋', '缓冲', '保护', '减震'],
    content: `缓震跑鞋：
• 适合：正常足弓、大体重、初跑者
• 优点：保护关节、减少冲击
• 国际：Hoka Clifton、Nike Vomero
• 国产：必迈惊碳、李宁超轻`
  },
  {
    id: 19,
    topic: '支撑跑鞋',
    keywords: ['支撑', '支撑跑鞋', '稳定', '扁平足', '内旋'],
    content: `支撑跑鞋：
• 适合：扁平足、低足弓、过度内旋
• 优点：矫正跑姿、保护膝盖
• 国际：Asics Kayano、Brooks
• 国产：361度Spire、特步`
  },
  {
    id: 20,
    topic: '竞速跑鞋',
    keywords: ['竞速', '碳板', '速度', '比赛', '轻量'],
    content: `竞速/碳板跑鞋：
• 适合：进阶跑者、比赛日
• 优点：推进力强、回弹好、省力
• 国际：Nike Vaporfly、Adidas Pro
• 国产：李宁飞电、特步160X`
  },
  {
    id: 21,
    topic: '越野跑鞋',
    keywords: ['越野', '山路', '泥地', 'trail', '抓地'],
    content: `越野跑鞋：
• 适合：山路、泥地、碎石路
• 优点：抓地力强、保护脚踝
• 注意：不适合公路跑`
  },

  // === 跑步装备 ===
  {
    id: 22,
    topic: '跑步装备',
    keywords: ['装备', '服装', '袜子', '腰包', '水壶', '帽子'],
    content: `跑步必备装备：
• 跑鞋：最重要，选合适类型
• 跑步袜：排汗速干，避免棉袜
• 可选：手表、腰包、帽子
原则：轻便舒适、透气排汗`
  },

  // === 数据与APP ===
  {
    id: 23,
    topic: '跑步APP',
    keywords: ['APP', 'Keep', '悦跑圈', '咕咚', 'Nike', '软件'],
    content: `跑步APP推荐：
• Keep：功能全面，适合新手
• 悦跑圈：数据准确，社交强
• 咕咚：活动丰富
• Nike Run Club：界面简洁`
  },
  {
    id: 24,
    topic: '跑步手表Garmin',
    keywords: ['Garmin', '佳明', '跑步手表', '运动手表'],
    content: `Garmin跑步手表：
• Forerunner 165：入门款
• Forerunner 265/965：进阶款
• 特点：专业跑步数据、生态完善
• 支持：训练负荷、恢复时间`
  },
  {
    id: 25,
    topic: '跑步手表高驰',
    keywords: ['高驰', 'COROS', '跑步手表', '国产', '性价比'],
    content: `高驰（COROS）跑步手表：
• Pace 3：入门高性价比
• Apex 2：进阶款，钛合金
• Vertix 2：旗舰款，超长续航
• 特点：国产专业、续航强劲`
  },
  {
    id: 26,
    topic: '跑步手表华为',
    keywords: ['华为', 'Huawei', 'GT Runner', 'Watch GT'],
    content: `华为跑步手表：
• GT Runner：专业跑步，轻量化
• GT 4/5：日常运动兼顾，GPS准
• Watch Fit：轻便入门，性价比高
• 支持：跑步指数、训练负荷`
  },
  {
    id: 27,
    topic: '跑步数据',
    keywords: ['数据', '配速', '心率', '步频', '步幅', '跑量'],
    content: `跑步数据分析：
• 核心数据：距离、配速、心率
• 步频、步幅、训练负荷
• 每周总结训练数据
• 根据数据调整训练计划`
  },

  // === 其他主题 ===
  {
    id: 28,
    topic: '跑步营养',
    keywords: ['营养', '饮食', '蛋白质', '碳水', '维生素'],
    content: `跑步饮食指南：
• 跑前1-2小时进食碳水为主
• 跑后黄金30分钟补碳水+蛋白
• 日常均衡饮食，多吃蔬果
• 每天保持1.5-2升水分`
  },
  {
    id: 29,
    topic: '跑步天气',
    keywords: ['天气', '高温', '低温', '雨天', '雾霾'],
    content: `不同天气跑步建议：
• 高温：清晨或傍晚，降低配速
• 低温：保暖分层，热身延长
• 雨天：注意防滑，跑后擦干
• 雾霾AQI>150：建议室内运动`
  },
  {
    id: 30,
    topic: '力量训练',
    keywords: ['力量', '肌肉', '深蹲', '平板支撑', '核心', '臀肌'],
    content: `跑步者力量训练：
• 每周2-3次，每次20-30分钟
• 重点：臀肌、核心、腿部
• 动作：深蹲、弓步蹲、臀桥、平板支撑
• 跑步后做效果更好`
  },
  {
    id: 31,
    topic: '新手入门',
    keywords: ['新手', '初学', '入门', '第一次', '初级', '小白'],
    content: `跑步新手指南：
• 从走跑交替开始：跑1走2
• 每次20-30分钟，逐渐增加
• 遵循"跑得舒适"原则
• 不要急于追求速度和距离`
  },
  {
    id: 32,
    topic: '跑步目标',
    keywords: ['目标', '5K', '10K', '半马', '全马', '完赛'],
    content: `跑步目标设定：
• 5公里：初学者一周内可完成
• 10公里：需2-4周训练
• 半马：建议3-6个月基础
• 全马：建议1年以上训练
• 配速目标：入门6-7分，进阶5-6分`
  },
  {
    id: 33,
    topic: '交叉训练',
    keywords: ['交叉', '游泳', '骑车', '瑜伽', '体能'],
    content: `交叉训练好处：
• 减少伤害风险
• 锻炼不同肌肉群
• 保持运动趣味性
• 推荐：游泳、骑行、瑜伽`
  },
  {
    id: 34,
    topic: '比赛策略',
    keywords: ['比赛', '起跑', '补给', '撞墙', '冲刺', '分段'],
    content: `比赛当天策略：
• 起跑：不要太快，前5公里热身
• 途中：保持稳定配速，按计划补给
• 撞墙：降低配速或走一段
• 终点：不要急停，慢走拉伸`
  },
  {
    id: 35,
    topic: '跑步心理',
    keywords: ['心理', '坚持', '动力', '激励', '放弃', '信心'],
    content: `跑步心理建设：
• 保持动力：设定目标、记录进步
• 克服困难：关注过程、允许休息
• 比赛心理：专注自己节奏
• 享受过程，不要只看结果`
  }
]


// ============================================
// 使用 Chat API 做语义匹配（替代 Embedding）
// ============================================
async function getRelevantTopics(query: string, topK: number = 3): Promise<{ item: typeof RUNNING_KNOWLEDGE[0]; relevance: number }[]> {
  // 构建知识库主题列表
  const topicsList = RUNNING_KNOWLEDGE.map((item, index) => 
    `${index + 1}. ${item.topic}: ${item.keywords.join(', ')}`
  ).join('\n')

  const prompt = `用户问题：${query}

知识库主题列表：
${topicsList}

请只找出与用户问题最相关的1个主题编号（1-${RUNNING_KNOWLEDGE.length}），只输出一个数字。

例如：如果问题是"跑步时膝盖疼"，输出应该是"10"（髂胫束综合征）`

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 50,
        temperature: 0.3
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    // 解析返回的编号
    const numbers = content.match(/\d+/g)?.map(Number) || []
    
    // 返回匹配的主题
    return numbers
      .filter(n => n >= 1 && n <= RUNNING_KNOWLEDGE.length)
      .slice(0, topK)
      .map(n => ({
        item: RUNNING_KNOWLEDGE[n - 1],
        relevance: 1 - (numbers.indexOf(n) * 0.2)  // 排序越前相关性越高
      }))
  } catch (e) {
    console.warn('语义匹配失败:', e)
    return []
  }
}

// ============================================
// 搜索服务类
// ============================================
class WebSearchService {
  // 关键词匹配得分
  private calculateKeywordScore(item: typeof RUNNING_KNOWLEDGE[0], query: string): number {
    const queryLower = query.toLowerCase()
    const queryWords = queryLower.split(/[\s,.，。、]+/).filter(w => w.length > 1)
    let score = 0

    for (const word of queryWords) {
      // 主题匹配（高权重）
      if (item.topic.toLowerCase().includes(word)) {
        score += 5
      }
      // 关键词匹配（中权重）
      for (const keyword of item.keywords) {
        if (keyword.toLowerCase().includes(word)) {
          score += 3
        }
      }
      // 内容匹配（低权重）
      if (item.content.toLowerCase().includes(word)) {
        score += 1
      }
    }

    return score
  }

  // 关键词搜索（同步）
  searchByKeyword(query: string, topK: number = 3): { item: typeof RUNNING_KNOWLEDGE[0]; score: number }[] {
    const scored = RUNNING_KNOWLEDGE.map(item => ({
      item,
      score: this.calculateKeywordScore(item, query)
    }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    return scored
  }

  // 语义搜索（使用 Chat API）
  async searchBySemantic(query: string, topK: number = 3): Promise<{ item: typeof RUNNING_KNOWLEDGE[0]; score: number }[]> {
    try {
      return await getRelevantTopics(query, topK)
    } catch (e) {
      console.warn('语义搜索失败:', e)
      return []
    }
  }

  // 混合搜索（关键词 + 语义）
  async searchHybrid(query: string, topK: number = 1): Promise<string[]> {
    // 关键词搜索结果
    const keywordResults = this.searchByKeyword(query, topK * 3)
    
    // 语义搜索结果（使用 Chat API）
    const semanticResults = await this.searchBySemantic(query, topK * 2)

    // 合并去重，按综合得分排序
    const combined = new Map<number, { item: typeof RUNNING_KNOWLEDGE[0]; score: number }>()
    
    // 关键词结果（权重 0.5）
    for (const r of keywordResults) {
      const existing = combined.get(r.item.id)
      if (existing) {
        existing.score += r.score * 0.5
      } else {
        combined.set(r.item.id, { item: r.item, score: r.score * 0.5 })
      }
    }

    // 语义结果（权重 0.5）
    for (const r of semanticResults) {
      const existing = combined.get(r.item.id)
      if (existing) {
        existing.score += r.relevance * 50
      } else {
        combined.set(r.item.id, { item: r.item, score: r.relevance * 50 })
      }
    }

    // 按综合得分排序
    const results = Array.from(combined.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    return results.map(r => `[${r.item.topic}]:\n${r.item.content}`)
  }

  // 搜索内置知识库（兼容旧接口）
  async searchBuiltInKnowledge(query: string, topK: number = 1): Promise<string[]> {
    return this.searchHybrid(query, topK)
  }

  // 搜索接口（使用 DeepSeek API 进行知识增强）
  async searchExternal(query: string): Promise<{
    summary?: string;
    results: { title: string; url?: string; snippet: string }[];
  }> {
    try {
      // 使用 DeepSeek 作为知识增强
      const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的跑步教练。请根据用户的问题，提供准确、有用的跑步相关知识回答。如果问题与跑步/运动无关，请直接说明"这个问题与跑步运动无关"。回答要专业、科学、实用。'
            },
            {
              role: 'user',
              content: `请回答关于跑步的问题，如果需要可以结合以下知识背景回答：\n\n问题：${query}\n\n请用100字以内回答。`
            }
          ],
          max_tokens: 300,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      const answer = data.choices?.[0]?.message?.content || ''

      if (answer.includes('与跑步运动无关')) {
        return { results: [] }
      }

      // 只保留 summary，去掉重复的 results
      return {
        summary: answer
      }
    } catch (e) {
      console.warn('External search failed:', e)
      return { results: [] }
    }
  }

  // 统一搜索接口（智能降级）
  async search(query: string, topK: number = 1): Promise<{
    builtInKnowledge: string[];
    externalResults?: { summary: string }[];
    summary?: string;
    source: 'internal' | 'external' | 'hybrid';
  }> {
    // 搜索内置知识库（混合检索：关键词 + Chat API 语义）
    const builtInKnowledge = await this.searchHybrid(query, topK)

    // 尝试外部搜索
    let externalResults = undefined
    let summary = undefined
    let source: 'internal' | 'external' | 'hybrid' = 'internal'

    try {
      const external = await this.searchExternal(query)
      if (external.results.length > 0) {
        externalResults = external.results
        summary = external.summary
        source = builtInKnowledge.length > 0 ? 'hybrid' : 'external'
      }
    } catch (e) {
      console.warn('External search failed, using internal knowledge only')
    }

    return {
      builtInKnowledge,
      externalResults,
      summary,
      source
    }
  }
}

// 导出单例
export const webSearchService = new WebSearchService()
