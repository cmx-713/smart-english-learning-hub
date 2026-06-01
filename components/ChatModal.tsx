import React, { useState, useEffect, useRef } from 'react';
import { Message, Tool } from '../types';
import { startChatSession, sendMessageStream } from '../services/geminiService';
import { saveConversation } from '../services/saveConversation';

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeTool: Tool | null;
    user: any | null;
}

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, activeTool, user }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [iframeLoading, setIframeLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const isCozeIframe = !!(activeTool?.cozeStoreUrl);

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
            setMessages([]);
            startChatSession("You are a helpful English learning assistant. Answer questions about English grammar, vocabulary, and culture.");
            setMessages([{
                id: 'init-general',
                role: 'model',
                text: "你好！我是你的英语学习助手，有任何问题都可以问我。"
            }]);
        }
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

            const stream = sendMessageStream(userMsg.text);

            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk;
                setMessages(prev => prev.map(msg =>
                    msg.id === botMsgId ? { ...msg, text: fullText } : msg
                ));
            }

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
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>

            <div className={`relative w-full ${isCozeIframe ? 'max-w-5xl' : 'max-w-3xl'} bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex flex-col h-[90vh] overflow-hidden`}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${activeTool ? activeTool.iconBg : 'bg-primary/10'}`}>
                            <span className={`material-icons-round text-xl ${activeTool ? activeTool.iconColor : 'text-primary'}`}>
                                {activeTool ? activeTool.icon : 'smart_toy'}
                            </span>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                {activeTool ? activeTool.title : '学习助手'}
                            </h3>
                            <p className="text-xs text-slate-400">
                                {activeTool ? activeTool.category : 'AI 辅助'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                    >
                        <span className="material-icons-round text-xl">close</span>
                    </button>
                </div>

                {/* Content Area */}
                {isCozeIframe ? (
                    <div className="flex-1 relative bg-white">
                        {iframeLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10 gap-3">
                                <div className="w-8 h-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin"></div>
                                <p className="text-slate-400 text-sm">加载中...</p>
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
                    <>
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50 dark:bg-slate-900/50">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                                            ? 'bg-primary text-white rounded-tr-sm'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-sm'
                                        }`}
                                    >
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl rounded-tl-sm border border-slate-100 dark:border-slate-700 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-pulse"></span>
                                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></span>
                                        <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                    placeholder={`给${activeTool ? activeTool.title : '助手'}发消息...`}
                                    className="flex-1 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-primary/40 focus:ring-2 focus:ring-primary/20 rounded-lg px-4 py-3 text-sm dark:text-white outline-none transition-all"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={isLoading || !inputValue.trim()}
                                    className="bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center"
                                >
                                    <span className="material-icons-round text-xl">send</span>
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
