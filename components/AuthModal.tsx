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

    const [loginMode, setLoginMode] = useState<'student' | 'teacher'>('student');

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
                const authEmail = userRole === 'student'
                    ? `${studentId}@school.id`
                    : email;

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

    const inputClass = "w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/60 outline-none transition-all";
    const labelClass = "text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-6 pb-5 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {isLoginView ? '登录账户' : '创建账户'}
                            </h2>
                            <p className="text-sm text-slate-500 mt-0.5">
                                {isLoginView ? '欢迎回来，请输入你的账号信息' : '加入智学英语 Hub'}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                            <span className="material-icons-round text-slate-400 text-xl">close</span>
                        </button>
                    </div>
                </div>

                <form onSubmit={handleAuth} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                    {/* 登录模式切换 */}
                    {isLoginView && (
                        <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                            {[
                                { mode: 'student' as const, label: '学生登录', icon: 'school' },
                                { mode: 'teacher' as const, label: '教师登录', icon: 'person' },
                            ].map(({ mode, label, icon }) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => { setLoginMode(mode); setErrorMsg(''); }}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-all ${
                                        loginMode === mode
                                            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <span className="material-icons-round text-[15px]">{icon}</span>
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 注册：姓名 */}
                    {!isLoginView && (
                        <div>
                            <label className={labelClass}>姓名</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-400 material-icons-round text-lg">person</span>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="请输入真实姓名"
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    )}

                    {/* 注册：身份选择 */}
                    {!isLoginView && (
                        <div>
                            <label className={labelClass}>身份</label>
                            <div className="flex gap-2">
                                {[
                                    { value: 'student' as const, label: '学生' },
                                    { value: 'teacher' as const, label: '教师' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setUserRole(opt.value)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                                            userRole === opt.value
                                                ? 'bg-primary text-white border-primary'
                                                : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 学号 */}
                    {(isLoginView ? loginMode === 'student' : true) && (
                        <div>
                            <label className={labelClass}>
                                学号 / 工号
                                {!isLoginView && userRole === 'teacher' && (
                                    <span className="ml-1 text-slate-400 font-normal">（选填）</span>
                                )}
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-400 material-icons-round text-lg">badge</span>
                                <input
                                    type="text"
                                    required={isLoginView ? true : userRole === 'student'}
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    placeholder="请输入学号或工号"
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    )}

                    {/* 注册：学校名称 */}
                    {!isLoginView && (
                        <div>
                            <label className={labelClass}>学校名称</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-400 material-icons-round text-lg">account_balance</span>
                                <input
                                    type="text"
                                    required
                                    value={schoolName}
                                    onChange={(e) => setSchoolName(e.target.value)}
                                    placeholder="请输入所在学校全称"
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    )}

                    {/* 注册：学院/部门 */}
                    {!isLoginView && (
                        <div>
                            <label className={labelClass}>学院 / 部门</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-400 material-icons-round text-lg">domain</span>
                                <input
                                    type="text"
                                    required
                                    value={collegeName}
                                    onChange={(e) => setCollegeName(e.target.value)}
                                    placeholder="请输入所在学院或部门"
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    )}

                    {/* 邮箱 */}
                    {(isLoginView ? loginMode === 'teacher' : true) && (
                        <div>
                            <label className={labelClass}>
                                邮箱
                                {!isLoginView && userRole === 'student' && (
                                    <span className="ml-1 text-slate-400 font-normal">（选填）</span>
                                )}
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-400 material-icons-round text-lg">mail</span>
                                <input
                                    type="email"
                                    required={isLoginView ? true : userRole === 'teacher'}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="yourname@example.com"
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    )}

                    {/* 密码 */}
                    <div>
                        <label className={labelClass}>密码</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 material-icons-round text-lg">lock</span>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className={inputClass}
                            />
                        </div>
                    </div>

                    {errorMsg && (
                        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                            errorMsg.startsWith('注册成功')
                                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
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
                        className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {isLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                        {isLoginView ? '登录' : '注册'}
                    </button>

                    <p className="text-center text-sm text-slate-500">
                        {isLoginView ? '还没有账号？' : '已有账号？'}
                        <button
                            type="button"
                            onClick={() => { setIsLoginView(!isLoginView); resetForm(); }}
                            className="ml-1 text-primary font-semibold hover:underline"
                        >
                            {isLoginView ? '去注册' : '去登录'}
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default AuthModal;
