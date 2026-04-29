// ============================================
// Web Search Service - 外部知识搜索服务
// ============================================

// 内置跑步知识库
const RUNNING_KNOWLEDGE = [
  {
    topic: '跑步姿势',
    keywords: ['姿势', '跑姿', '步态', '落地'],
    content: `正确跑步姿势要点：
• 身体略微前倾（不是弯腰），保持挺直
• 头部保持正直，目视前方约10-20米
• 手臂弯曲约90度，自然前后摆动
• 核心收紧，保护脊椎
• 脚掌中部或前掌着地，避免脚跟重击
• 步幅适中，步频建议170-180步/分钟
• 保持均匀呼吸，通常2-3步一吸`
  },
  {
    topic: '热身准备',
    keywords: ['热身', '准备', '拉伸', '活动'],
    content: `跑步前热身（5-10分钟）：
1. 慢走2-3分钟，让身体微微发热
2. 动态拉伸：
   - 腿部摆动（前前后后）
   - 踢臀跑20-30米
   - 高抬腿跑20-30米
   - 髋关节绕环
   - 踝关节旋转
3. 轻松跑3-5分钟过渡
热身后身体微微出汗即可，不要过度疲劳。`
  },
  {
    topic: '跑后恢复',
    keywords: ['恢复', '放松', '拉伸', '休息'],
    content: `跑后恢复要点：
1. 冷身：慢走或轻松慢跑5分钟，让心率逐渐恢复
2. 静态拉伸（每个动作保持30秒）：
   - 小腿后侧拉伸
   - 大腿前侧拉伸（股四头肌）
   - 大腿后侧拉伸（腘绳肌）
   - 髋屈肌拉伸
   - 臀部拉伸
3. 补充营养：
   - 跑后30分钟内补充碳水化合物和蛋白质
   - 及时补水
4. 保证充足睡眠7-9小时
5. 适当按摩或泡沫轴放松`
  },
  {
    topic: '训练计划',
    keywords: ['训练', '计划', '周期', '安排'],
    content: `科学跑步训练组成：
1. 有氧基础跑（E跑）：低强度，长时间，燃脂效果好
2. 间歇跑（I跑）：高强度短时间，提升速度
   - 经典：400m×8-10组，休息200m
3. 节奏跑（T跑）：中等到高强度，提升乳酸阈值
   - 如：20分钟热身 + 30分钟目标配速 + 10分钟放松
4. 长跑（L跑）：慢速长距离，建立有氧基础
5. 休息或交叉训练：主动恢复

10%规则：每周跑量增幅不超过10%
训练周期：通常4-8周为一个训练周期`
  },
  {
    topic: '心率训练',
    keywords: ['心率', '强度', '区间', '最大'],
    content: `心率训练五区间：
• 热身区（50-60%最大心率）：非常轻松，恢复跑
• 燃脂区（60-70%最大心率）：舒适，可长时间坚持
• 有氧耐力区（70-80%最大心率）：提高有氧能力
• 乳酸阈值区（80-90%最大心率）：提升无氧耐力
• 无氧区（90-100%最大心率）：高强度训练

最大心率估算：220 - 年龄
例：30岁 → 最大心率约190
建议用运动手表实时监测心率`
  },
  {
    topic: '跑步伤痛',
    keywords: ['伤痛', '疼痛', '受伤', '膝盖', '足底'],
    content: `常见跑步伤痛及应对：
1. 跑步膝（髂胫束综合症）：
   - 症状：膝盖外侧疼痛
   - 应对：休息、冰敷、加强臀部肌肉
2. 足底筋膜炎：
   - 症状：足跟或足底刺痛
   - 应对：拉伸足底、滚冰冻水瓶、选择支撑好的跑鞋
3. 小腿酸痛：
   - 应对：拉伸、冰敷、减少跑量
4. 黑指甲：
   - 预防：选择合适跑鞋、减慢下坡速度、剪短指甲

⚠️ 如疼痛持续超过一周，请及时就医`
  },
  {
    topic: '补给策略',
    keywords: ['补给', '喝水', '能量', '饮食'],
    content: `跑步补给原则：
• 1小时以内跑步：一般不需要额外补给，赛前正常饮食即可
• 超过1小时：
  - 每30分钟补充碳水化合物（约30-60克）
  - 每15-20分钟少量补水，少量多次
• 长距离/马拉松：
  - 提前适应比赛补给品
  - 赛前2-4小时进食易消化碳水化合物
  - 赛中补充运动饮料和能量胶
• 跑后：补充水分、电解质、碳水化合物和蛋白质`
  },
  {
    topic: '马拉松准备',
    keywords: ['马拉松', '全马', '半马', '比赛'],
    content: `马拉松备战建议：
【训练】
• 系统训练至少16-20周（马拉松）/ 8-12周（半马）
• 赛前2-3周开始减量，让身体恢复
• 至少完成1-2次30km+（全马）/ 15km+（半马）长跑

【比赛周】
• 保持充足睡眠
• 减少训练量，以轻松跑为主
• 比赛前一天早睡

【比赛日】
• 提前2-3小时起床
• 早餐选择熟悉易消化的食物
• 提前到会场热身
• 前5公里控制速度，留有余地
• 撞墙期（30-35公里）正常现象，保持信心
• 终点不要立即停止，继续慢走`
  },
  {
    topic: '跑鞋选择',
    keywords: ['跑鞋', '鞋', '装备', '选择'],
    content: `跑鞋选择指南：
• 缓震型：适合正常足弓、正常内旋，缓冲减震
• 支撑型：适合扁平足、低足弓，提供额外支撑
• 竞速型：轻量，适合比赛日，追求速度
• 越野型：适合山路、泥地，提供抓地力

选择建议：
• 每双跑鞋寿命约500-800公里
• 跑鞋最好比平时走路鞋子大半码
• 新鞋需要磨合，不要穿新鞋跑长距离
• 建议有2-3双轮换使用，延长寿命`
  },
  {
    topic: '跑步呼吸',
    keywords: ['呼吸', '喘气', '氧气'],
    content: `跑步呼吸技巧：
• 腹式呼吸：用鼻子吸气、嘴巴或鼻子呼气
• 呼吸节奏：
  - 轻松跑：2-3步一吸，2-3步一呼
  - 中等强度：2步一吸，2步一呼
  - 高速跑：1-2步一吸，1-2步一呼
• 呼吸困难时：
  1. 放慢速度
  2. 深呼吸几次
  3. 不要憋气
• 鼻呼吸适合慢跑，高强度时需要口鼻共用`
  }
]

