import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite 插件：在开发服务器中代理 Coze API 调用
 * 生产环境由 Cloudflare Pages Function 处理
 */
function cozeProxyPlugin(): Plugin {
  let COZE_API_KEY = '';
  let COZE_API_BASE = '';

  return {
    name: 'coze-proxy',
    configResolved(config) {
      // 从 define 中提取环境变量值（已被 JSON.stringify）
      COZE_API_KEY = (config.define?.['process.env.COZE_API_KEY'] as string || '""').replace(/^"|"$/g, '');
      COZE_API_BASE = (config.define?.['process.env.COZE_API_BASE'] as string || '"https://api.coze.com"').replace(/^"|"$/g, '');
    },
    configureServer(server) {
      server.middlewares.use('/api/coze-chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        // 读取请求体
        let body = '';
        for await (const chunk of req) {
          body += chunk.toString();
        }

        try {
          const { bot_id, user_id, message } = JSON.parse(body);

          if (!bot_id || !message) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing bot_id or message' }));
            return;
          }

          const apiUrl = `${COZE_API_BASE.replace(/\/$/, '')}/v3/chat`;
          console.log(`[coze-proxy] Calling ${apiUrl} for bot ${bot_id}`);

          const cozeRes = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${COZE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bot_id,
              user_id: user_id || 'anonymous_user',
              stream: true,
              auto_save_history: true,
              additional_messages: [
                { role: 'user', content: message, content_type: 'text' },
              ],
            }),
          });

          if (!cozeRes.ok) {
            const errText = await cozeRes.text();
            console.error(`[coze-proxy] Coze API Error ${cozeRes.status}:`, errText);
            res.statusCode = cozeRes.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Coze API Error: ${cozeRes.status}`, detail: errText }));
            return;
          }

          // 解析 SSE 流式响应
          const fullText = await cozeRes.text();
          const lines = fullText.split('\n');
          const replyParts: string[] = [];
          let currentEvent = '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.slice(6).trim();
            } else if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.slice(5).trim();
              if (!dataStr) continue;
              try {
                const eventData = JSON.parse(dataStr);
                if (currentEvent === 'conversation.message.delta' && eventData.content) {
                  replyParts.push(eventData.content);
                } else if (currentEvent === 'conversation.message.completed' && eventData.type === 'answer' && eventData.content && replyParts.length === 0) {
                  replyParts.push(eventData.content);
                }
              } catch (e) { /* ignore */ }
              currentEvent = '';
            }
          }

          const botReply = replyParts.join('') || '抱歉，智能体暂时无法回复。请稍后再试。';
          console.log(`[coze-proxy] Reply length: ${botReply.length} chars`);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ reply: botReply }));

        } catch (err: any) {
          console.error('[coze-proxy] Error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || String(err) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), cozeProxyPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.COZE_API_KEY': JSON.stringify(env.COZE_API_KEY),
      'process.env.COZE_API_BASE': JSON.stringify(env.COZE_API_BASE || 'https://api.coze.com'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});

