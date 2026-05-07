<script setup lang="ts">
import { ref, onMounted, nextTick, watch, computed } from 'vue'
import { getAgent, type Message } from './agent'
import { generateQuickQuestions } from './api/agent'
import * as echarts from 'echarts'
import { getRunningRecords, getActivePlan, getSessionMemory, setSessionMemory, clearSessionMemory } from './store/storage'

const messages = ref<Message[]>([])
const inputText = ref('')
const isLoading = ref(false)
const agent = getAgent()

// 图片上传（暂时屏蔽）
// const uploadedImages = ref<{ id: string; url: string; name: string }[]>([])
// const imageInputRef = ref<HTMLInputElement | null>(null)

// 图表引用
const weeklyChartRef = ref<HTMLDivElement | null>(null)
const paceChartRef = ref<HTMLDivElement | null>(null)
const planChartRef = ref<HTMLDivElement | null>(null)
const radarChartRef = ref<HTMLDivElement | null>(null)
let weeklyChart: echarts.ECharts | null = null
let paceChart: echarts.ECharts | null = null
let planChart: echarts.ECharts | null = null
let radarChart: echarts.ECharts | null = null

// 数据统计
const stats = ref({
  totalRuns: 0,
  totalDistance: 0,
  avgPace: '--:--',
  currentStreak: 0
})

// 当前流式消息
const streamingMessageId = ref<string | null>(null)

// 快捷问题（由 AI 动态生成）
const quickQuestions = ref<string[]>([])

// 数据面板显示状态
const showDataPanel = ref(false)

// 消息列表滚动引用
const messagesRef = ref<HTMLDivElement | null>(null)

// 周期类型：week, month, year
const periodType = ref<'week' | 'month' | 'year'>('week')

// 周期标签
const periodLabel = computed(() => {
  return periodType.value === 'week' ? '周' : periodType.value === 'month' ? '月' : '年'
})

// 滚动到底部
function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

// 切换周期
function switchPeriod(period: 'week' | 'month' | 'year') {
  periodType.value = period
  updateWeeklyChart()
  if (weeklyChart) weeklyChart.resize()
}

// 监听消息变化，自动滚动到底部
watch(() => messages.value.length, async () => {
  await nextTick()
  scrollToBottom()
})

// 初始化
onMounted(async () => {
  // 恢复聊天记录
  const savedMessages = getSessionMemory()
  if (savedMessages.length > 0) {
    messages.value = savedMessages
  } else {
    // 加载欢迎消息
    messages.value.push({
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是你的 AI 跑步教练。有什么关于跑步的问题，随时问我！\n\n我可以帮你：\n📋 制定训练计划\n📊 分析跑步数据\n📚 解答跑步知识\n🎯 设定跑步目标',
      timestamp: Date.now()
    })
  }

  // 滚动到最新消息
  await nextTick()
  scrollToBottom()

  // 加载用户数据
  loadUserData()
  
  // AI 生成快捷问题
  try {
    const questions = await generateQuickQuestions()
    quickQuestions.value = questions
  } catch (e) {
    // 使用默认问题
    quickQuestions.value = [
      '制定一个半马训练计划',
      '分析我的跑步数据',
      '跑步时膝盖疼怎么办',
      '如何提高配速'
    ]
  }
  
  // 初始化图表
  await nextTick()
  initCharts()
})

// 监听抽屉打开，重新渲染图表
watch(showDataPanel, async (newVal) => {
  if (newVal) {
    await nextTick()
    // 延迟一点确保 DOM 已渲染
    setTimeout(() => {
      // 先加载最新数据
      loadUserData()
      // 初始化图表
      initCharts()
      // 触发图表 resize
      if (weeklyChart) weeklyChart.resize()
      if (paceChart) paceChart.resize()
      if (planChart) planChart.resize()
      if (radarChart) radarChart.resize()
    }, 100)
  }
})

