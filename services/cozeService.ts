// 个人访问令牌（PAT）：在扣子开放平台「授权」→「个人访问令牌」中创建
// 国内扣子 coze.cn 需在环境变量中设置 COZE_API_BASE=https://api.coze.cn
const COZE_API_KEY = process.env.COZE_API_KEY || '';
const COZE_API_BASE = process.env.COZE_API_BASE || 'https://api.coze.com';
const COZE_API_URL = `${COZE_API_BASE.replace(/\/$/, '')}/v3/chat`;

export const sendCozeMessageStream = async function* (
    botId: string, 
    userId: string, 
    message: string
): AsyncGenerator<string, void, unknown> {
    
    try {
        const response = await fetch(COZE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${COZE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bot_id: botId,
                user_id: userId,
                stream: true,
                auto_save_history: true,
                additional_messages: [
                    {
                        role: 'user',
                        content: message,
                        content_type: 'text'
                    }
                ]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Coze API Error:', err);
            yield "Error connecting to Coze agent.";
            return;
        }

        if (!response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            
            // Process all complete lines
            buffer = lines.pop() || ""; 

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith("data:")) {
                    const dataStr = trimmedLine.slice(5).trim();
                    if (!dataStr) continue;
                    
                    try {
                        const eventData = JSON.parse(dataStr);
                        
                        // Handle Coze V3 streaming events
                        if (eventData.event === "conversation.message.delta") {
                            // Extract content delta
                            if (eventData.data?.content) {
                                yield eventData.data.content;
                            }
                        } else if (eventData.event === "conversation.message.completed") {
                             // Message finished
                             // Sometimes completed event has final text if delta was missed
                        }
                    } catch (e) {
                        // ignore parsing errors for keep-alive or non-json lines
                    }
                }
            }
        }

    } catch (error) {
        console.error("Coze Service Error:", error);
        yield "I'm having trouble connecting right now.";
    }
};