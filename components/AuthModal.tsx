import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: (user: any) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // 登录模式：student = 学号登录，teacher = 邮箱登录
    const [loginMode, setLoginMode] = useState<'student' | 'teacher'>('student');

    // 注册表单字段
    const [name, setName] = useState('');
    const [studentId, setStudentId] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [collegeName, setCollegeName] = useState('');
    const [userRole, setUserRole] = useState<'student' | 'teacher'>('student');

    if (!isOpen) return null;

    const resetForm = () => {
        setName(''); setStudentId(''); setEmail('');
        setPassword(''); setSchoolName(''); setCollegeName('');
        setUserRole('student'); setErrorMsg(''); setLoginMode('student');
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsLoading(true);

        try {
            if (isLoginView) {
                // 登录：学生用学号@school.id，教师用真实邮箱
                const authEmail = loginMode === 'student'
                    ? `${studentId}@school.id`
                    : email;

                const { data, error } = await supabase.auth.signInWithPassword({
                    email: authEmail,
                    password,
                });
                if (error) throw error;
                if (data.user) {
                    onLoginSuccess(data.user);
                    onClose();
                }
            } else {
                // 注册：学生用学号@school.id，教师用真实邮箱
                const authEmail = userRole === 'student'
                    ? `${studentId}@school.id`
                    : email;

                // 前置验证
                if (userRole === 'student' && !studentId.trim()) {
                    throw new Error('学生注册必须填写学号');
                }
                if (userRole === 'teacher' && !email.trim()) {
                    throw new Error('教师注册必须填写邮箱');
                }

                const { data, error } = await supabase.auth.signUp({
                    email: authEmail,
                    password,
                    options: {
                        data: {
                            full_name: name,
                            student_id: studentId || null,
                            real_contact_email: email || null,
                            school_name: schoolName,
                            college_name: collegeName,
                            user_role: userRole,
                        },
                    },
                });

                if (error) throw error;

                if (data.user) {
                    await supabase.schema('english_hub').from('user_profiles').upsert({
                        id: data.user.id,
                        full_name: name,
                        student_id: studentId || null,
                        real_contact_email: email || null,
                        school_name: schoolName || null,
                        college_name: collegeName || null,
                        user_role: userRole,
                    });

                    setIsLoginView(true);
                    setLoginMode(userRole);
                    const loginHint = userRole === 'student'
                        ? '请使用学号和密码登录。'
                        : '请使用邮箱和密码登录。';
                    setErrorMsg(`注册成功！${loginHint}`);
                    setPassword('');
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
                        {isLoginView ? '登录智学英语 Hub' : '加入智学英语 Hub'}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="p-8 space-y-4 max-h-[75vh] overflow-y-auto">

                    {/* ── 登录模式切换（仅登录界面显示） ── */}
                    {isLoginView && (
                        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
                            {[
                                { mode: 'student' as const, label: '学生登录', icon: 'school' },
                                { mode: 'teacher' as const, label: '教师登录', icon: 'person' },
                            ].map(({ mode, label, icon }) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => { setLoginMode(mode); setErrorMsg(''); }}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all ${
                                        loginMode === mode
                                            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <span className="material-icons-round text-[16px]">{icon}</span>
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── 注册：姓名 ── */}
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

                    {/* ── 注册：身份选择（放在学号前，决定学号是否必填） ── */}
                    {!isLoginView && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">身份 (Role)</label>
                            <div className="flex gap-3">
                                {[
                                    { value: 'student' as const, label: '学生' },
                                    { value: 'teacher' as const, label: '教师' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setUserRole(opt.value)}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                                            userRole === opt.value
                                                ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                                                : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── 学号：登录（学生模式）或注册 ── */}
                    {/* 登录-学生模式 或 注册任意身份时都显示；教师登录模式隐藏 */}
                    {(isLoginView ? loginMode === 'student' : true) && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                学号 / 工号 (ID)
                                {/* 注册时教师显示"选填" */}
                                {!isLoginView && userRole === 'teacher' && (
                                    <span className="ml-1 text-slate-400 normal-case font-normal">选填</span>
                                )}
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-400 material-icons-round text-lg">badge</span>
                                <input
                                    type="text"
                                    required={isLoginView ? true : userRole === 'student'}
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    placeholder="请输入学号或工号"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* ── 注册：学校名称（必填） ── */}
                    {!isLoginView && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">学校名称 (School)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-400 material-icons-round text-lg">account_balance</span>
                                <input
                                    type="text"
                                    required
                                    value={schoolName}
                                    onChange={(e) => setSchoolName(e.target.value)}
                                    placeholder="请输入所在学校全称"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* ── 注册：学院/部门（必填） ── */}
                    {!isLoginView && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">学院/部门 (College)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-400 material-icons-round text-lg">domain</span>
                                <input
                                    type="text"
                                    required
                                    value={collegeName}
                                    onChange={(e) => setCollegeName(e.target.value)}
                                    placeholder="请输入所在学院或部门"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* ── 邮箱：注册时显示 / 教师登录时显示 ── */}
                    {(isLoginView ? loginMode === 'teacher' : true) && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                邮箱 (Email)
                                {/* 注册时学生显示"选填"；教师必填 */}
                                {!isLoginView && userRole === 'student' && (
                                    <span className="ml-1 text-slate-400 normal-case font-normal">选填</span>
                                )}
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-400 material-icons-round text-lg">mail</span>
                                <input
                                    type="email"
                                    required={isLoginView ? true : userRole === 'teacher'}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="yourname@example.com"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* ── 密码 ── */}
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
                        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                            errorMsg.startsWith('注册成功')
                                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        }`}>
                            <span className="material-icons-round text-base">
                                {errorMsg.startsWith('注册成功') ? 'check_circle' : 'error_outline'}
                            </span>
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
                            onClick={() => { setIsLoginView(!isLoginView); resetForm(); }}
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
