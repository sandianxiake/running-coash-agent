// ============================================
// 知识检索工具 - RAG Tool（支持外部搜索）
// ============================================

import type { Tool, ToolExecutionResult } from '../types'
import { webSearchService } from '@/api/search'

export const ragTool: Tool = {
  name: 'search_knowledge',
  description: '搜索跑步相关的专业知识库和最新信息。适用于回答跑步训练、姿势、恢复、补给、比赛准备等问题。当用户询问跑步技巧、训练方法、运动知识时使用。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '用户的问题或关键词，例如："跑步时如何控制心率"、"马拉松赛前如何准备"、"如何选择跑鞋"'
      },
      top_k: {
        type: 'number',
        description: '返回最相关的知识条目数量，默认1条'
      }
    },
    required: ['query']
  },
  execute: async (args): Promise<ToolExecutionResult> => {
    const { query, top_k = 1 } = args

    try {
      const searchResult = await webSearchService.search(query, top_k)
      console.log("RAG search result:", JSON.stringify(searchResult, null, 2))

      let responseMessage = ''
      let knowledgeSources: string[] = []

      // 构建响应消息
      if (searchResult.builtInKnowledge && searchResult.builtInKnowledge.length > 0) {
        responseMessage += '📚 专业知识：\n\n'
        searchResult.builtInKnowledge.forEach((knowledge, index) => {
          responseMessage += `${knowledge}\n\n`
        })
        knowledgeSources.push('内置知识库')
      }

      if (searchResult.summary) {
        responseMessage += `💡 网络摘要：${searchResult.summary}\n\n`
      }

      if (knowledgeSources.length === 0) {
        responseMessage = `抱歉，没有找到关于"${query}"的相关知识。\n\n您可以尝试：\n• 使用更通用的关键词\n• 换一种表述方式\n• 询问其他跑步相关问题`
      } else {
        responseMessage += `━━━━━━━━━━━━━━━━━━━━━━━\n📖 信息来源：${knowledgeSources.join(' + ')}。`
      }

      return {
        success: true,
        data: {
          query,
          knowledgeSources,
          builtInKnowledge: searchResult.builtInKnowledge,
          externalResults: searchResult.externalResults,
          summary: searchResult.summary,
          source: searchResult.source,
          // 记录本次返回的主题，用于去重
          topics: searchResult.topics || [],
          message: responseMessage
        }
      }
    } catch (error: any) {
      console.error('RAG search error:', error)
      return {
        success: true,
        data: {
          query,
          message: `搜索时出现了一些问题：${error.message}\n\n建议您换个问题或稍后再试。`
        }
      }
    }
  }
}
