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

// 内置跑步知识库（扩充至 24 个主题）
const RUNNING_KNOWLEDGE = [
  {
    id: 1,
    topic: '跑步姿势',
    keywords: ['姿势', '跑姿', '步态', '落地', '前倾', '摆臂'],
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
    id: 2,
    topic: '热身准备',
    keywords: ['热身', '准备', '拉伸', '活动', '动态', '关节'],
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
    id: 3,
    topic: '跑后恢复',
    keywords: ['恢复', '放松', '拉伸', '休息', '冷身', '按摩'],
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
    id: 4,
    topic: '有氧基础跑',
    keywords: ['有氧', 'E跑', '基础跑', '轻松跑', '慢跑', '燃脂'],
    content: `有氧基础跑（E跑）：
• 强度：最大心率的50-70%
• 感觉：可以轻松说话
• 时长：30分钟到2小时
• 好处：建立有氧基础、燃烧脂肪、保护关节
• 要点：速度要慢，以对话不费力为准`
  },
  {
    id: 5,
    topic: '间歇跑',
    keywords: ['间歇', 'I跑', '间歇跑', '速度训练', '冲刺', 'HIIT'],
    content: `间歇跑训练（I跑）：
• 强度：最大心率90-100%
• 构成：快跑+恢复跑交替
• 经典方式：400米×8-10组
• 组间休息：慢跑或走200米
• 好处：提升最大摄氧量和速度
• 注意：每周1-2次即可，充分热身`
  },
  {
    id: 6,
    topic: '节奏跑',
    keywords: ['节奏跑', 'T跑', '乳酸阈值', '配速跑', '阈值跑'],
    content: `节奏跑训练（T跑）：
• 强度：最大心率的80-90%
• 感觉：有点吃力但可坚持
• 时长：20-40分钟
• 好处：提升乳酸阈值、配速更稳
• 建议：热身10分钟，正式跑30分钟，放松10分钟`
  },
  {
    id: 7,
    topic: '长跑训练',
    keywords: ['长跑', 'L跑', '长距离', '周末跑', 'lsd'],
    content: `长跑训练（L跑）：
• 强度：最大心率的60-75%
• 距离：超过平时训练的1.5倍
• 好处：增强耐力、建立信心、消耗脂肪
• 原则：前慢后快比前快后慢更科学
• 注意：每2-3周一次即可，不要连续跑长距离`
  },
  {
    id: 5,
    topic: '心率训练',
    keywords: ['心率', '强度', '区间', '最大', '燃脂', '有氧'],
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
    id: 6,
    topic: '髂胫束综合征',
    keywords: ['膝盖外侧', '髂胫束', '跑步膝', '大腿外侧疼', '膝盖疼'],
    content: `髂胫束综合征（膝盖外侧疼）：
• 症状：膝盖外侧刺痛，尤其是下坡或弯道时
• 原因：髂胫束摩擦股骨外侧髁
• 应对：停跑休息、冰敷、拉伸髂胫束
• 康复：加强臀中肌、髋外展肌训练
• 预防：跑姿调整、选择缓冲好的跑鞋
⚠️ 如疼痛持续超过一周，请及时就医`
  },
  {
    id: 7,
    topic: '足底筋膜炎',
    keywords: ['足底', '脚底', '脚跟', '足跟', '足弓疼', '早晨下地疼'],
    content: `足底筋膜炎：
• 症状：足跟或足底刺痛，尤其是早晨第一步
• 原因：足底筋膜过度使用或张力过大
• 应对：冰敷足底、滚冰冻水瓶、拉伸小腿和足底
• 康复：定制矫形鞋垫、加强足趾抓毛巾训练
• 预防：避免过度跑量、选择支撑好的跑鞋
⚠️ 如疼痛持续超过一周，请及时就医`
  },
  {
    id: 8,
    topic: '小腿伤痛',
    keywords: ['小腿', '小腿肚', '胫骨', '胫前疼', '肌肉酸痛', '抽筋'],
    content: `小腿伤痛：
• 胫骨骨膜炎：小腿前侧疼痛，按压有痛感
• 肌肉酸痛：运动后24-72小时延迟性酸痛
• 抽筋：电解质失衡或肌肉疲劳
• 应对：拉伸、冰敷、减少跑量
• 抽筋处理：反向拉伸、补充电解质
• 预防：充分热身、循序渐进增加跑量
⚠️ 如疼痛持续超过一周，请及时就医`
  },
  {
    id: 8,
    topic: '短距离补给',
    keywords: ['补给', '喝水', '能量', '饮食', '1小时'],
    content: `短距离跑步补给：
• 1小时以内：一般不需要额外补给
• 跑前正常饮食即可
• 跑后补充水分即可
• 超过30分钟可少量补水`
  },
  {
    id: 9,
    topic: '马拉松补给',
    keywords: ['马拉松', '能量胶', '电解质', '长距离补给', '比赛补给'],
    content: `马拉松/长距离补给：
• 超过1小时需要补充能量
• 每30分钟补充碳水（约30-60克）
• 每15-20分钟少量补水，少量多次
• 提前适应比赛补给品
• 赛前2-4小时进食易消化碳水
• 跑后补充水分、电解质、蛋白质`
  },
  {
    id: 10,
    topic: '全马训练',
    keywords: ['全马', '马拉松', '42公里', '备战', '训练计划'],
    content: `全马备战训练：
• 训练周期：16-20周
• 关键：至少完成1-2次30km+长跑
• 赛前2-3周开始减量
• 每周跑量增幅不超过10%
• 训练组成：有氧跑+间歇+节奏+长跑`
  },
  {
    id: 11,
    topic: '半马训练',
    keywords: ['半马', '21公里', '半程马拉松', '备战', '训练'],
    content: `半马备战训练：
• 训练周期：8-12周
• 关键：至少完成1-2次15km+长跑
• 赛前2周开始减量
• 重点：有氧耐力和节奏感训练
• 目标配速跑：10-15公里`
  },
  {
    id: 12,
    topic: '撞墙应对',
    keywords: ['撞墙', '极点', '30公里', '极限', '撞墙期'],
    content: `撞墙期应对：
• 撞墙期出现在30-35公里很正常
• 原因：糖原耗尽、配速过快
• 应对：降低配速或走一段
• 补充能量胶或运动饮料
• 心理暗示鼓励自己
• 坚持就是胜利！`
  },
  {
    id: 13,
    topic: '缓震跑鞋',
    keywords: ['缓震', '缓震跑鞋', '缓冲', '保护', '减震'],
    content: `缓震跑鞋：
• 特点：厚底、中底柔软、缓冲好
• 适合：正常足弓、大体重、初跑者
• 推荐场景：日常慢跑、长距离训练
• 优点：保护关节、减少冲击力
• 代表：Hoka Clifton、Nike Vomero、Saucony Triumph`
  },
  {
    id: 14,
    topic: '支撑跑鞋',
    keywords: ['支撑', '支撑跑鞋', '稳定', '扁平足', '内旋'],
    content: `支撑跑鞋：
• 特点：中底内侧加强、控制过度内旋
• 适合：扁平足、低足弓、过度内旋跑者
• 优点：矫正跑姿、保护膝盖
• 注意：正常足弓不需要支撑型
• 代表：Asics Kayano、Brooks Adrenaline`
  },
  {
    id: 15,
    topic: '竞速跑鞋',
    keywords: ['竞速', '碳板', '速度', '比赛', '轻量', '跑鞋'],
    content: `竞速/碳板跑鞋：
• 特点：轻量、厚底内置碳纤维板
• 适合：进阶跑者、追求速度、比赛日
• 优点：推进力强、回弹好、省力
• 注意：需要一定腿部力量
• 代表：Nike Vaporfly、Adidas Adios Pro`
  },
  {
    id: 16,
    topic: '越野跑鞋',
    keywords: ['越野', '山路', '泥地', 'trail', '抓地'],
    content: `越野跑鞋：
• 特点：防滑鞋底、加强保护、透气网面
• 适合：山路、泥地、碎石路
• 优点：抓地力强、保护脚踝
• 注意：不适合公路跑
• 选择：鞋底齿深根据路况选择`
  },
  {
    id: 10,
    topic: '跑步呼吸',
    keywords: ['呼吸', '喘气', '氧气', '腹式', '节奏'],
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
  },
  {
    id: 11,
    topic: '跑步减肥',
    keywords: ['减肥', '减脂', '瘦身', '体重', '卡路里', '燃脂'],
    content: `跑步减肥要点：
• 有氧跑步是减脂的最佳方式
• 最佳减脂心率：60-70%最大心率
• 建议时长：每次30-60分钟
• 建议频率：每周3-5次
• 跑步消耗估算：约60-80卡路里/公里

减肥跑步建议：
• 以慢跑为主，保持可对话的速度
• 跑前热身，跑后拉伸
• 配合力量训练效果更好
• 合理控制饮食，不是跑得越多越好
• 坚持最重要，不要急于求成`
  },
  {
    id: 12,
    topic: '间歇训练',
    keywords: ['间歇', 'I跑', '速度', '冲刺', 'HIIT', '高强度'],
    content: `间歇训练方法：
• 经典400米间歇：
  - 热身10分钟
  - 400m × 8-10组，每组配速比目标5K快10-20秒
  - 组间休息200m慢跑或走
  - 放松10分钟

• 亚索800训练法：
  - 用目标马拉松配速跑800米
  - 重复8-10组，组间休息时间等于跑步时间

注意事项：
• 间歇训练强度大，每周1-2次即可
• 确保充分热身
• 感觉不适立即停止
• 初学者从短距离开始循序渐进`
  },
  {
    id: 13,
    topic: '配速控制',
    keywords: ['配速', '速度', '步频', '节奏', '匀速'],
    content: `配速控制技巧：
• 配速单位：分钟/公里（min/km）
• 推荐步频：170-180步/分钟
• 轻松跑配速：比马拉松配速慢1-2分钟/公里

配速建议：
• 匀速跑是最省力的方式
• 前慢后快比前快后慢更科学
• 跟随兔子（配速员）是好方法
• 根据体感调整，不要死盯手表

配速计算：
• 想跑5分配速 → 每公里5分钟
• 想跑半马2小时 → 每公里5分41秒
• 想跑全马4小时 → 每公里5分40秒`
  },
  {
    id: 14,
    topic: '跑步营养',
    keywords: ['营养', '饮食', '蛋白质', '碳水', '维生素'],
    content: `跑步饮食指南：
【跑前饮食】
• 跑前1-2小时进食
• 以碳水化合物为主（面包、米饭、面条）
• 避免高脂肪、高纤维食物
• 适量补充水分

【跑后饮食】
• 黄金30分钟：补充碳水+蛋白质（比例3:1）
• 推荐：香蕉+牛奶、运动饮料+能量棒
• 注意补铁，预防贫血

【日常饮食】
• 均衡饮食，多吃蔬菜水果
• 补充优质蛋白质（鸡蛋、鱼、豆腐）
• 适量补充碳水化合物
• 保持充足水分，每天1.5-2升`
  },
  {
    id: 15,
    topic: '跑步天气',
    keywords: ['天气', '高温', '低温', '雨天', '雾霾', '紫外线'],
    content: `不同天气跑步建议：
【高温天气】
• 选择清晨或傍晚跑步
• 增加补水，少量多次
• 降低配速期望
• 注意防晒
• 感觉不适立即停止

【低温天气】
• 做好保暖，分层穿衣
• 热身时间延长
• 注意路面结冰
• 跑后尽快换干衣服

【雨天】
• 注意防滑
• 穿防水跑鞋和外套
• 跑后擦干身体
• 注意保暖

【雾霾天】
• AQI > 150 建议室内运动
• 佩戴口罩
• 减少户外跑步`
  },
  {
    id: 17,
    topic: '跑步装备',
    keywords: ['装备', '服装', '袜子', '腰包', '水壶', '帽子'],
    content: `跑步必备装备：
• 跑鞋：最重要，选合适类型
• 跑步袜：排汗速干，避免棉袜
• 运动内衣：提供支撑保护
可选装备：
• 手表：记录数据、监测心率
• 腰包：装手机、钥匙
• 帽子：防晒或遮雨
原则：轻便舒适、透气排汗`
  },
  {
    id: 17,
    topic: '力量训练',
    keywords: ['力量', '肌肉', '深蹲', '平板支撑', '核心', '臀肌'],
    content: `跑步者力量训练：
• 每周2-3次，每次20-30分钟
• 重点训练部位：臀肌、核心、腿部

经典动作：
• 深蹲：12-15次×3组
• 弓步蹲：每侧12次×3组
• 臀桥：15次×3组
• 平板支撑：30-60秒×3组
• 侧桥：每侧30秒×3组
• 单腿臀桥：每侧10次×3组

注意事项：
• 跑步后做力量训练效果更好
• 重量适中，多重复次数
• 注重动作质量
• 休息日也可以做力量训练`
  },
  {
    id: 18,
    topic: '比赛策略',
    keywords: ['比赛', '起跑', '补给点', '撞墙', '冲刺', '分段'],
    content: `比赛当天策略：
【起跑】
• 提前到场，熟悉环境
• 做好热身
• 起跑不要太快，按计划配速
• 前5公里是热身期

【途中】
• 保持稳定配速
• 按计划补给（不要等到渴了才喝）
• 遇到问题调整心态
• 享受比赛氛围

【撞墙应对】
• 撞墙期（30-35公里）正常现象
• 降低配速或走一段
• 补充能量胶
• 心理暗示鼓励自己

【冲刺】
• 最后5公里可加速
• 终点不要急停
• 慢走10分钟拉伸`
  },
  {
    id: 19,
    topic: '睡眠恢复',
    keywords: ['睡眠', '休息', '疲劳', '精力', '作息'],
    content: `跑步与睡眠：
• 睡眠不足会影响跑步表现和恢复
• 建议每晚7-9小时睡眠
• 大强度训练后需要更多睡眠

睡眠优化建议：
• 固定作息时间
• 睡前避免剧烈运动
• 创造舒适的睡眠环境
• 跑后可补充镁帮助放松

疲劳信号：
• 持续疲劳感
• 心率异常升高
• 免疫力下降
• 情绪低落

如出现以上情况，说明训练过度，需要增加休息。`
  },
  {
    id: 20,
    topic: '新手入门',
    keywords: ['新手', '初学', '入门', '第一次', '初级', '小白'],
    content: `跑步新手指南：
【开始跑步】
• 从快走+慢跑交替开始（走跑结合）
• 每次20-30分钟
• 跑走比例从1:2开始，逐渐增加
• 遵循"跑得舒适"原则

【循序渐进】
• 前两周：跑1分钟走2分钟，重复8-10次
• 第3-4周：跑2分钟走1分钟，重复6-8次
• 第5-6周：跑3分钟走1分钟，重复5-6次
• 第7-8周：尝试连续跑10-15分钟

【注意事项】
• 不要急于追求速度和距离
• 跑前热身，跑后拉伸
• 出现疼痛停止运动
• 给身体适应时间
• 最重要的是：坚持下去！`
  },
  {
    id: 21,
    topic: '跑步目标',
    keywords: ['目标', '5K', '10K', '半马', '全马', '完赛'],
    content: `跑步目标设定：
【距离目标】
• 5公里：初学者可在一周内完成
• 10公里：需要2-4周系统训练
• 半马（21.0975公里）：建议有3-6个月跑步基础
• 全马（42.195公里）：建议有1年以上训练经验

【配速目标】
• 入门：6-7分钟/公里
• 进阶：5-6分钟/公里
• 资深：4-5分钟/公里
• 大神：4分钟以内/公里

【训练原则】
• SMART原则：具体、可测量、可实现、相关、有时限
• 大目标拆分成小目标
• 每达成一个小目标给自己奖励
• 享受过程，不要只看结果`
  },
  {
    id: 22,
    topic: '交叉训练',
    keywords: ['交叉', '游泳', '骑车', '瑜伽', '体能', '有氧'],
    content: `交叉训练好处：
• 减少单一运动带来的伤害风险
• 锻炼不同肌肉群
• 保持运动趣味性
• 在休息日进行主动恢复

推荐交叉训练：
【游泳】
• 对关节无冲击
• 锻炼心肺功能
• 全身运动

【骑行】
• 锻炼腿部力量
• 交叉使用不同肌肉群
• 可作为跑步替代

【力量训练】
• 增强核心和下肢力量
• 提高跑步经济性

【瑜伽/拉伸】
• 提高柔韧性
• 帮助放松恢复
• 改善呼吸`
  },
  {
    id: 23,
    topic: '跑步心理',
    keywords: ['心理', '坚持', '动力', '激励', '放弃', '信心'],
    content: `跑步心理建设：
【保持动力】
• 设定明确目标
• 记录每次进步
• 加入跑步社群
• 奖励自己

【克服困难】
• 遇到平台期很正常
• 关注过程而非速度
• 允许自己有休息日
• 不要和别人比较

【比赛心理】
• 比赛前充分准备
• 想象成功画面
• 专注于自己的节奏
• 遇到困难保持冷静

【心态调整】
• 享受跑步过程
• 把它当作和自己的对话时间
• 失败是正常的，重要的是继续
• 跑步是最好的减压方式`
  },
  {
    id: 24,
    topic: '跑步APP与数据',
    keywords: ['APP', '数据', '记录', '分析', 'Garmin', 'Keep', '悦跑圈', '高驰', 'COROS', '华为', 'Fit', 'Watch', 'GT'],
    content: `跑步数据记录：
【常用APP】
• Keep：功能全面，适合新手
• 悦跑圈：跑步数据准确，社交功能强
• 咕咚：活动丰富
• Nike Run Club：界面简洁

【跑步手表】
• Garmin：专业跑步数据，生态完善
• 高驰（COROS）：国产专业手表，续航强劲，性价比高
  - COROS Apex/Vertix：专业铁三手表
  - COROS Pace：高性价比跑步手表
  - 支持训练负荷、恢复时间、跑步动态分析
• 华为（Huawei）：
  - Huawei Watch GT 系列：长续航经典，支持跑步轨迹、心率、血氧
    - GT Runner：专业跑步手表，轻量化设计
    - GT 4/5：日常运动兼顾，GPS精准
  - Huawei Watch 系列：智能全功能
    - Watch 4/5：支持心电、血氧、导航
    - Watch Fit 系列：轻便入门，适合日常跑步，屏幕大性价比高
  - 支持跑步指数、恢复时间、训练负荷分析
• Apple Watch：日常使用方便，生态整合好
• 小米/荣耀：性价比高，基础功能齐全

【关注的数据】
• 距离、配速、心率
• 步频、步幅
• 海拔、爬升
• 训练负荷

【数据复盘】
• 每周总结训练数据
• 分析配速变化趋势
• 关注心率区间的分布
• 根据数据调整训练计划`
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

例如：如果问题是"跑步时膝盖疼"，输出应该是"6"（髂胫束综合征）`

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
