/**
 * Coze 智能体对话服务
 *
 * 通过 Netlify Function 代理调用 Coze API，避免浏览器端 CORS 限制。
 * 前端 → /.netlify/functions/coze-chat → api.coze.cn → 返回回复
 */

const COZE_PROXY_URL = '/api/coze-chat';

export const sendCozeMessageStream = async function* (
    botId: string,
    userId: string,
    message: string
): AsyncGenerator<string, void, unknown> {

    try {
        const response = await fetch(COZE_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bot_id: botId,
                user_id: userId,
                message: message,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Coze Proxy Error:', response.status, errText);
            yield '连接扣子智能体失败，请稍后再试。';
            return;
        }

        const data = await response.json();

        if (data.reply) {
            yield data.reply;
        } else {
            yield '抱歉，智能体暂时无法回复。';
        }

    } catch (error) {
        console.error('Coze Service Error:', error);
        yield '网络连接出现问题，请检查网络后重试。';
    }
};