// 加载用户数据
function loadUserData() {
  // 获取跑步日期（优先使用 runningDate，兼容旧数据）
  const getRunningDate = (record: any) => record.runningDate || record.createdAt
  
  const records = getRunningRecords()
  if (records.length > 0) {
    const totalDistance = records.reduce((sum, r) => sum + r.distance, 0)
    const totalDuration = records.reduce((sum, r) => sum + r.duration, 0)
    const avgPace = totalDuration / totalDistance
    
    stats.value = {
      totalRuns: records.length,
      totalDistance: Math.round(totalDistance * 10) / 10,
      avgPace: `${Math.floor(avgPace)}:${String(Math.round((avgPace % 1) * 60)).padStart(2, '0')}`,
      currentStreak: calculateStreak(records, getRunningDate)
    }
  }
}

// 计算连续跑步天数
function calculateStreak(records: any[], getRunningDate: (r: any) => string): number {
  if (records.length === 0) return 0
  
  const sortedRecords = [...records].sort((a, b) => 
    new Date(getRunningDate(b)).getTime() - new Date(getRunningDate(a)).getTime()
  )
  
  let streak = 0
  let currentDate = new Date()
  currentDate.setHours(0, 0, 0, 0)
  
  for (const record of sortedRecords) {
    const recordDate = new Date(getRunningDate(record))
    recordDate.setHours(0, 0, 0, 0)
    
    const diffDays = Math.floor((currentDate.getTime() - recordDate.getTime()) / (24 * 60 * 60 * 1000))
    
    if (diffDays <= 1) {
      streak++
      currentDate = recordDate
    } else {
      break
    }
  }
  
  return streak
}

// 初始化图表
function initCharts() {
  // 周跑量图表
  if (weeklyChartRef.value) {
    weeklyChart = echarts.init(weeklyChartRef.value)
    updateWeeklyChart()
  }
  
  // 配速趋势图表
  if (paceChartRef.value) {
    paceChart = echarts.init(paceChartRef.value)
    updatePaceChart()
  }
  
  // 训练计划进度图表
  if (planChartRef.value) {
    planChart = echarts.init(planChartRef.value)
    updatePlanChart()
  }
  
  // 六边形战士雷达图
  if (radarChartRef.value) {
    radarChart = echarts.init(radarChartRef.value)
    updateRadarChart()
  }
}

