// ============================================
// Self-Reflection & Error Correction Module
// 自我反思与纠错机制
// ============================================

import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL } from '@/api/agent'

// 反思配置
const REFLECTION_CONFIG = {
  // 何时触发反思
  triggerConditions: {
    checkInformationCompleteness: true,  // 检查信息完整性
    checkAnswerQuality: true,             // 检查回答质量
    checkSafetyRisk: true,                // 检查安全风险
  },
  // 置信度阈值
  confidenceThreshold: 0.6,  // 低于此阈值需要反思
}

// 反思结果类型
export interface ReflectionResult {
  passed: boolean           // 是否通过反思检查
  issues: string[]          // 发现的问题列表
  suggestions: string[]    // 改进建议
  confidence: number        // 置信度 0-1
  needsCorrection: boolean   // 是否需要纠错
  correctedResponse?: string // 纠错后的回复（如果有）
}

// 反思提示词
const REFLECTION_PROMPT = `你是一个严谨的跑步教练 AI。请对刚才的回复进行自我检查。

## 检查维度

### 1. 信息完整性
- 是否需要用户提供更多信息才能给出准确建议？
- 回复中是否缺少关键前提条件？

### 2. 回答质量
- 回复是否准确、科学？
- 是否有明显的错误或过时信息？

### 3. 安全风险
- 回复中是否有潜在的安全隐患？
- 训练建议强度是否过大？
- 是否涉及医疗、法律等专业领域但未做免责声明？

### 4. 用户需求匹配
- 回复是否真正回答了用户的问题？
- 是否遗漏了用户的某个需求？

## 输出格式
请严格按以下 JSON 格式输出，不要添加任何额外文字：
{
  "passed": true或false,
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "confidence": 0.0-1.0,
  "needsCorrection": true或false,
  "correctedResponse": "如果需要纠错，输出纠错后的回复"
}

// 用户问题：
{userQuestion}

// AI 回复：
{aiResponse}

// 用户上下文（如有）：
{context}`

// 用户信息不完整时的反思提示词
const INFORMATION_INCOMPLETE_PROMPT = `你是一个严谨的跑步教练 AI。用户的问题似乎缺少关键信息。

## 用户问题
{userQuestion}

## 检查
请判断以下关键信息是否缺失：
1. 用户当前跑步水平/经验
2. 用户的身体状况/伤病史
3. 用户的目标/时间限制
4. 用户的可用时间/训练条件

## 输出格式
请严格按以下 JSON 格式输出：
{
  "passed": true或false,
  "missingInfo": ["缺失信息1", "缺失信息2"],
  "questionsToAsk": ["询问问题1", "询问问题2"],
  "confidence": 0.0-1.0
}`

// 计划安全检查提示词
const PLAN_SAFETY_PROMPT = `你是一个严谨的跑步教练 AI。请检查训练计划是否存在安全隐患。

## 用户情况
{userContext}

## 训练计划
{planContent}

## 检查项目
1. 训练强度是否循序渐进？
2. 增量是否超过 10% 规则？
3. 是否安排了足够的休息日？
4. 是否有足够的热身和恢复？
5. 强度安排是否考虑用户当前水平？

## 输出格式
请严格按以下 JSON 格式输出：
{
  "passed": true或false,
  "safetyIssues": ["安全问题1", "安全问题2"],
  "recommendations": ["改进建议1", "改进建议2"],
  "confidence": 0.0-1.0,
  "safePlan": "如果需要修改，输出安全的替代计划"
}`

/**
 * 调用 DeepSeek 进行反思
 */
