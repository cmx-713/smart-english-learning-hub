# Supabase 没有数据 - 排查说明

对话保存到 Supabase 依赖「前端 → Netlify Function → Supabase」整条链路，任一步失败都会导致库里没有数据。

---

## 1. 确认表已创建

Supabase 里必须有 `conversations` 表，且字段与代码一致。

- 打开 Supabase 控制台 → **Table Editor**，看是否有 **conversations** 表。
- 若没有，在 **SQL Editor** 中执行：[supabase-conversations-table.sql](./supabase-conversations-table.sql) 中的建表语句。

表至少需要字段：`student_id`、`agent_id`、`user_input`、`bot_reply`、`accuracy`（可空）。

---

## 2. 本地运行不会写入 Supabase

本地执行 `npm run dev` 时，请求会发到 `http://localhost:3000/.netlify/functions/save-conversation`，本地没有 Netlify 函数，会 **404**，所以**本地不会保存任何数据**。

- 要在本地也写入 Supabase：在项目根目录执行 **`netlify dev`**（需先安装 Netlify CLI：`npm i -g netlify-cli`），再用浏览器访问它给出的本地地址（如 http://localhost:8888）。
- 或直接使用已部署的 Netlify 站点：在线上环境对话，数据会写到 Supabase。

---

## 3. Netlify 环境变量

在 Netlify 站点的 **Site settings → Environment variables** 中必须配置：

| 变量名 | 说明 |
|--------|------|
| `SUPABASE_URL` | Supabase 项目 URL（如 https://xxx.supabase.co） |
| `SUPABASE_SERVICE_ROLE_KEY` | 项目 Settings → API 里的 **service_role** key（不要用 anon key） |

若表在**自定义 schema**（如 `english_hub`），再增加：

| 变量名 | 值 |
|--------|-----|
| `SUPABASE_CONVERSATIONS_SCHEMA` | 如 `english_hub` |

改完环境变量后需**重新部署**一次，函数才会读到新值。

---

## 4. 表名 / Schema 曾写错（已修复）

之前 Function 里使用了 `.from('english_hub.conversations')`，Supabase 客户端不支持这种写法，会导致插入失败。

当前逻辑已改为：

- 默认使用 **public** schema 下的 **conversations** 表。
- 若表在自定义 schema，通过环境变量 **SUPABASE_CONVERSATIONS_SCHEMA** 指定（如 `english_hub`）。

---

## 5. 只有登录用户的对话才会保存

前端逻辑是：**仅当用户已登录且 AI 返回了内容时** 才调用保存接口。

- 未登录时对话不会保存。
- 先完成注册/登录，再在站内进行对话，才会往 Supabase 写记录。

---

## 6. 如何确认是否在写入

1. **Netlify**：Deploy 后在该站点对话几次（确保已登录），然后到 Supabase **Table Editor** 打开 **conversations** 表，看是否有新行。
2. **Netlify 日志**：在 Netlify 控制台 → **Functions** → 选中 `save-conversation` → 查看 **Logs**，看是否有 500 或报错信息。
3. **浏览器控制台**：对话结束后看是否有 `保存对话到 Supabase 失败` 的 console 报错；有则说明请求已发但后端或 Supabase 报错。

按上述步骤检查后，通常就能看到 Supabase 中有新数据；若仍没有，可根据 Netlify Function 的报错信息再排查。

---

## 7. 方案A（跳转扣子官网后定时同步）专项检查

如果你用的是 `externalLink` 跳转扣子官网，数据不是实时写入，而是由定时函数 `sync-coze-conversations` 拉取后写入。

请确认：

- [ ] Netlify 环境变量已配置 `COZE_SYNC_BOT_IDS`（逗号分隔 Bot ID）
- [ ] `COZE_API_KEY` / `COZE_API_BASE` 正确
- [ ] Supabase 已建 `coze_sync_state` 表（见 `supabase-conversations-table.sql`）
- [ ] Netlify Functions 页面能看到 `sync-coze-conversations`，并有成功执行日志（200）

可手动触发验证：在 Netlify Functions 页面执行 `sync-coze-conversations` 一次，然后查看 `conversations` 是否新增记录。