// 更新跑量图表（支持周/月/年）
function updateWeeklyChart() {
  if (!weeklyChart) return
  
  const records = getRunningRecords()
  const now = new Date()
  
  // 获取跑步日期（兼容旧数据）
  const getRunningDate = (r: any) => r.runningDate || r.createdAt
  
  let data: { date: string; distance: number }[] = []
  let title = ''
  let xAxisData: string[] = []
  
  if (periodType.value === 'week') {
    // 近7天
    title = '近7天跑量'
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(now.getDate() - i)
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
      const dayRecords = records.filter(r => {
        const rDate = new Date(getRunningDate(r))
        return rDate.toDateString() === date.toDateString()
      })
      const dayDistance = dayRecords.reduce((sum, r) => sum + r.distance, 0)
      data.push({ date: dateStr, distance: dayDistance })
      xAxisData.push(dateStr)
    }
  } else if (periodType.value === 'month') {
    // 近30天，按周分组显示日期范围
    title = '近30天跑量'
    const weeks = 4
    for (let w = weeks - 1; w >= 0; w--) {
      const weekDistance = [0, 0, 0, 0, 0, 0, 0]
      let startDate: Date | null = null
      let endDate: Date | null = null
      
      for (let d = 0; d < 7; d++) {
        const dayIndex = (weeks - 1 - w) * 7 + d
        if (dayIndex < 30) {
          const date = new Date(now)
          date.setDate(now.getDate() - (29 - dayIndex))
          if (!startDate || date < startDate) startDate = date
          if (!endDate || date > endDate) endDate = date
          
          const dayRecords = records.filter(r => {
            const rDate = new Date(getRunningDate(r))
            return rDate.toDateString() === date.toDateString()
          })
          weekDistance[d] = dayRecords.reduce((sum, r) => sum + r.distance, 0)
        }
      }
      
      // 显示日期范围，如 "5/1-5/7" 或 "5/30-6/5"
      let dateRange = `第${weeks - w}周`
      if (startDate && endDate) {
        const startStr = `${startDate.getMonth() + 1}/${startDate.getDate()}`
        const endStr = startDate.getMonth() === endDate.getMonth()
          ? `${endDate.getDate()}`
          : `${endDate.getMonth() + 1}/${endDate.getDate()}`
        dateRange = `${startStr}-${endStr}`
      }
      xAxisData.push(dateRange)
      data.push({ date: dateRange, distance: weekDistance.reduce((a, b) => a + b, 0) })
    }
  } else {
    // 近12个月
    title = '近12个月跑量'
    for (let m = 11; m >= 0; m--) {
      const date = new Date(now.getFullYear(), now.getMonth() - m, 1)
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthRecords = records.filter(r => {
        const rDate = new Date(getRunningDate(r))
        return rDate.getFullYear() === date.getFullYear() && rDate.getMonth() === date.getMonth()
      })
      const monthDistance = monthRecords.reduce((sum, r) => sum + r.distance, 0)
      data.push({ date: monthStr, distance: monthDistance })
      xAxisData.push(`${date.getMonth() + 1}月`)
    }
  }
  
  weeklyChart.setOption({
    title: {
      text: title,
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 'normal' }
    },
    tooltip: {
      trigger: 'axis',
      formatter: '{b}: {c}km'
    },
    xAxis: {
      type: 'category',
      data: xAxisData
    },
    yAxis: {
      type: 'value',
      name: 'km',
      axisLabel: { formatter: '{value}' }
    },
    series: [{
      type: 'bar',
      data: data.map(d => d.distance),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#4CAF50' },
          { offset: 1, color: '#81C784' }
        ])
      },
      barWidth: '50%'
    }],
    grid: { left: 50, right: 20, top: 40, bottom: 30 }
  })
}

// 更新配速趋势图表
function updatePaceChart() {
  if (!paceChart) return
  
  const records = getRunningRecords()
  const recentRecords = records.slice(0, 10).reverse()
  
  if (recentRecords.length < 2) {
    paceChart.setOption({
      title: {
        text: '配速趋势',
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 'normal' }
      },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value', name: '分钟/公里' },
      series: [{ type: 'line', data: [] }],
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      graphic: [{
        type: 'text',
        left: 'center',
        top: 'middle',
        style: { text: '数据不足', fill: '#999', fontSize: 12 }
      }]
    })
    return
  }
  
  const paceData = recentRecords.map((r, i) => {
    const [min, sec] = r.pace.split(':').map(Number)
    return { index: i + 1, pace: min + sec / 60 }
  })
  
  paceChart.setOption({
    title: {
      text: '配速趋势（近10次）',
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 'normal' }
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0]
        const paceMin = Math.floor(data.value)
        const paceSec = Math.round((data.value - paceMin) * 60)
        return `第${data.dataIndex + 1}次: ${paceMin}:${String(paceSec).padStart(2, '0')}/km`
      }
    },
    xAxis: {
      type: 'category',
      data: paceData.map(d => `#${d.index}`)
    },
    yAxis: {
      type: 'value',
      name: '分钟/公里',
      inverse: true,
      axisLabel: {
        formatter: (value: number) => {
          const min = Math.floor(value)
          const sec = Math.round((value - min) * 60)
          return `${min}:${String(sec).padStart(2, '0')}`
        }
      }
    },
    series: [{
      type: 'line',
      data: paceData.map(d => d.pace),
      smooth: true,
      lineStyle: { color: '#2196F3', width: 2 },
      itemStyle: { color: '#2196F3' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(33, 150, 243, 0.3)' },
          { offset: 1, color: 'rgba(33, 150, 243, 0.05)' }
        ])
      }
    }],
    grid: { left: 60, right: 20, top: 40, bottom: 30 }
  })
}