async function callReflectionAPI(prompt: string): Promise<any> {
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
          {
            role: 'system',
            content: '你是一个严谨的 AI 教练助手。你的职责是检查和反思，确保回答质量。用户要求你进行自我检查时，请严格按照指定格式输出 JSON。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,  // 低温度保证输出稳定
        max_tokens: 1000
      })
    })

    if (!response.ok) {
      throw new Error(`Reflection API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    // 解析 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    return null
  } catch (error) {
    console.error('Reflection API error:', error)
    return null
  }
}

/**
 * 自我反思主函数
 */
export async function reflect(
  userQuestion: string,
  aiResponse: string,
  context?: {
    hasUserProfile?: boolean
    hasRunningRecords?: boolean
    hasTrainingPlan?: boolean
    toolResults?: string[]
  }
): Promise<ReflectionResult> {
  // 如果配置关闭，直接返回通过
  if (!REFLECTION_CONFIG.triggerConditions.checkAnswerQuality) {
    return {
      passed: true,
      issues: [],
      suggestions: [],
      confidence: 1.0,
      needsCorrection: false
    }
  }

  try {
    // 构建上下文信息
    const contextInfo = context 
      ? `\n用户上下文：\n- 有用户资料：${context.hasUserProfile ? '是' : '否'}\n- 有跑步记录：${context.hasRunningRecords ? '是' : '否'}\n- 有训练计划：${context.hasTrainingPlan ? '是' : '否'}${context.toolResults?.length ? '\n- 已获取数据：' + context.toolResults.join(', ') : ''}`
      : ''

    // 调用反思 API
    const result = await callReflectionAPI(
      REFLECTION_PROMPT
        .replace('{userQuestion}', userQuestion)
        .replace('{aiResponse}', aiResponse)
        .replace('{context}', contextInfo)
    )

    if (!result) {
      // API 调用失败，返回默认结果
      return {
        passed: true,
        issues: ['反思检查暂时不可用'],
        suggestions: [],
        confidence: 0.5,
        needsCorrection: false
      }
    }

    return {
      passed: result.passed ?? true,
      issues: result.issues ?? [],
      suggestions: result.suggestions ?? [],
      confidence: result.confidence ?? 0.5,
      needsCorrection: result.needsCorrection ?? false,
      correctedResponse: result.correctedResponse
    }
  } catch (error) {
    console.error('Reflection error:', error)
    return {
      passed: true,
      issues: [],
      suggestions: [],
      confidence: 0.5,
      needsCorrection: false
    }
  }
}

/**
 * 检查信息完整性
 */
export async function checkInformationCompleteness(
  userQuestion: string
): Promise<{ incomplete: boolean; missingInfo: string[]; questionsToAsk: string[] }> {
  if (!REFLECTION_CONFIG.triggerConditions.checkInformationCompleteness) {
    return { incomplete: false, missingInfo: [], questionsToAsk: [] }
  }

  try {
    const result = await callReflectionAPI(
      INFORMATION_INCOMPLETE_PROMPT.replace('{userQuestion}', userQuestion)
    )

    if (!result) {
      return { incomplete: false, missingInfo: [], questionsToAsk: [] }
    }

    return {
      incomplete: result.passed === false,
      missingInfo: result.missingInfo ?? [],
      questionsToAsk: result.questionsToAsk ?? []
    }
  } catch (error) {
    return { incomplete: false, missingInfo: [], questionsToAsk: [] }
  }
}

/**
 * 检查训练计划安全性
 */
export async function checkPlanSafety(
  userContext: string,
  planContent: string
): Promise<{ safe: boolean; issues: string[]; recommendations: string[]; safePlan?: string }> {
  if (!REFLECTION_CONFIG.triggerConditions.checkSafetyRisk) {
    return { safe: true, issues: [], recommendations: [] }
  }

  try {
    const result = await callReflectionAPI(
      PLAN_SAFETY_PROMPT
        .replace('{userContext}', userContext)
        .replace('{planContent}', planContent)
    )

    if (!result) {
      return { safe: true, issues: [], recommendations: [] }
    }

    return {
      safe: result.passed ?? true,
      issues: result.safetyIssues ?? [],
      recommendations: result.recommendations ?? [],
      safePlan: result.safePlan
    }
  } catch (error) {
    return { safe: true, issues: [], recommendations: [] }
  }
}

/**
 * 生成反思后的提示消息
 */
export function generateReflectionMessage(result: ReflectionResult): string {
  if (result.passed && !result.needsCorrection) {
    return ''
  }

  let message = '\n\n💭 **自我检查反馈**：\n'

  if (result.issues.length > 0) {
    message += '\n⚠️ 发现以下问题：\n'
    result.issues.forEach(issue => {
      message += `- ${issue}\n`
    })
  }

  if (result.suggestions.length > 0) {
    message += '\n💡 改进建议：\n'
    result.suggestions.forEach(suggestion => {
      message += `- ${suggestion}\n`
    })
  }

  return message
}

// 导出配置
export { REFLECTION_CONFIG }
