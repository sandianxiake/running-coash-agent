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
    ├── App.vue             # 根组件
    ├── agent/              # Agent 核心模块
    ├── api/                # API 接口
    ├── models/             # 数据模型
    ├── store/              # 状态管理
    └── views/              # 页面视图
```

## 关键入口 / 核心模块
- **HTML 入口**: `index.html`
- **前端入口**: `src/main.ts`
- **Agent 核心**: `src/agent/core.ts` - 智能体核心逻辑
- **工具模块**: `src/agent/tools/` - 包含 plan, rag, records, user 等工具

## 运行与预览
- **开发预览**: `pnpm exec vite --host 0.0.0.0 --port 5000`
- **生产构建**: `pnpm vite build`
- **部署运行**: `serve dist -p 5000 -s` (静态服务)

## 用户偏好与长期约束
- 使用 pnpm 管理依赖，禁止 npm 或 yarn
- 预览和部署端口统一为 5000
- 预览服务使用 Vite dev server，部署使用静态服务
- 移动端适配使用 postcss-px-to-viewport (375px 基准)

## 常见问题和预防
- 确保 node_modules 已安装后再执行构建
- 预览脚本基于脚本位置推导项目目录，无需额外 workdir
- 构建脚本会自动安装依赖并执行 Vite build
