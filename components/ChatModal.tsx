import React, { useState, useEffect, useRef } from 'react';
import { Message, Tool } from '../types';
import { startChatSession, sendMessageStream } from '../services/geminiService';
import { saveConversation } from '../services/saveConversation';

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeTool: Tool | null;
    user: any | null; // Pass supabase user
}

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, activeTool, user }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [iframeLoading, setIframeLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 判断是否使用 iframe 模式（扣子智能体）
    const isCozeIframe = !!(activeTool?.cozeStoreUrl);

    // Initialize chat when tool changes or modal opens (only for non-iframe mode)
    useEffect(() => {
        if (isOpen && activeTool && !isCozeIframe) {
            setMessages([]);
            startChatSession(activeTool.systemInstruction);
            setMessages([{
                id: 'init-greeting',
                role: 'model',
                text: `你好！我是你的${activeTool.title}。今天有什么可以帮你的吗？`
            }]);
        } else if (isOpen && !activeTool) {
            // General assistant fallback (Gemini)
            setMessages([]);
            startChatSession("You are a helpful English learning assistant. Answer questions about English grammar, vocabulary, and culture.");
            setMessages([{
                id: 'init-general',
                role: 'model',
                text: "嗨！我是你的英语学习助手。有什么问题都可以问我！"
            }]);
        }
        // Reset iframe loading state
        if (isOpen && isCozeIframe) {
            setIframeLoading(true);
        }
    }, [isOpen, activeTool]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: inputValue
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            const botMsgId = (Date.now() + 1).toString();
            setMessages(prev => [...prev, { id: botMsgId, role: 'model', text: '' }]);

            // Gemini only (Coze bots use iframe)
            const stream = sendMessageStream(userMsg.text);

            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk;
                setMessages(prev => prev.map(msg =>
                    msg.id === botMsgId ? { ...msg, text: fullText } : msg
                ));
            }

            // 将本轮对话写入 Supabase
            if (user && fullText) {
                const studentId = user.user_metadata?.student_id || user.id;
                const agentId = activeTool?.id || 'general';
                saveConversation({
                    student_id: String(studentId),
                    agent_id: agentId,
                    user_input: userMsg.text,
                    bot_reply: fullText,
                }).catch((err) => console.warn('保存对话到 Supabase 失败:', err));
            }
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { id: 'err', role: 'model', text: '抱歉，服务暂时不可用。' }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

            <div className={`relative w-full ${isCozeIframe ? 'max-w-5xl' : 'max-w-3xl'} bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${activeTool ? activeTool.iconBg : 'bg-primary/10'}`}>
                            <span className={`material-icons-round text-2xl ${activeTool ? activeTool.iconColor : 'text-primary'}`}>
                                {activeTool ? activeTool.icon : 'smart_toy'}
                            </span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {activeTool ? activeTool.title : '学习助手'}
                                </h3>
                                {isCozeIframe && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                        COZE Powered
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {isCozeIframe ? '智能辅导' : (activeTool ? '专业解答' : '专属学习助手')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors"
                    >
                        <span className="material-icons-round text-2xl">close</span>
                    </button>
                </div>

                {/* Content Area: iframe or Chat */}
                {isCozeIframe ? (
                    /* ─── Coze iframe 嵌入模式 ─── */
                    <div className="flex-1 relative bg-white">
                        {iframeLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10">
                                <div className="flex gap-2 items-center mb-4">
                                    <div className="w-3 h-3 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-3 h-3 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-3 h-3 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                                <p className="text-slate-500 text-base">正在加载工具...</p>
                            </div>
                        )}
                        <iframe
                            src={activeTool!.cozeStoreUrl}
                            className="w-full h-full border-0"
                            allow="microphone; clipboard-write"
                            onLoad={() => setIframeLoading(false)}
                            title={activeTool!.title}
                        />
                    </div>
                ) : (
                    /* ─── Gemini 自定义聊天模式 ─── */
                    <>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-900/50">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-2xl p-4 text-base leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                                            ? 'bg-primary text-white rounded-tr-sm'
                                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm border border-slate-100 dark:border-slate-700 rounded-tl-sm'
                                            }`}
                                    >
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 dark:border-slate-700 flex gap-2 items-center">
                                        <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2.5 h-2.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-6 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                    placeholder={`给${activeTool ? activeTool.title : '助手'}发消息...`}
                                    className="flex-1 bg-slate-100 dark:bg-slate-900 border-0 focus:ring-2 focus:ring-primary/50 rounded-xl px-5 py-4 text-base dark:text-white"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={isLoading || !inputValue.trim()}
                                    className="bg-primary hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl transition-colors shadow-lg shadow-primary/20 flex items-center justify-center"
                                >
                                    <span className="material-icons-round text-2xl">send</span>
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatModal;