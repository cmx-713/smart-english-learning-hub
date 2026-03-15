/**
 * Cloudflare Pages Function: 为每个学生签发带有 session_name 的 JWT Token
 * 路径: /api/coze-token
 * 
 * 此函数负责:
 * 1. 接收前端传来的 user_id
 * 2. 使用 RSA 私钥签署包含 session_name 的 JWT
 * 3. 调用扣子 OAuth API 换取临时 access_token
 * 4. 返回临时 token 给前端（用于初始化 Chat SDK）
 */

interface Env {
    COZE_OAUTH_CLIENT_ID: string;
    COZE_PRIVATE_KEY: string;
    COZE_PUBLIC_KEY_ID: string;
}

// ============================================================
// 工具函数
// ============================================================

function base64UrlEncode(data: string | ArrayBuffer): string {
    let base64: string;
    if (typeof data === 'string') {
        base64 = btoa(data);
    } else {
        const bytes = new Uint8Array(data);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        base64 = btoa(binary);
    }
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateJti(): string {
    // 生成随机字符串作为 JWT ID，防止重放攻击
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
    // 清理 PEM 格式：移除头尾标记和换行
    const pemContent = pem
        .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, '')
        .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, '')
        .replace(/\s+/g, '');

    // 将 base64 解码为 ArrayBuffer
    const binaryString = atob(pemContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return crypto.subtle.importKey(
        'pkcs8',
        bytes.buffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );
}

async function createSignedJwt(
    clientId: string,
    privateKeyPem: string,
    publicKeyId: string,
    sessionName: string
): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const header = {
        alg: 'RS256',
        typ: 'JWT',
        kid: publicKeyId,
    };

    const payload = {
        iss: clientId,
        aud: 'api.coze.cn',
        iat: now,
        exp: now + 3600, // 1 小时有效期
        jti: generateJti(),
        session_name: sessionName,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const privateKey = await importPrivateKey(privateKeyPem);
    const signature = await crypto.subtle.sign(
        { name: 'RSASSA-PKCS1-v1_5' },
        privateKey,
        new TextEncoder().encode(signingInput)
    );

    const encodedSignature = base64UrlEncode(signature);
    return `${signingInput}.${encodedSignature}`;
}

// ============================================================
// 主请求处理函数
// ============================================================

export const onRequestPost: PagesFunction<Env> = async (context) => {
    // CORS 头
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    try {
        const body = await context.request.json() as { user_id?: string };
        const userId = body.user_id;

        if (!userId) {
            return new Response(
                JSON.stringify({ error: 'user_id is required' }),
                { status: 400, headers: corsHeaders }
            );
        }

        const clientId = context.env.COZE_OAUTH_CLIENT_ID;
        const privateKeyPem = context.env.COZE_PRIVATE_KEY;
        const publicKeyId = context.env.COZE_PUBLIC_KEY_ID;

        if (!clientId || !privateKeyPem || !publicKeyId) {
            console.error('[coze-token] Missing environment variables');
            return new Response(
                JSON.stringify({ error: 'Server configuration error' }),
                { status: 500, headers: corsHeaders }
            );
        }

        // 1. 签署 JWT
        const jwt = await createSignedJwt(clientId, privateKeyPem, publicKeyId, userId);

        // 2. 用 JWT 换取 access_token
        const tokenResponse = await fetch('https://api.coze.cn/api/permission/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
            },
            body: JSON.stringify({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                duration_seconds: 86400, // 24 小时有效
            }),
        });

        const tokenData = await tokenResponse.json() as any;

        if (!tokenResponse.ok || !tokenData.access_token) {
            console.error('[coze-token] Token exchange failed:', JSON.stringify(tokenData));
            return new Response(
                JSON.stringify({
                    error: 'Failed to get access token',
                    detail: tokenData.msg || tokenData.message || tokenData.error_message || 'Unknown error',
                }),
                { status: 500, headers: corsHeaders }
            );
        }

        // 3. 返回 access_token 给前端
        return new Response(
            JSON.stringify({
                access_token: tokenData.access_token,
                expires_in: tokenData.expires_in,
            }),
            { status: 200, headers: corsHeaders }
        );

    } catch (err: any) {
        console.error('[coze-token] Error:', err);
        return new Response(
            JSON.stringify({ error: err.message || 'Internal server error' }),
            { status: 500, headers: corsHeaders }
        );
    }
};

// 处理 OPTIONS 预检请求
export const onRequestOptions: PagesFunction = async () => {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
};