// 更新训练计划进度图表
function updatePlanChart() {
  if (!planChart) return
  
  const plan = getActivePlan()
  
  if (!plan) {
    planChart.setOption({
      title: {
        text: '训练计划进度',
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 'normal' }
      },
      graphic: [{
        type: 'text',
        left: 'center',
        top: 'middle',
        style: { text: '暂无训练计划', fill: '#999', fontSize: 12 }
      }]
    })
    return
  }
  
  const currentWeek = Math.min(
    Math.ceil((Date.now() - new Date(plan.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)),
    plan.totalWeeks
  )
  
  planChart.setOption({
    title: {
      text: `训练计划进度（第${currentWeek}/${plan.totalWeeks}周）`,
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 'normal' }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}km ({d}%)'
    },
    legend: {
      bottom: 0,
      left: 'center'
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        formatter: '{b}\n{c}km'
      },
      data: [
        { value: plan.weeklyPlans.slice(0, currentWeek).reduce((sum: number, w: any) => sum + w.totalMileage, 0), name: '已完成', itemStyle: { color: '#4CAF50' } },
        { value: plan.weeklyPlans.slice(currentWeek).reduce((sum: number, w: any) => sum + w.totalMileage, 0), name: '剩余', itemStyle: { color: '#E0E0E0' } }
      ]
    }],
    grid: { left: 20, right: 20, top: 40, bottom: 50 }
  })
}

