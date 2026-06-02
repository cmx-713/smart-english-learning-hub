import React from 'react';

interface NavbarProps {
    onOpenAuth: (mode?: 'login' | 'register') => void;
    user: any | null;
    onLogout: () => void;
    onOpenContact: () => void;
    onOpenAdmin: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onOpenAuth, user, onLogout, onOpenContact, onOpenAdmin }) => {
    const isAdmin = user?.user_metadata?.role === 'admin';
    return (
        <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <span className="material-icons-round text-primary text-2xl">school</span>
                        </div>
                        <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">智学英语 Hub</span>
                    </div>

                    {/* Actions & Auth */}
                    <div className="flex items-center gap-3">
                        {/* Admin Dashboard Button */}
                        {isAdmin && (
                            <button
                                onClick={onOpenAdmin}
                                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                            >
                                <span className="material-icons-round text-[16px]">analytics</span>
                                数据统计
                            </button>
                        )}

                        {/* Contact Button */}
                        <button
                            onClick={onOpenContact}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <span className="material-icons-round text-[16px]">support_agent</span>
                            联系老师
                        </button>

                        {user ? (
                            <div className="flex items-center gap-3">
                                <div className="hidden sm:flex flex-col items-end">
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {user.user_metadata?.full_name || 'Student'}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {user.user_metadata?.student_id || user.email}
                                    </span>
                                </div>
                                <button
                                    onClick={onLogout}
                                    className="px-4 py-1.5 text-sm font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    退出
                                </button>
                                <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {(user.user_metadata?.full_name?.[0] || 'U').toUpperCase()}
                                </div>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => onOpenAuth('login')}
                                    className="hidden sm:block px-4 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors"
                                >
                                    登录
                                </button>
                                <button
                                    onClick={() => onOpenAuth('register')}
                                    className="px-5 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors"
                                >
                                    注册
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
