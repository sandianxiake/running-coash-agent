# Netlify 部署指南

## 项目配置

✅ `netlify.toml` - Netlify 配置文件
✅ `netlify/functions/coze-proxy.js` - 扣子 API 代理函数

---

## 部署步骤

### 1. 注册/登录 Netlify

访问 **https://netlify.com**
- 可以用 GitHub 账号登录
- 免费注册即可

### 2. 创建新站点

**方式 A：从 GitHub 部署（推荐）**
1. 点击 "Add new site" → "Import an existing project"
2. 选择 GitHub，授权 Netlify 访问你的仓库
3. 选择 `running-coach-agent` 仓库
4. 设置构建命令：
   - Build command: `pnpm install && pnpm vite build`
   - Publish directory: `dist`
5. 点击 "Deploy site"

**方式 B：手动部署**
1. 下载 `dist` 文件夹和 `netlify/functions` 文件夹
2. 在 Netlify 后台手动拖拽上传

### 3. 配置环境变量

在 Netlify 后台 → Site settings → Environment variables 添加：

| Key | Value |
|-----|-------|
| `COZE_TOKEN` | `cztei_hwpQD5pxgI46J7ltFeHUjBS0RvEChTPDn9R7d8vmkgJTbngskbePPXr6wfR4xoloG` |

### 4. 等待部署完成

部署成功后，Netlify 会分配一个免费域名：
`https://你的站点名.netlify.app`

---

## 验证部署

访问部署后的 URL，测试图片识别功能：
1. 上传跑步截图
2. 点击识别
3. 应该能成功返回数据（无 CORS 错误）

---

## 注意事项

1. 首次部署可能需要几分钟
2. 如果识别失败，检查 Netlify Functions 日志
3. 可以绑定自己的域名（可选）

---

## 更新代码后

如果修改了代码，只需要推送到 GitHub，Netlify 会自动重新部署。