// 更新六边形战士雷达图
function updateRadarChart() {
  if (!radarChart) return
  
  const records = getRunningRecords()
  
  if (records.length < 3) {
    radarChart.setOption({
      graphic: [{
        type: 'text',
        left: 'center',
        top: 'middle',
        style: { text: '数据不足，请至少记录3次跑步', fill: '#999', fontSize: 12 }
      }]
    })
    return
  }
  
  // 计算各项指标
  // 1. 总跑步时间（分钟）
  const totalDuration = records.reduce((sum, r) => sum + r.duration, 0)
  
  // 2. 总跑步距离（公里）
  const totalDistance = records.reduce((sum, r) => sum + r.distance, 0)
  
  // 3. 平均配速（分钟/公里，转换为数值，越小越好）
  const avgPace = totalDuration / totalDistance
  
  // 4. 平均心率（如果有）
  const recordsWithHR = records.filter(r => r.avgHeartRate && r.avgHeartRate > 0)
  const avgHeartRate = recordsWithHR.length > 0 
    ? recordsWithHR.reduce((sum, r) => sum + (r.avgHeartRate || 0), 0) / recordsWithHR.length 
    : 0
  
  // 5. 平均步幅（米）
  const recordsWithStride = records.filter(r => r.avgStride && r.avgStride > 0)
  const avgStride = recordsWithStride.length > 0
    ? recordsWithStride.reduce((sum, r) => sum + (r.avgStride || 0), 0) / recordsWithStride.length
    : 0
  
  // 6. 平均步频（步/分钟）
  const recordsWithCadence = records.filter(r => r.avgCadence && r.avgCadence > 0)
  const avgCadence = recordsWithCadence.length > 0
    ? recordsWithCadence.reduce((sum, r) => sum + (r.avgCadence || 0), 0) / recordsWithCadence.length
    : 0
  
  // 7. 最大摄氧量（如果有，默认40）
  const recordsWithVO2 = records.filter(r => r.vo2Max && r.vo2Max > 0)
  const avgVO2Max = recordsWithVO2.length > 0
    ? recordsWithVO2.reduce((sum, r) => sum + (r.vo2Max || 0), 0) / recordsWithVO2.length
    : 40
  
  // 计算归一化值（0-100）
  // 假设合理范围：时间0-1000分钟，距离0-500公里，配速3-10分钟/公里，心率120-180，步幅0.5-1.5米，步频140-200，摄氧量25-60
  const normalize = (value: number, min: number, max: number, invert: boolean = false) => {
    if (value === 0) return 0
    let normalized = ((value - min) / (max - min)) * 100
    if (normalized > 100) normalized = 100
    if (normalized < 0) normalized = 0
    return invert ? 100 - normalized : normalized
  }
  
  const radarData = [
    normalize(totalDuration, 0, 1000),        // 总时间（越大越好）
    normalize(totalDistance, 0, 500),          // 总距离（越大越好）
    normalize(avgPace, 3, 10, true),           // 配速（越小越好，所以 invert）
    normalize(avgHeartRate, 120, 180),         // 心率（适中最好，这里简化处理）
    normalize(avgStride, 0.5, 1.5),             // 步幅
    normalize(avgCadence, 140, 200),            // 步频
    normalize(avgVO2Max, 25, 60)                // 最大摄氧量
  ]
  
  radarChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        // 维度数据映射（按 radar indicator 顺序）
        const metrics = [
          { label: '总时间', value: totalDuration, format: (v: number) => `${Math.round(v)}分钟` },
          { label: '总距离', value: totalDistance, format: (v: number) => `${Number(v).toFixed(2)}km` },
          { label: '配速', value: avgPace, format: (v: number) => v > 0 ? `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}/km` : '-' },
          { label: '心率', value: avgHeartRate, format: (v: number) => v > 0 ? `${Math.round(v)}bpm` : '-' },
          { label: '步幅', value: avgStride, format: (v: number) => v > 0 ? `${Number(v).toFixed(2)}m` : '-' },
          { label: '步频', value: avgCadence, format: (v: number) => v > 0 ? `${Number(v).toFixed(2)}spm` : '-' },
          { label: '摄氧量', value: avgVO2Max, format: (v: number) => v > 0 ? `${Number(v).toFixed(2)}ml/kg/min` : '-' }
        ]
        
        const idx = params.dataIndex
        if (idx >= 0 && idx < metrics.length) {
          return `${metrics[idx].label}: ${metrics[idx].format(metrics[idx].value)}`
        }
        
        // 兜底：尝试用 name 匹配
        const name = params.name || ''
        const matched = metrics.find(m => m.label.includes(name) || name.includes(m.label))
        if (matched) {
          return `${matched.label}: ${matched.format(matched.value)}`
        }
        
        return `${name}: ${params.value}`
      }
    },
    radar: {
      indicator: [
        { name: '总时间', max: 100 },
        { name: '总距离', max: 100 },
        { name: '配速', max: 100 },
        { name: '心率', max: 100 },
        { name: '步幅', max: 100 },
        { name: '步频', max: 100 },
        { name: '摄氧量', max: 100 }
      ],
      shape: 'polygon',
      splitNumber: 4,
      axisName: {
        color: '#333',
        fontSize: 11
      },
      splitLine: {
        lineStyle: { color: '#4CAF50', width: 1 }
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: ['rgba(76, 175, 80, 0.05)', 'rgba(76, 175, 80, 0.1)', 'rgba(76, 175, 80, 0.15)', 'rgba(76, 175, 80, 0.2)']
        }
      }
    },
    series: [{
      type: 'radar',
      data: [{
        value: radarData,
        name: '能力值',
        lineStyle: { color: '#4CAF50', width: 2 },
        areaStyle: { color: 'rgba(76, 175, 80, 0.4)' },
        itemStyle: { color: '#4CAF50' },
        symbol: 'circle',
        symbolSize: 6
      }]
    }]
  })
}

// 刷新数据
function refreshData() {
  loadUserData()
  
  // 如果抽屉打开但图表未初始化，先初始化图表
  if (showDataPanel.value) {
    if (!weeklyChart && weeklyChartRef.value) {
      weeklyChart = echarts.init(weeklyChartRef.value)
    }
    if (!paceChart && paceChartRef.value) {
      paceChart = echarts.init(paceChartRef.value)
    }
    if (!planChart && planChartRef.value) {
      planChart = echarts.init(planChartRef.value)
    }
    if (!radarChart && radarChartRef.value) {
      radarChart = echarts.init(radarChartRef.value)
    }
  }
  
  // 更新图表数据
  updateWeeklyChart()
  updatePaceChart()
  updatePlanChart()
  updateRadarChart()
}

