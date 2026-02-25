import React, { useState, useMemo, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import ToolCard from './components/ToolCard';
import ChatModal from './components/ChatModal';
import AuthModal from './components/AuthModal';
import ContactModal from './components/ContactModal';
import { supabase } from './services/supabaseClient';
import { TOOLS, CATEGORIES } from './constants';
import { Tool } from './types';

// Coze Chat SDK 全局类型声明
declare global {
    interface Window {
        CozeWebSDK?: {
            WebChatClient: new (config: any) => any;
        };
    }
}

const COZE_PAT = process.env.COZE_API_KEY || '';

const App: React.FC = () => {
    const [selectedCategory, setSelectedCategory] = useState<string>('全部');
    const [searchQuery, setSearchQuery] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isContactOpen, setIsContactOpen] = useState(false);
    const [activeTool, setActiveTool] = useState<Tool | null>(null);
    const [user, setUser] = useState<any>(null);
    const cozeChatClientRef = useRef<any>(null);

    // Check for existing session on load
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => {
            subscription.unsubscribe();
            // Cleanup Coze SDK on unmount
            if (cozeChatClientRef.current) {
                try { cozeChatClientRef.current.destroy(); } catch (e) { }
            }
        };
    }, []);

    const filteredTools = useMemo(() => {
        let tools = TOOLS;

        // Filter by Category
        if (selectedCategory !== '全部') {
            tools = tools.filter(tool => tool.category === selectedCategory);
        }

        // Filter by Search Query
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            tools = tools.filter(tool =>
                tool.title.toLowerCase().includes(lowerQuery) ||
                tool.description.toLowerCase().includes(lowerQuery)
            );
        }

        return tools;
    }, [selectedCategory, searchQuery]);

    const handleStartTool = (tool: Tool) => {
        if (!user) {
            setIsAuthOpen(true);
            return;
        }

        // If tool has an external link, open it in new tab
        if (tool.externalLink) {
            window.open(tool.externalLink, '_blank');
            return;
        }

        // If tool is a Coze bot, use Coze Chat SDK
        if (tool.cozeBotId && window.CozeWebSDK) {
            // Destroy previous Coze chat instance if exists
            if (cozeChatClientRef.current) {
                try { cozeChatClientRef.current.destroy(); } catch (e) { }
                cozeChatClientRef.current = null;
            }

            const client = new window.CozeWebSDK.WebChatClient({
                config: {
                    bot_id: tool.cozeBotId,
                },
                componentProps: {
                    title: tool.title,
                    layout: 'pc',
                    width: 800,
                    lang: 'zh-CN',
                },
                auth: {
                    type: 'token',
                    token: COZE_PAT,
                    onRefreshToken: function () {
                        return COZE_PAT;
                    }
                },
                userInfo: {
                    id: user.user_metadata?.student_id || user.email || 'anonymous',
                    name: user.user_metadata?.name || user.user_metadata?.student_id || user.email || 'Student',
                },
                ui: {
                    chatBot: {
                        title: tool.title,
                        resizable: true,
                        uploadable: true,
                    },
                    asstBtn: {
                        isNeed: true,
                    },
                    base: {
                        lang: 'zh-CN',
                    },
                    footer: {
                        isShow: false,
                    },
                },
            });

            cozeChatClientRef.current = client;

            // 自动打开聊天窗口，不需要用户手动点击小图标
            setTimeout(() => {
                try { client.showChatBot(); } catch (e) { }
            }, 300);

            return;
        }

        // Fallback: open ChatModal (Gemini or other)
        setActiveTool(tool);
        setIsChatOpen(true);
    };

    const handleOpenGeneralChat = () => {
        if (!user) {
            setIsAuthOpen(true);
            return;
        }
        setActiveTool(null);
        setIsChatOpen(true);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
    };

    return (
        <div className="min-h-screen pb-12 bg-background-light dark:bg-background-dark font-sans">
            <Navbar
                onOpenAuth={() => setIsAuthOpen(true)}
                user={user}
                onLogout={handleLogout}
                onOpenContact={() => setIsContactOpen(true)}
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

                {/* Simplified Welcome Header */}
                <div className="mb-10">
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">
                        Hello, {user?.user_metadata?.full_name || 'Student'}! 👋
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-xl font-medium">
                        准备好提升你的英语技能了吗？
                    </p>
                </div>

                {/* Compact Filter Bar */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 mb-10 flex flex-col md:flex-row items-center gap-4">
                    {/* Search Input */}
                    <div className="flex-1 w-full relative group">
                        <span className="absolute left-4 top-3 text-slate-400 material-icons-round text-2xl group-focus-within:text-primary transition-colors">search</span>
                        <input
                            type="text"
                            placeholder="搜索应用名称或关键词..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-base focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400"
                        />
                    </div>

                    <div className="hidden md:block w-px h-8 bg-slate-200 dark:bg-slate-700"></div>

                    {/* Category Dropdown */}
                    <div className="w-full md:w-56 flex-shrink-0 relative">
                        <span className="absolute left-4 top-3 text-slate-400 material-icons-round text-2xl">category</span>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full pl-12 pr-10 py-3 appearance-none bg-slate-50 md:bg-transparent dark:bg-slate-900 dark:md:bg-transparent border-none rounded-xl text-base font-medium focus:ring-2 focus:ring-primary/20 transition-all outline-none cursor-pointer text-slate-700 dark:text-slate-200"
                        >
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <span className="absolute right-4 top-3 text-slate-400 material-icons-round pointer-events-none text-2xl">expand_more</span>
                    </div>
                </div>

                {/* Results Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">学习工具</h3>
                        <span className="px-4 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-bold">
                            共 {filteredTools.length} 个作品
                        </span>
                    </div>
                </div>

                {/* Grid */}
                {filteredTools.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-8">
                        {filteredTools.map(tool => (
                            <ToolCard key={tool.id} tool={tool} onStart={handleStartTool} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-24 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                        <span className="material-icons-round text-6xl text-slate-300 mb-6">search_off</span>
                        <p className="text-slate-500 text-lg">未找到匹配的工具。</p>
                        <button
                            onClick={() => { setSelectedCategory('全部'); setSearchQuery(''); }}
                            className="mt-6 text-primary font-bold hover:underline text-lg"
                        >
                            清除筛选
                        </button>
                    </div>
                )}
            </main>


            <ChatModal
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                activeTool={activeTool}
                user={user}
            />

            <AuthModal
                isOpen={isAuthOpen}
                onClose={() => setIsAuthOpen(false)}
                onLoginSuccess={(u) => {
                    setUser(u);
                    setIsAuthOpen(false);
                }}
            />

            <ContactModal
                isOpen={isContactOpen}
                onClose={() => setIsContactOpen(false)}
            />
        </div>
    );
};

export default App;