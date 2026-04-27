import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

interface AdminDashboardProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SchoolStat { school_name: string | null; count: number; }
interface AgentStat  { agent_id: string; agent_title: string | null; count: number; }
interface DashboardData {
    totalUsers: number;
    totalPageViews: number;
    todayPageViews: number;
    weekPageViews: number;
    schoolStats: SchoolStat[];
    agentStats: AgentStat[];
    totalAgentCalls: number;
}

const EMPTY: DashboardData = {
    totalUsers: 0,
    totalPageViews: 0,
    todayPageViews: 0,
    weekPageViews: 0,
    schoolStats: [],
    agentStats: [],
    totalAgentCalls: 0,
};

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: number | string; sub?: string }) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm flex items-start gap-4">
            <div className="bg-primary/10 p-3 rounded-xl flex-shrink-0">
                <span className="material-icons-round text-primary text-2xl">{icon}</span>
            </div>
            <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
                {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
            </div>
        </div>
    );
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
    const [data, setData] = useState<DashboardData>(EMPTY);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

            // All queries target the english_hub schema
            const db = supabase.schema('english_hub');

            const [
                usersRes,
                totalPVRes,
                todayPVRes,
                weekPVRes,
                schoolRes,
                agentRes,
                totalCallsRes,
            ] = await Promise.all([
                // Total registered users
                db.from('user_profiles').select('id', { count: 'exact', head: true }),
                // Total page views
                db.from('page_views').select('id', { count: 'exact', head: true }),
                // Today page views
                db.from('page_views').select('id', { count: 'exact', head: true }).gte('viewed_at', todayStart),
                // Last 7 days page views
                db.from('page_views').select('id', { count: 'exact', head: true }).gte('viewed_at', weekStart),
                // Users grouped by school
                db.from('user_profiles').select('school_name'),
                // Agent calls grouped by agent
                db.from('agent_calls').select('agent_id, agent_title'),
                // Total agent calls
                db.from('agent_calls').select('id', { count: 'exact', head: true }),
            ]);

            // School stats aggregation
            const schoolMap = new Map<string, number>();
            (schoolRes.data || []).forEach((row: any) => {
                const key = row.school_name || '未填写';
                schoolMap.set(key, (schoolMap.get(key) || 0) + 1);
            });
            const schoolStats: SchoolStat[] = Array.from(schoolMap.entries())
                .map(([school_name, count]) => ({ school_name, count }))
                .sort((a, b) => b.count - a.count);

            // Agent call stats aggregation
            const agentMap = new Map<string, { title: string | null; count: number }>();
            (agentRes.data || []).forEach((row: any) => {
                const entry = agentMap.get(row.agent_id) || { title: row.agent_title, count: 0 };
                entry.count += 1;
                agentMap.set(row.agent_id, entry);
            });
            const agentStats: AgentStat[] = Array.from(agentMap.entries())
                .map(([agent_id, v]) => ({ agent_id, agent_title: v.title, count: v.count }))
                .sort((a, b) => b.count - a.count);

            setData({
                totalUsers: usersRes.count ?? 0,
                totalPageViews: totalPVRes.count ?? 0,
                todayPageViews: todayPVRes.count ?? 0,
                weekPageViews: weekPVRes.count ?? 0,
                schoolStats,
                agentStats,
                totalAgentCalls: totalCallsRes.count ?? 0,
            });
        } catch (err: any) {
            setError(err.message || '数据加载失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) load();
    }, [isOpen, load]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-xl">
                            <span className="material-icons-round text-primary text-2xl">analytics</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">数据统计看板</h2>
                            <p className="text-xs text-slate-400">仅管理员可见</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={load}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors disabled:opacity-50"
                        >
                            <span className={`material-icons-round text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
                            刷新
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                            <span className="material-icons-round text-slate-500 text-2xl">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl p-4 text-sm flex items-center gap-2">
                            <span className="material-icons-round text-base">error_outline</span>
                            {error}
                        </div>
                    )}

                    {/* Summary Cards */}
                    <div>
                        <h3 className="text-base font-bold text-slate-500 uppercase tracking-wide mb-4">总览</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard icon="group" label="注册用户数" value={data.totalUsers} />
                            <StatCard icon="visibility" label="累计访问次数" value={data.totalPageViews} sub="登录用户每次会话记一次" />
                            <StatCard icon="today" label="今日访问" value={data.todayPageViews} />
                            <StatCard icon="smart_toy" label="智能体总调用" value={data.totalAgentCalls} />
                        </div>
                    </div>

                    {/* School Stats */}
                    <div>
                        <h3 className="text-base font-bold text-slate-500 uppercase tracking-wide mb-4">
                            注册用户 — 按学校分布
                            <span className="ml-2 text-primary font-bold normal-case">{data.totalUsers} 人</span>
                        </h3>
                        {data.schoolStats.length === 0 ? (
                            <p className="text-slate-400 text-sm">暂无数据</p>
                        ) : (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                            <th className="text-left px-6 py-3 font-bold text-slate-500">学校名称</th>
                                            <th className="text-right px-6 py-3 font-bold text-slate-500">注册人数</th>
                                            <th className="text-right px-6 py-3 font-bold text-slate-500">占比</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.schoolStats.map((s, i) => (
                                            <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="px-6 py-3 font-medium text-slate-800 dark:text-slate-200">
                                                    {s.school_name || <span className="text-slate-400">未填写</span>}
                                                </td>
                                                <td className="px-6 py-3 text-right font-bold text-slate-900 dark:text-white">{s.count}</td>
                                                <td className="px-6 py-3 text-right text-slate-500">
                                                    {data.totalUsers > 0 ? `${((s.count / data.totalUsers) * 100).toFixed(1)}%` : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Agent Call Stats */}
                    <div>
                        <h3 className="text-base font-bold text-slate-500 uppercase tracking-wide mb-4">
                            智能体调用排行
                            <span className="ml-2 text-primary font-bold normal-case">{data.totalAgentCalls} 次</span>
                        </h3>
                        {data.agentStats.length === 0 ? (
                            <p className="text-slate-400 text-sm">暂无数据</p>
                        ) : (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                            <th className="text-left px-6 py-3 font-bold text-slate-500">排名</th>
                                            <th className="text-left px-6 py-3 font-bold text-slate-500">智能体名称</th>
                                            <th className="text-right px-6 py-3 font-bold text-slate-500">调用次数</th>
                                            <th className="text-right px-6 py-3 font-bold text-slate-500">占比</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.agentStats.map((a, i) => (
                                            <tr key={a.agent_id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="px-6 py-3 text-slate-400 font-bold">
                                                    {i < 3
                                                        ? <span className={['text-yellow-500','text-slate-400','text-orange-400'][i] + ' material-icons-round text-lg'}>
                                                            {['emoji_events','emoji_events','emoji_events'][i]}
                                                          </span>
                                                        : `#${i + 1}`}
                                                </td>
                                                <td className="px-6 py-3 font-medium text-slate-800 dark:text-slate-200">
                                                    {a.agent_title || a.agent_id}
                                                </td>
                                                <td className="px-6 py-3 text-right font-bold text-slate-900 dark:text-white">{a.count}</td>
                                                <td className="px-6 py-3 text-right text-slate-500">
                                                    {data.totalAgentCalls > 0 ? `${((a.count / data.totalAgentCalls) * 100).toFixed(1)}%` : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Page View detail */}
                    <div>
                        <h3 className="text-base font-bold text-slate-500 uppercase tracking-wide mb-4">访问统计详情</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <StatCard icon="calendar_today" label="今日访问" value={data.todayPageViews} />
                            <StatCard icon="date_range" label="近 7 天访问" value={data.weekPageViews} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
