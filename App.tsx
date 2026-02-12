import React, { useState, useMemo, useEffect } from 'react';
import Navbar from './components/Navbar';
import ToolCard from './components/ToolCard';
import ChatModal from './components/ChatModal';
import AuthModal from './components/AuthModal';
import { supabase } from './services/supabaseClient';
import { TOOLS, CATEGORIES } from './constants';
import { Tool } from './types';

const App: React.FC = () => {
    const [selectedCategory, setSelectedCategory] = useState<string>('全部');
    const [searchQuery, setSearchQuery] = useState('');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [activeTool, setActiveTool] = useState<Tool | null>(null);
    const [user, setUser] = useState<any>(null);

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

        return () => subscription.unsubscribe();
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

                {/* Filter Conditions Panel */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 mb-10">
                    <div className="flex items-center gap-3 mb-8 border-b border-slate-100 dark:border-slate-700 pb-5">
                        <span className="material-icons-round text-primary text-3xl">filter_alt</span>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">筛选条件</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        {/* Search Input */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wide">搜索关键词</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-3.5 text-slate-400 material-icons-round text-2xl group-focus-within:text-primary transition-colors">search</span>
                                <input 
                                    type="text" 
                                    placeholder="输入关键词..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                />
                            </div>
                        </div>

                        {/* Category Dropdown */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wide">功能分类</label>
                            <div className="relative">
                                <select 
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="w-full pl-5 pr-12 py-3 appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none cursor-pointer text-slate-700 dark:text-slate-200"
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                <span className="absolute right-4 top-3.5 text-slate-400 material-icons-round pointer-events-none text-2xl">expand_more</span>
                            </div>
                        </div>

                        {/* Recommendation Index (Visual Only) */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wide">推荐指数</label>
                            <div className="relative">
                                <select className="w-full pl-5 pr-12 py-3 appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none cursor-pointer text-slate-700 dark:text-slate-200">
                                    <option>全部评分</option>
                                    <option>5 星</option>
                                    <option>4+ 星</option>
                                </select>
                                <span className="absolute right-4 top-3.5 text-slate-400 material-icons-round pointer-events-none text-2xl">expand_more</span>
                            </div>
                        </div>

                         {/* Status (Visual Only) */}
                         <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wide">公开状态</label>
                            <div className="relative">
                                <select className="w-full pl-5 pr-12 py-3 appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none cursor-pointer text-slate-700 dark:text-slate-200">
                                    <option>全部状态</option>
                                    <option>公开</option>
                                    <option>私有</option>
                                </select>
                                <span className="absolute right-4 top-3.5 text-slate-400 material-icons-round pointer-events-none text-2xl">expand_more</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">智能体作品</h3>
                        <span className="px-4 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-bold">
                            共 {filteredTools.length} 个作品
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-base text-slate-500">
                        <span>排序方式:</span>
                        <select className="bg-transparent font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer">
                            <option>按评分排序</option>
                            <option>最新发布</option>
                            <option>最受欢迎</option>
                        </select>
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
                        <p className="text-slate-500 text-lg">未找到匹配的智能体。</p>
                        <button 
                            onClick={() => {setSelectedCategory('全部'); setSearchQuery('');}}
                            className="mt-6 text-primary font-bold hover:underline text-lg"
                        >
                            清除筛选
                        </button>
                    </div>
                )}
            </main>

            {/* Floating AI Assistant Button */}
            <div className="fixed bottom-10 right-10 z-40 flex flex-col items-end gap-3 group">
                <div className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-5 py-3 rounded-xl text-base font-medium shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 pointer-events-none mb-2 relative">
                    需要帮助？问问AI！
                    <div className="absolute -bottom-1 right-8 w-4 h-4 bg-slate-900 dark:bg-white transform rotate-45"></div>
                </div>
                <button 
                    onClick={handleOpenGeneralChat}
                    className="h-20 w-20 bg-primary rounded-full shadow-xl shadow-primary/40 flex items-center justify-center hover:scale-110 transition-transform duration-300 active:scale-95"
                >
                    <span className="material-icons-round text-white text-4xl animate-pulse">smart_toy</span>
                </button>
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
            />
        </div>
    );
};

export default App;