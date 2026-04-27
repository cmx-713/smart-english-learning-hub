import { supabase } from './supabaseClient';

const db = supabase.schema('english_hub');

/**
 * 记录一次页面访问。
 * 每次用户登录后首次挂载时调用，fire-and-forget，不影响主流程。
 */
export async function trackPageView(userId: string): Promise<void> {
    db
        .from('page_views')
        .insert({ user_id: userId })
        .then(({ error }) => {
            if (error) console.warn('[tracking] trackPageView failed:', error.message);
        });
}

/**
 * 记录一次智能体调用。
 * 用户点击「开始」打开工具时调用，fire-and-forget，不影响主流程。
 */
export async function trackAgentCall(
    userId: string,
    agentId: string,
    agentTitle: string
): Promise<void> {
    db
        .from('agent_calls')
        .insert({ user_id: userId, agent_id: agentId, agent_title: agentTitle })
        .then(({ error }) => {
            if (error) console.warn('[tracking] trackAgentCall failed:', error.message);
        });
}
