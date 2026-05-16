## 项目概述
跑步教练 Agent - 基于智能体的跑步教练应用，提供跑步计划制定、进度追踪、个性化建议等功能。

## 技术栈
- **前端框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **状态管理**: Pinia
- **UI 组件库**: Vant (移动端组件)
- **图表库**: ECharts
- **包管理器**: pnpm

## 目录结构
```
running-coach-agent/
├── .coze                    # 子项目配置
├── index.html               # HTML 入口
├── package.json             # 依赖配置
├── vite.config.ts           # Vite 配置
├── tsconfig.json            # TypeScript 配置
├── scripts/                 # 构建和运行脚本
│   ├── build.sh             # 部署构建脚本
│   ├── run.sh               # 部署运行脚本
│   ├── coze-preview-build.sh # 预览构建脚本
│   └── coze-preview-run.sh   # 预览运行脚本
└── src/                     # 源码目录
    ├── main.ts              # 主入口
    ├── App.vue             # 根组件（带图表和流式输出）
    ├── agent/              # Agent 核心模块
    │   ├── core.ts         # 智能体核心（支持流式）
    │   ├── memory.ts       # 记忆系统
    │   ├── types.ts        # 类型定义
    │   └── tools/          # 工具模块
    │       ├── registry.ts # 工具注册
    │       ├── rag.ts      # 知识检索（支持外部API）
    │       ├── records.ts  # 跑步记录（localStorage）
    │       ├── plan.ts     # 训练计划（localStorage）
    │       └── user.ts     # 用户资料（localStorage）
    ├── api/                # API 接口
    │   ├── agent.ts        # 通义千问 API
    │   ├── search.ts       # 搜索服务（内置+外部）
    │   └── coze.ts         # 扣子工作流 API（图片识别）
    ├── store/              # 状态管理
    │   └── storage.ts      # localStorage 持久化
    └── views/              # 页面视图
```

## 关键入口 / 核心模块
- **HTML 入口**: `index.html`
- **前端入口**: `src/main.ts`
- **Agent 核心**: `src/agent/core.ts` - 智能体核心逻辑（流式输出）
- **工具模块**: `src/agent/tools/` - 包含 plan, rag, records, user 等工具
- **持久化**: `src/store/storage.ts` - localStorage 统一存储
- **搜索服务**: `src/api/search.ts` - 内置知识库 + 通义千问 API

## 运行与预览
- **开发预览**: `bash scripts/coze-preview-run.sh` 或 `pnpm exec vite --host 0.0.0.0 --port 5000`
- **生产构建**: `pnpm vite build`
- **部署运行**: `serve dist -p 5000 -s` (静态服务)

## Coze 平台配置

### 目录结构
```
/workspace/projects/           # 工作区根目录
├── .coze                      # 根配置（Coze 平台入口）
└── running-coash-agent/       # Git 仓库根目录
    ├── .coze                  # 子项目配置
    └── ...
```

### 根 .coze 配置
- 路径: `/workspace/projects/.coze`
- 不提交到 Git（已在 `.gitignore` 中排除）
- 包含 `[dev]` 和 `[deploy]` 配置

### 环境变量（部署时）
```
VITE_DEEPSEEK_API_KEY = sk-9efc53fac08d4369b3d26b1ae37eb7ea
```

### 预览脚本
- `scripts/coze-preview-build.sh`: 安装依赖
- `scripts/coze-preview-run.sh`: 启动 Vite 开发服务器（端口 5000）

### 部署脚本
- `scripts/build.sh`: 生产构建（支持环境变量注入）
- `scripts/run.sh`: 生产运行（serve 静态服务，端口 5000）

## 已实现功能

### 1. localStorage 持久化存储
- 用户资料、跑步记录、训练计划、目标、偏好设置
- 统一存储管理模块 `src/store/storage.ts`
- 数据统计功能

### 2. 外部知识 API
- 内置跑步知识库（10个主题）
- 通义千问 API 智能问答
- 智能降级机制

### 3. 流式输出
- Agent 支持 `processStream()` 方法
- 前端实时显示 AI 回复
- 工具调用进度展示

### 4. 训练计划和跑步数据图表
- 周跑量柱状图
- 配速趋势折线图
- 训练计划进度饼图
- 数据统计卡片

### 5. 扣子工作流图片识别
- 上传跑步截图，自动识别跑步数据
- 调用扣子工作流 `img_reg` (workflow_id: 7639997536598278163)
- 支持多图批量识别
- 识别结果自动存入 localStorage
- **需要配置**: 用户需在 localStorage 中设置 `coze_token`（扣子个人访问令牌）

## 用户偏好与长期约束
- 使用 pnpm 管理依赖，禁止 npm 或 yarn
- 预览和部署端口统一为 5000
- 预览服务使用 Vite dev server，部署使用静态服务
- 移动端适配使用 postcss-px-to-viewport (375px 基准)
- localStorage 作为默认存储，重启会丢失数据

## 常见问题和预防
- 确保 node_modules 已安装后再执行构建
- 预览脚本基于脚本位置推导项目目录，无需额外 workdir
- 构建脚本会自动安装依赖并执行 Vite build
- 配置 VITE_QWEN_API_KEY 环境变量以启用 AI 功能
