<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1uR4XxmbHg29IwMYBxo36RsPW90Qm8JEl

## 本地运行 (Run Locally)

**环境要求：** Node.js（建议 18+）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录新建 `.env.local`（或编辑已有），按需填写：

```env
# 必填：站内 Gemini 对话（通用助手、未配置扣子的工具）
GEMINI_API_KEY=你的_Gemini_API_Key

# 可选：扣子智能体（在 constants.ts 里填了 cozeBotId 的工具才需要）
COZE_API_KEY=你的扣子个人访问令牌
# 国内扣子用 coze.cn 时加上下一行
COZE_API_BASE=https://api.coze.cn

# 可选：Supabase 登录（不配则登录/注册不可用）
SUPABASE_URL=你的_Supabase_项目_URL
SUPABASE_KEY=你的_Supabase_anon_key

# 方案A（跳转到扣子官网后，定时同步到 Supabase）可选：
# 逗号分隔，填你要同步的扣子 Bot ID
COZE_SYNC_BOT_IDS=7498549748861763619
# conversations 表所在 schema（默认 public）
SUPABASE_CONVERSATIONS_SCHEMA=public
```

### 3. 启动开发服务器

```bash
npm run dev
```

浏览器打开 **http://localhost:3000** 即可。

---

### 其他命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 生产构建，输出到 `dist/` |
| `npm run preview` | 本地预览构建后的静态站（需先 `npm run build`） |
