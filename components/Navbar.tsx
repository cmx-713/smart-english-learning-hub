import React from 'react';

interface NavbarProps {
    onOpenAuth: () => void;
    user: any | null;
    onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onOpenAuth, user, onLogout }) => {
    return (
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-24 items-center">
                    {/* Logo */}
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-3 rounded-2xl">
                            <span className="material-icons-round text-primary text-4xl">school</span>
                        </div>
                        <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">智学英语 Hub</span>
                    </div>

                    {/* Auth Buttons */}
                    <div className="flex items-center gap-4">
                        {user ? (
                            <div className="flex items-center gap-4">
                                <div className="hidden sm:flex flex-col items-end mr-2">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                                        {user.user_metadata?.full_name || 'Student'}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {user.user_metadata?.student_id || user.email}
                                    </span>
                                </div>
                                <button 
                                    onClick={onLogout}
                                    className="px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    退出
                                </button>
                                <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md shadow-primary/20">
                                    {(user.user_metadata?.full_name?.[0] || 'U').toUpperCase()}
                                </div>
                            </div>
                        ) : (
                            <>
                                <button 
                                    onClick={onOpenAuth}
                                    className="hidden sm:block px-6 py-3 text-base font-bold text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors"
                                >
                                    登录
                                </button>
                                <button 
                                    onClick={onOpenAuth}
                                    className="px-8 py-3 text-base font-bold text-white bg-primary hover:bg-blue-700 rounded-2xl shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 active:translate-y-0"
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