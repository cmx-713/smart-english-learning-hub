/**
 * 将单轮对话（用户输入 + 机器人回复）保存到 Supabase，由 Netlify Function 写入。
 * 用于扣子 / Gemini 等智能体交互记录的双写（扣子后台 + 本站数据库）。
 */

export interface SaveConversationPayload {
    student_id: string;
    agent_id: string;
    user_input: string;
    bot_reply: string;
    accuracy?: number | null;
}

const NETLIFY_FUNCTION_URL = '/.netlify/functions/save-conversation';

export async function saveConversation(payload: SaveConversationPayload): Promise<void> {
    const res = await fetch(NETLIFY_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            student_id: payload.student_id,
            agent_id: payload.agent_id,
            user_input: payload.user_input,
            bot_reply: payload.bot_reply,
            accuracy: payload.accuracy ?? null,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`保存对话失败: ${res.status} ${text}`);
    }
}