// 发送消息（流式）
async function sendMessage() {
  const text = inputText.value.trim()
  // const hasImages = uploadedImages.value.length > 0
  if (!text || isLoading.value) return

  inputText.value = ''
  isLoading.value = true

  // 构建消息内容
  const content = text

  // 添加用户消息
  messages.value.push({
    id: `user_${Date.now()}`,
    role: 'user',
    content: content,
    timestamp: Date.now()
  })

  // 创建助手消息占位
  const assistantMsgId = `assistant_${Date.now()}`
  streamingMessageId.value = assistantMsgId
  messages.value.push({
    id: assistantMsgId,
    role: 'assistant',
    content: '',
    timestamp: Date.now()
  })

  try {
    // 发送文本消息给 Agent（无图片）
    const stream = agent.processStream(text)
    
    for await (const event of stream) {
      if (event.type === 'content') {
        const msg = messages.value.find(m => m.id === assistantMsgId)
        if (msg) {
          msg.content += event.data
        }
      } else if (event.type === 'tool_call') {
        const msg = messages.value.find(m => m.id === assistantMsgId)
        if (msg) {
          msg.content += `\n\n🔧 调用工具: ${event.data.map((t: any) => t.name).join(', ')}`
        }
      } else if (event.type === 'tool_result') {
        const msg = messages.value.find(m => m.id === assistantMsgId)
        if (msg && event.data.result?.message) {
          msg.content = event.data.result.message
        }
        await nextTick()
        refreshData()
      } else if (event.type === 'done') {
        streamingMessageId.value = null
      } else if (event.type === 'error') {
        const msg = messages.value.find(m => m.id === assistantMsgId)
        if (msg) {
          msg.content = `出错了：${event.data}`
        }
        streamingMessageId.value = null
      }
    }
  } catch (error: any) {
    const msg = messages.value.find(m => m.id === assistantMsgId)
    if (msg) {
      msg.content = `出错了：${error.message}`
    }
    streamingMessageId.value = null
  } finally {
    isLoading.value = false
    // 保存聊天记录
    setSessionMemory(messages.value)
  }
}

// 清空对话
function clearChat() {
  messages.value = messages.value.filter(m => m.role === 'assistant')
  agent.clearHistory()
  clearSessionMemory()
  messages.value.unshift({
    id: 'welcome',
    role: 'assistant',
    content: '对话已清空。我们重新开始吧！有什么想问的？',
    timestamp: Date.now()
  })
}

function askQuestion(question: string) {
  inputText.value = question
  sendMessage()
}

// 图片上传（暂时屏蔽）
// function triggerImageUpload() {
//   imageInputRef.value?.click()
// }

// function handleImageSelect(event: Event) {
//   const input = event.target as HTMLInputElement
//   const files = input.files
//   if (!files) return

//   Array.from(files).forEach(file => {
//     if (!file.type.startsWith('image/')) return

//     const reader = new FileReader()
//     reader.onload = (e) => {
//       const url = e.target?.result as string
//       uploadedImages.value.push({
//         id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
//         url,
//         name: file.name
//       })
//     }
//     reader.readAsDataURL(file)
//   })

//   // 清空 input，允许重复选择同一文件
//   input.value = ''
// }

// function removeImage(id: string) {
//   uploadedImages.value = uploadedImages.value.filter(img => img.id !== id)
// }
</script>

