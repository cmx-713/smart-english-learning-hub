import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: (user: any) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
    const [isLoginView, setIsLoginView] = useState(true); // Toggle between Login and Register
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Form Fields
    const [name, setName] = useState('');
    const [studentId, setStudentId] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    if (!isOpen) return null;

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsLoading(true);

        // We use studentId@school.id as the internal auth email to allow "Student ID" login
        const internalEmail = `${studentId}@school.id`;

        try {
            if (isLoginView) {
                // Login Logic
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: internalEmail,
                    password: password,
                });

                if (error) throw error;
                if (data.user) {
                    onLoginSuccess(data.user);
                    onClose();
                }
            } else {
                // Register Logic
                const { data, error } = await supabase.auth.signUp({
                    email: internalEmail,
                    password: password,
                    options: {
                        data: {
                            full_name: name,
                            student_id: studentId,
                            real_contact_email: email // Store real email in metadata
                        }
                    }
                });

                if (error) throw error;
                
                // Auto login after register or switch to login view
                if (data.user) {
                   // Usually Supabase requires email confirmation by default. 
                   // If disable email confirmation is ON in Supabase, this works immediately.
                   // For now, we assume success and switch to login to let them try.
                   setIsLoginView(true);
                   setErrorMsg('注册成功！请使用学号和密码登录。');
                   setPassword(''); // Clear password for security
                }
            }
        } catch (error: any) {
            setErrorMsg(error.message || '认证失败，请检查输入。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            
            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-primary/5 p-6 text-center border-b border-slate-100 dark:border-slate-700">
                    <h2 className="text-2xl font-bold text-primary mb-1">
                        {isLoginView ? '欢迎回来 👋' : '创建账户 🚀'}
                    </h2>
                    <p className="text-sm text-slate-500">
                        {isLoginView ? '使用学号登录' : '加入智学英语 Hub'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleAuth} className="p-8 space-y-5">
                    
                    {/* Register Only: Name */}
                    {!isLoginView && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">姓名 (Name)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-400 material-icons-round text-lg">person</span>
                                <input 
                                    type="text" 
                                    required 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="请输入真实姓名"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* Both: Student ID */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">学号 (Student ID)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-slate-400 material-icons-round text-lg">badge</span>
                            <input 
                                type="text" 
                                required 
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                placeholder="请输入学号"
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Register Only: Email */}
                    {!isLoginView && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">邮箱 (Email)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-400 material-icons-round text-lg">mail</span>
                                <input 
                                    type="email" 
                                    required 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="yourname@example.com"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* Both: Password */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">密码 (Password)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-slate-400 material-icons-round text-lg">lock</span>
                            <input 
                                type="password" 
                                required 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
                            <span className="material-icons-round text-base">error_outline</span>
                            {errorMsg}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-primary hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {isLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                        {isLoginView ? '立即登录' : '注册账号'}
                    </button>

                    <div className="text-center text-sm text-slate-500">
                        {isLoginView ? '还没有账号？' : '已有账号？'}
                        <button 
                            type="button"
                            onClick={() => {
                                setIsLoginView(!isLoginView);
                                setErrorMsg('');
                            }}
                            className="ml-1 text-primary font-bold hover:underline"
                        >
                            {isLoginView ? '去注册' : '去登录'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AuthModal;