import React, { useState, useMemo, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import ToolCard from './components/ToolCard';
import ChatModal from './components/ChatModal';
import AuthModal from './components/AuthModal';
import ContactModal from './components/ContactModal';
import AdminDashboard from './components/AdminDashboard';
import { supabase } from './services/supabaseClient';
import { trackPageView, trackAgentCall } from './services/trackingService';
import { TOOLS, CATEGORIES } from './constants';
import { Tool } from './types';

const getGreetingMessage = (): string => {
    const hour = new Date().getHours();
    if (hour < 6)  return '深夜也是学习时光，坚持就是进步';
    if (hour < 12) return '早上好，今天的英语练习开始了吗？';
    if (hour < 14) return '午后来练一练，积累比突击更有效';
    if (hour < 18) return '下午是学语言的好时段，来练一练';
    if (hour < 21) return '晚上来提升一下英语实力吧';
    return '夜深了，学一会儿英语再休息？';
};

const CATEGORY_ICONS: Record<string, string> = {
    '全部': 'grid_view',
    '互动游戏': 'sports_esports',
    '阅读理解': 'menu_book',
    '口语训练': 'record_voice_over',
    '语法学习': 'spellcheck',
    '听力训练': 'headphones',
    '写作辅助': 'edit_note',
    '词汇学习': 'school',
};

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
    const [authInitialView, setAuthInitialView] = useState<'login' | 'register'>('login');
    const [isContactOpen, setIsContactOpen] = useState(false);
    const [isAdminOpen, setIsAdminOpen] = useState(false);
    const [activeTool, setActiveTool] = useState<Tool | null>(null);
    const [user, setUser] = useState<any>(null);
    const cozeChatClientRef = useRef<any>(null);
    const pageViewTrackedRef = useRef<string | null>(null); // track which userId already recorded

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

    // Track page view once per session when user is set
    useEffect(() => {
        if (user && pageViewTrackedRef.current !== user.id) {
            pageViewTrackedRef.current = user.id;
            trackPageView(user.id);
        }
    }, [user]);

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

    // Token 缓存: 存储每个用户的 access_token，避免每次都请求
    const cozeTokenCacheRef = useRef<{ token: string; expiresAt: number } | null>(null);

    // 从后端获取基于 JWT 的用户专属 Token
    const fetchCozeToken = async (userId: string): Promise<string> => {
        // 如果缓存的 token 还没过期，直接使用
        const cached = cozeTokenCacheRef.current;
        if (cached && Date.now() < cached.expiresAt) {
            return cached.token;
        }

        try {
            const response = await fetch('/api/coze-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[App] Failed to fetch Coze token:', errorData);
                throw new Error(errorData.error || 'Failed to fetch token');
            }

            const data = await response.json();
            // 缓存 token，提前 5 分钟过期（防止边界情况）
            cozeTokenCacheRef.current = {
                token: data.access_token,
                expiresAt: Date.now() + (data.expires_in - 300) * 1000,
            };
            return data.access_token;
        } catch (err) {
            console.error('[App] Token fetch error, falling back to PAT:', err);
            // 降级使用 PAT（如果后端未配置 JWT 凭证）
            return COZE_PAT;
        }
    };

    const handleStartTool = async (tool: Tool) => {
        if (!user) {
            setAuthInitialView('login');
            setIsAuthOpen(true);
            return;
        }

        // Track agent call
        trackAgentCall(user.id, tool.id, tool.title);

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

            // 获取该用户的专属 Token（JWT 签名 + session_name 隔离）
            const userId = user.id || user.user_metadata?.student_id || 'anonymous';
            const cozeToken = await fetchCozeToken(userId);

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
                    token: cozeToken,
                    onRefreshToken: async function () {
                        // Token 过期时自动刷新
                        cozeTokenCacheRef.current = null; // 清除缓存
                        return await fetchCozeToken(userId);
                    }
                },
                userInfo: {
                    id: userId,
                    name: user.user_metadata?.full_name
                        ? `${user.user_metadata.full_name}(${user.user_metadata.student_id || ''})`
                        : (user.user_metadata?.student_id || 'Student'),
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
            setAuthInitialView('login');
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
        <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans">
            <Navbar
                onOpenAuth={(mode = 'login') => { setAuthInitialView(mode); setIsAuthOpen(true); }}
                user={user}
                onLogout={handleLogout}
                onOpenContact={() => setIsContactOpen(true)}
                onOpenAdmin={() => setIsAdminOpen(true)}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex gap-0">

                    {/* ── 左侧导航栏（桌面端）── */}
                    <aside className="hidden lg:flex flex-col w-52 xl:w-56 shrink-0 py-7 pr-6 sticky top-16 self-start h-[calc(100vh-64px)] overflow-y-auto">
                        {/* 搜索框 */}
                        <div className="relative mb-5">
                            <span className="absolute left-3 top-2.5 text-slate-400 material-icons-round text-[17px]">search</span>
                            <input
                                type="text"
                                placeholder="搜索工具..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all placeholder:text-slate-400"
                            />
                        </div>

                        {/* 分类导航 */}
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">分类</p>
                        <nav className="space-y-0.5">
                            {CATEGORIES.map(cat => {
                                const isActive = selectedCategory === cat;
                                const count = cat === '全部'
                                    ? TOOLS.length
                                    : TOOLS.filter(t => t.category === cat).length;
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors text-left ${
                                            isActive
                                                ? 'bg-primary/10 text-primary font-semibold'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium'
                                        }`}
                                    >
                                        <span className={`material-icons-round text-[17px] shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`}>
                                            {CATEGORY_ICONS[cat] || 'apps'}
                                        </span>
                                        <span className="flex-1 truncate">{cat}</span>
                                        <span className={`text-xs font-semibold tabular-nums ${isActive ? 'text-primary' : 'text-slate-400'}`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                    {/* ── 主内容区 ── */}
                    <main className="flex-1 min-w-0 py-7 lg:border-l border-slate-200 dark:border-slate-800 lg:pl-8 pb-16">

                        {/* 欢迎语 */}
                        <div className="mb-6">
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                                {user ? `你好，${user.user_metadata?.full_name || '同学'}` : '欢迎使用智学英语 Hub'}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                {user ? getGreetingMessage() : '登录后即可使用全部英语学习工具'}
                            </p>
                        </div>

                        {/* 移动端搜索 + 分类（仅小屏显示） */}
                        <div className="lg:hidden mb-5 flex gap-2">
                            <div className="flex-1 relative">
                                <span className="absolute left-3 top-2.5 text-slate-400 material-icons-round text-[17px]">search</span>
                                <input
                                    type="text"
                                    placeholder="搜索工具..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                />
                            </div>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>

                        {/* 工具网格 */}
                        {filteredTools.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredTools.map(tool => (
                                    <ToolCard
                                        key={tool.id}
                                        tool={tool}
                                        onStart={handleStartTool}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-white dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                <span className="material-icons-round text-5xl text-slate-300 mb-4 block">search_off</span>
                                <p className="text-slate-500 text-sm">未找到匹配的工具</p>
                                <button
                                    onClick={() => { setSelectedCategory('全部'); setSearchQuery(''); }}
                                    className="mt-3 text-primary font-semibold hover:underline text-sm"
                                >
                                    清除筛选条件
                                </button>
                            </div>
                        )}
                    </main>
                </div>
            </div>

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
                initialView={authInitialView}
            />

            <ContactModal
                isOpen={isContactOpen}
                onClose={() => setIsContactOpen(false)}
            />

            <AdminDashboard
                isOpen={isAdminOpen}
                onClose={() => setIsAdminOpen(false)}
            />
        </div>
    );
};

export default App;