<template>
  <div class="app-container">
    <!-- 固定头部 -->
    <header class="header">
      <h1>🏃 跑步教练 Agent</h1>
      <div class="header-actions">
        <button class="data-btn" @click="showDataPanel = true">📊 数据</button>
        <button class="clear-btn" @click="clearChat">清空对话</button>
      </div>
    </header>

    <!-- 数据侧边抽屉 -->
    <div class="drawer-overlay" v-if="showDataPanel" @click="showDataPanel = false">
      <div class="drawer" @click.stop>
        <div class="drawer-header">
          <h2>📊 数据统计</h2>
          <button class="drawer-close" @click="showDataPanel = false">×</button>
        </div>
        
        <div class="drawer-content">
          <!-- 数据统计卡片 -->
          <div class="stats-cards" v-if="stats.totalRuns > 0">
            <div class="stat-card">
              <div class="stat-value">{{ stats.totalRuns }}</div>
              <div class="stat-label">总跑步</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ stats.totalDistance }}</div>
              <div class="stat-label">总公里</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ stats.avgPace }}</div>
              <div class="stat-label">平均配速</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ stats.currentStreak }}</div>
              <div class="stat-label">连续天数</div>
            </div>
          </div>

          <div v-else class="no-data">
            暂无跑步数据，请先记录你的跑步吧！
          </div>

          <!-- 图表区域 -->
          <div class="charts-container" v-if="stats.totalRuns > 0">
            <!-- 周期切换 -->
            <div class="period-switch">
              <button 
                :class="{ active: periodType === 'week' }"
                @click="switchPeriod('week')"
              >周</button>
              <button 
                :class="{ active: periodType === 'month' }"
                @click="switchPeriod('month')"
              >月</button>
              <button 
                :class="{ active: periodType === 'year' }"
                @click="switchPeriod('year')"
              >年</button>
            </div>

            <div class="chart-title">📈 {{ periodLabel }}跑量统计</div>
            <div class="chart-wrapper" ref="weeklyChartRef"></div>
            
            <div class="chart-title">📉 配速趋势</div>
            <div class="chart-wrapper" ref="paceChartRef"></div>
            
            <div class="chart-title">🎯 训练计划进度</div>
            <div class="chart-wrapper" ref="planChartRef"></div>

            <!-- 六边形战士 -->
            <div class="chart-title">🏆 六边形战士</div>
            <div class="chart-wrapper" ref="radarChartRef"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 消息列表 -->
    <div class="messages" ref="messagesRef">
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['message', msg.role, { streaming: msg.id === streamingMessageId }]"
      >
        <div class="avatar">
          {{ msg.role === 'user' ? '🏃' : '🤖' }}
        </div>
        <div class="content">
          <!-- 用户消息中的图片 -->
          <div v-if="msg.images && msg.images.length > 0" class="message-images">
            <img v-for="(img, idx) in msg.images" :key="idx" :src="img" alt="用户上传" />
          </div>
          <pre>{{ msg.content }}<span v-if="msg.id === streamingMessageId" class="cursor">▋</span></pre>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading && !streamingMessageId" class="message assistant loading">
        <div class="avatar">🤖</div>
        <div class="content">
          <div class="typing">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷问题 -->
    <div class="quick-questions" v-if="messages.length <= 2 && !isLoading">
      <div class="quick-label">快捷问题：</div>
      <div class="quick-btns">
        <button 
          v-for="q in quickQuestions" 
          :key="q"
          @click="askQuestion(q)"
          class="quick-btn"
        >
          {{ q }}
        </button>
      </div>
    </div>

    <!-- 固定底部输入框 -->
    <div class="input-area">
      <!-- 图片上传按钮（暂时屏蔽）
      <div class="image-upload">
        <button class="image-btn" @click="triggerImageUpload" :disabled="isLoading">
          📷
        </button>
      </div>
      -->
      
      <textarea
        v-model="inputText"
        placeholder="输入你的问题..."
        @keydown.enter.exact.prevent="sendMessage"
        :disabled="isLoading"
        rows="2"
      ></textarea>
      
      <button 
        @click="sendMessage" 
        :disabled="isLoading || !inputText.trim()"
        class="send-btn"
      >
        {{ isLoading ? '发送中...' : '发送' }}
      </button>
    </div>
    
    <!-- 图片预览（暂时屏蔽）
    <div class="image-preview" v-if="uploadedImages.length > 0">
      <div v-for="img in uploadedImages" :key="img.id" class="image-item">
        <img :src="img.url" :alt="img.name" />
        <button class="remove-btn" @click="removeImage(img.id)">×</button>
      </div>
    </div>
    
    <!-- 隐藏的文件输入
    <input
      ref="imageInputRef"
      type="file"
      accept="image/*"
      multiple
      @change="handleImageSelect"
      style="display: none"
    />
    -->
  </div>