// 搜索服务类
class WebSearchService {
  // 关键词匹配得分
  private calculateRelevance(item: typeof RUNNING_KNOWLEDGE[0], query: string): number {
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

  // 搜索内置知识库
  searchBuiltInKnowledge(query: string, topK: number = 3): string[] {
    const scored = RUNNING_KNOWLEDGE.map(item => ({
      ...item,
      score: this.calculateRelevance(item, query)
    }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    return scored.map(item => `[${item.topic}]:\n${item.content}`)
  }

  // 搜索接口（使用通义千问 API）
  async searchExternal(query: string): Promise<{
    summary?: string;
    results: { title: string; url?: string; snippet: string }[];
  }> {
    const apiKey = import.meta.env.VITE_QWEN_API_KEY
    if (!apiKey || apiKey === 'your-api-key') {
      return { results: [] }
    }

    try {
      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [
            {
              role: 'system',
              content: '你是一个跑步知识助手。请根据用户的问题，提供简短的、与跑步相关的知识回答。如果问题与跑步无关，请说明"这个问题与跑步无关"。'
            },
            {
              role: 'user',
              content: `请用50字以内回答关于跑步的问题：${query}`
            }
          ],
          max_tokens: 200,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      const answer = data.choices?.[0]?.message?.content || ''

      if (answer.includes('与跑步无关')) {
        return { results: [] }
      }

      return {
        summary: answer,
        results: [{
          title: 'AI 回答',
          snippet: answer
        }]
      }
    } catch (e) {
      console.warn('External search failed:', e)
      return { results: [] }
    }
  }

  // 统一搜索接口（智能降级）
  async search(query: string, topK: number = 3): Promise<{
    builtInKnowledge: string[];
    externalResults?: { title: string; url?: string; snippet: string }[];
    summary?: string;
    source: 'internal' | 'external' | 'hybrid';
  }> {
    // 先搜索内置知识库
    const builtInKnowledge = this.searchBuiltInKnowledge(query, topK)

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
