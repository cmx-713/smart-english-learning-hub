import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// ============================================================
// JWT 签名工具函数（本地开发用）
// ============================================================

function base64UrlEncode(data: string | Buffer): string {
  const base64 = typeof data === 'string'
    ? Buffer.from(data).toString('base64')
    : data.toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createSignedJwtNode(
  clientId: string,
  privateKeyPem: string,
  publicKeyId: string,
  sessionName: string
): Promise<string> {
  const crypto = await import('crypto');
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT', kid: publicKeyId };
  const payload = {
    iss: clientId,
    aud: 'api.coze.cn',
    iat: now,
    exp: now + 3600,
    jti: crypto.randomUUID(),
    session_name: sessionName,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(privateKeyPem);
  const encodedSignature = base64UrlEncode(signature);

  return `${signingInput}.${encodedSignature}`;
}

// ============================================================
// Vite 插件：本地开发用 Coze Token 代理
// ============================================================

function cozeTokenProxyPlugin(): Plugin {
  let COZE_OAUTH_CLIENT_ID = '';
  let COZE_PRIVATE_KEY = '';
  let COZE_PUBLIC_KEY_ID = '';

  return {
    name: 'coze-token-proxy',
    configResolved(config) {
      COZE_OAUTH_CLIENT_ID = (config.define?.['process.env.COZE_OAUTH_CLIENT_ID'] as string || '""').replace(/^"|"$/g, '');
      COZE_PUBLIC_KEY_ID = (config.define?.['process.env.COZE_PUBLIC_KEY_ID'] as string || '""').replace(/^"|"$/g, '');

      // 尝试从环境变量或文件中读取私钥
      const envKey = (config.define?.['process.env.COZE_PRIVATE_KEY'] as string || '""').replace(/^"|"$/g, '');
      if (envKey && envKey.includes('BEGIN')) {
        COZE_PRIVATE_KEY = envKey.replace(/\\n/g, '\n');
      } else {
        // 尝试从项目根目录的 private_key.pem 文件读取
        const pemPath = path.resolve(__dirname, 'private_key.pem');
        if (fs.existsSync(pemPath)) {
          COZE_PRIVATE_KEY = fs.readFileSync(pemPath, 'utf-8');
          console.log('[coze-token-proxy] Loaded private key from private_key.pem');
        }
      }
    },
    configureServer(server) {
      server.middlewares.use('/api/coze-token', async (req, res) => {
        // 处理 CORS 预检
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        let body = '';
        for await (const chunk of req) {
          body += chunk.toString();
        }

        try {
          const { user_id } = JSON.parse(body);

          if (!user_id) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'user_id is required' }));
            return;
          }

          if (!COZE_OAUTH_CLIENT_ID || !COZE_PRIVATE_KEY || !COZE_PUBLIC_KEY_ID) {
            console.error('[coze-token-proxy] Missing config. Ensure COZE_OAUTH_CLIENT_ID, COZE_PUBLIC_KEY_ID are in .env.local and private_key.pem exists.');
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Server configuration error' }));
            return;
          }

          // 1. 签署 JWT
          console.log(`[coze-token-proxy] Signing JWT for user: ${user_id}`);
          const jwt = await createSignedJwtNode(COZE_OAUTH_CLIENT_ID, COZE_PRIVATE_KEY, COZE_PUBLIC_KEY_ID, user_id);

          // 2. 用 JWT 换取 access_token
          const tokenResponse = await fetch('https://api.coze.cn/api/permission/oauth2/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwt}`,
            },
            body: JSON.stringify({
              grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
              duration_seconds: 86400,
            }),
          });

          const tokenData = await tokenResponse.json() as any;

          if (!tokenResponse.ok || !tokenData.access_token) {
            console.error('[coze-token-proxy] Token exchange failed:', JSON.stringify(tokenData));
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Token exchange failed', detail: tokenData.msg || tokenData.message || tokenData.error_message }));
            return;
          }

          console.log(`[coze-token-proxy] Token obtained for user: ${user_id}, expires_in: ${tokenData.expires_in}s`);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            access_token: tokenData.access_token,
            expires_in: tokenData.expires_in,
          }));

        } catch (err: any) {
          console.error('[coze-token-proxy] Error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || String(err) }));
        }
      });
    },
  };
}

/**
 * Vite 插件：在开发服务器中代理 Coze API 调用（保留旧的聊天代理）
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
    plugins: [react(), cozeTokenProxyPlugin(), cozeProxyPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.COZE_API_KEY': JSON.stringify(env.COZE_API_KEY),
      'process.env.COZE_API_BASE': JSON.stringify(env.COZE_API_BASE || 'https://api.coze.com'),
      'process.env.COZE_OAUTH_CLIENT_ID': JSON.stringify(env.COZE_OAUTH_CLIENT_ID || ''),
      'process.env.COZE_PUBLIC_KEY_ID': JSON.stringify(env.COZE_PUBLIC_KEY_ID || ''),
      'process.env.COZE_PRIVATE_KEY': JSON.stringify(env.COZE_PRIVATE_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});