</template>

<style scoped>
.app-container {
  max-width: 800px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* 固定头部 */
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #eee;
  max-width: 800px;
  margin: 0 auto;
}

.header h1 {
  font-size: 18px;
  margin: 0;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.data-btn {
  padding: 6px 12px;
  font-size: 12px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 16px;
  cursor: pointer;
}

.clear-btn {
  padding: 6px 12px;
  font-size: 12px;
  background: #f5f5f5;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  color: #666;
}

.clear-btn:hover {
  background: #eee;
}

/* 侧边抽屉 */
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
}

.drawer {
  width: 85%;
  max-width: 400px;
  height: 100%;
  background: white;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.drawer-header h2 {
  font-size: 16px;
  margin: 0;
  color: #333;
}

.drawer-close {
  width: 32px;
  height: 32px;
  border: none;
  background: #f5f5f5;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* 统计卡片 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  background: linear-gradient(135deg, #4CAF50, #81C784);
  color: white;
  padding: 16px;
  border-radius: 12px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
}

.stat-label {
  font-size: 12px;
  opacity: 0.9;
  margin-top: 4px;
}

.no-data {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-size: 14px;
}

/* 图表 */
.charts-container {
  margin-top: 16px;
}

/* 周期切换按钮 */
.period-switch {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  justify-content: center;
}

.period-switch button {
  padding: 6px 16px;
  font-size: 12px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  color: #666;
}

.period-switch button:hover {
  background: #e8e8e8;
}

.period-switch button.active {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.chart-title {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
  margin-top: 16px;
}

.chart-wrapper {
  height: 200px;
  background: #fafafa;
  border-radius: 12px;
  padding: 8px;
}

/* 消息区域 */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 70px 16px 80px;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message.user {
  flex-direction: row-reverse;
}

.message.assistant {
  flex-direction: row;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.message.user .avatar {
  background: #4CAF50;
  color: white;
}

.message.assistant .avatar {
  background: #2196F3;
  color: white;
}

.content {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 16px;
  background: #f5f5f5;
}

.message.user .content {
  background: #4CAF50;
  color: white;
}

.message.assistant .content {
  background: #f0f7ff;
}

.content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
}

/* 消息中的图片 */
.message-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.message-images img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  object-fit: cover;
  cursor: pointer;
}

.message.user .content {
  background: #4CAF50;
}

.message.user .content .message-images img {
  border: 2px solid rgba(255, 255, 255, 0.3);
}

/* 流式光标 */
.cursor {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* 加载动画 */
.message.loading .content {
  padding: 16px 24px;
}

.typing {
  display: flex;
  gap: 4px;
}

.typing span {
  width: 8px;
  height: 8px;
  background: #999;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

/* 快捷问题 */
.quick-questions {
  margin-bottom: 16px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 12px;
}

.quick-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.quick-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-btn {
  padding: 8px 12px;
  font-size: 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-btn:hover {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

/* 固定底部输入区域 */
.input-area {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-top: 1px solid #eee;
  max-width: 800px;
  margin: 0 auto;
}

.input-area textarea {
  flex: 1;
  min-height: 44px;
  max-height: 120px;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 12px;
  resize: none;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  line-height: 1.4;
  transition: border-color 0.2s;
}

.input-area textarea:focus {
  border-color: #4CAF50;
}

.send-btn {
  height: 44px;
  padding: 0 20px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-btn:hover:not(:disabled) {
  background: #43A047;
}

.send-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

/* 图片上传 */
.image-upload {
  display: flex;
  align-items: center;
}

.image-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 12px;
  cursor: pointer;
  font-size: 20px;
  transition: all 0.2s;
}

.image-btn:hover {
  background: #eee;
  border-color: #ccc;
}

.image-preview {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.image-item {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-item .remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 响应式 */
@media (max-width: 600px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .charts-container {
    grid-template-columns: 1fr;
  }
  
  .content {
    max-width: 85%;
  }
}
</style>
