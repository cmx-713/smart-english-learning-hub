import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

interface AdminDashboardProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SchoolStat  { school_name: string | null; count: number; }
interface AgentStat   { agent_id: string; agent_title: string | null; count: number; }
interface DayPoint    { date: string; count: number; }
interface TeacherStat {
    user_id: string;
    full_name: string | null;
    school_name: string | null;
    college_name: string | null;
    totalCalls: number;
    favoriteAgent: string | null;   // agent_title of most-called agent
}
interface DashboardData {
    totalUsers: number;
    totalPageViews: number;
    todayPageViews: number;
    weekPageViews: number;
    schoolStats: SchoolStat[];
    agentStats: AgentStat[];
    totalAgentCalls: number;
    trend7:  DayPoint[];
    trend30: DayPoint[];
    teacherStats: TeacherStat[];
}

const EMPTY: DashboardData = {
    totalUsers: 0, totalPageViews: 0, todayPageViews: 0, weekPageViews: 0,
    schoolStats: [], agentStats: [], totalAgentCalls: 0,
    trend7: [], trend30: [], teacherStats: [],
};

// ── StatCard ────────────────────────────────────────────────────────────────
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

// ── TrendChart（纯 SVG 柱状图） ───────────────────────────────────────────
function TrendChart({ points, color = '#3b82f6' }: { points: DayPoint[]; color?: string }) {
    if (points.length === 0) {
        return <div className="flex items-center justify-center h-32 text-slate-400 text-sm">暂无数据</div>;
    }

    const W = 600, H = 160, PB = 28, PT = 12, PL = 8, PR = 8;
    const chartW = W - PL - PR;
    const chartH = H - PB - PT;
    const maxVal = Math.max(...points.map(p => p.count), 1);
    const barW = Math.max(4, (chartW / points.length) * 0.6);
    const gap  = chartW / points.length;

    // y-axis labels (0, half, max)
    const yLabels = [0, Math.round(maxVal / 2), maxVal];

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
            {/* grid lines */}
            {yLabels.map((v, i) => {
                const y = PT + chartH - (v / maxVal) * chartH;
                return (
                    <g key={i}>
                        <line x1={PL} y1={y} x2={W - PR} y2={y}
                              stroke="#e2e8f0" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '4 3'} />
                        <text x={PL - 2} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
                    </g>
                );
            })}

            {/* bars + x-labels */}
            {points.map((p, i) => {
                const barH = Math.max(2, (p.count / maxVal) * chartH);
                const x = PL + i * gap + gap / 2 - barW / 2;
                const y = PT + chartH - barH;
                return (
                    <g key={p.date}>
                        {/* bar */}
                        <rect x={x} y={y} width={barW} height={barH} rx="3" fill={color} opacity="0.85" />
                        {/* value label on top */}
                        {p.count > 0 && (
                            <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="9" fill={color} fontWeight="bold">
                                {p.count}
                            </text>
                        )}
                        {/* x-axis date label — show every nth label to avoid overlap */}
                        {(points.length <= 10 || i % Math.ceil(points.length / 10) === 0 || i === points.length - 1) && (
                            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
                                {p.date}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

// ── 生成过去 N 天的日期列表 ──────────────────────────────────────────────
function buildDayMap(n: number): Map<string, number> {
    const map = new Map<string, number>();
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`;
        map.set(key, 0);
    }
    return map;
}

// ── AdminDashboard ───────────────────────────────────────────────────────
const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
    const [data, setData]       = useState<DashboardData>(EMPTY);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [trendRange, setTrendRange] = useState<7 | 30>(7);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const now = new Date();
            const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const weekStart    = new Date(now.getTime() - 7  * 86400_000).toISOString();
            const thirtyStart  = new Date(now.getTime() - 30 * 86400_000).toISOString();

            const db = supabase.schema('english_hub');

            const [
                usersRes, totalPVRes, todayPVRes, weekPVRes,
                schoolRes, agentRes, totalCallsRes,
                trend30Res, teachersRes, allCallsRes,
            ] = await Promise.all([
                db.from('user_profiles').select('id', { count: 'exact', head: true }),
                db.from('page_views').select('id', { count: 'exact', head: true }),
                db.from('page_views').select('id', { count: 'exact', head: true }).gte('viewed_at', todayStart),
                db.from('page_views').select('id', { count: 'exact', head: true }).gte('viewed_at', weekStart),
                db.from('user_profiles').select('school_name'),
                db.from('agent_calls').select('agent_id, agent_title'),
                db.from('agent_calls').select('id', { count: 'exact', head: true }),
                db.from('agent_calls').select('called_at').gte('called_at', thirtyStart),
                // 教师档案
                db.from('user_profiles').select('id, full_name, school_name, college_name').eq('user_role', 'teacher'),
                // 所有调用记录（含 user_id）用于教师维度统计
                db.from('agent_calls').select('user_id, agent_id, agent_title'),
            ]);

            // School stats
            const schoolMap = new Map<string, number>();
            (schoolRes.data || []).forEach((row: any) => {
                const key = row.school_name || '未填写';
                schoolMap.set(key, (schoolMap.get(key) || 0) + 1);
            });
            const schoolStats = Array.from(schoolMap.entries())
                .map(([school_name, count]) => ({ school_name, count }))
                .sort((a, b) => b.count - a.count);

            // Agent stats
            const agentMap = new Map<string, { title: string | null; count: number }>();
            (agentRes.data || []).forEach((row: any) => {
                const entry = agentMap.get(row.agent_id) || { title: row.agent_title, count: 0 };
                entry.count += 1;
                agentMap.set(row.agent_id, entry);
            });
            const agentStats = Array.from(agentMap.entries())
                .map(([agent_id, v]) => ({ agent_id, agent_title: v.title, count: v.count }))
                .sort((a, b) => b.count - a.count);

            // Trend aggregation (30 days, then slice 7 days from it)
            const map30 = buildDayMap(30);
            const map7  = buildDayMap(7);
            (trend30Res.data || []).forEach((row: any) => {
                const d = new Date(row.called_at);
                const key = `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`;
                if (map30.has(key)) map30.set(key, (map30.get(key) || 0) + 1);
                if (map7.has(key))  map7.set(key,  (map7.get(key)  || 0) + 1);
            });
            const trend30: DayPoint[] = Array.from(map30.entries()).map(([date, count]) => ({ date, count }));
            const trend7:  DayPoint[] = Array.from(map7.entries()).map(([date, count]) => ({ date, count }));

            // Teacher stats: join teacher profiles with their agent_calls
            const callsByUser = new Map<string, { agent_id: string; agent_title: string | null }[]>();
            (allCallsRes.data || []).forEach((row: any) => {
                const arr = callsByUser.get(row.user_id) || [];
                arr.push({ agent_id: row.agent_id, agent_title: row.agent_title });
                callsByUser.set(row.user_id, arr);
            });

            const teacherStats: TeacherStat[] = (teachersRes.data || []).map((t: any) => {
                const calls = callsByUser.get(t.id) || [];
                // find favorite agent
                const agentCount = new Map<string, { title: string | null; count: number }>();
                calls.forEach(c => {
                    const e = agentCount.get(c.agent_id) || { title: c.agent_title, count: 0 };
                    e.count += 1;
                    agentCount.set(c.agent_id, e);
                });
                let favorite: string | null = null;
                let maxC = 0;
                agentCount.forEach(v => { if (v.count > maxC) { maxC = v.count; favorite = v.title || v.title; } });
                return {
                    user_id:      t.id,
                    full_name:    t.full_name,
                    school_name:  t.school_name,
                    college_name: t.college_name,
                    totalCalls:   calls.length,
                    favoriteAgent: favorite,
                };
            }).sort((a, b) => b.totalCalls - a.totalCalls);

            setData({
                totalUsers:      usersRes.count ?? 0,
                totalPageViews:  totalPVRes.count ?? 0,
                todayPageViews:  todayPVRes.count ?? 0,
                weekPageViews:   weekPVRes.count ?? 0,
                schoolStats, agentStats,
                totalAgentCalls: totalCallsRes.count ?? 0,
                trend7, trend30, teacherStats,
            });
        } catch (err: any) {
            setError(err.message || '数据加载失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

    if (!isOpen) return null;

    const trendPoints = trendRange === 7 ? data.trend7 : data.trend30;

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
                        <button onClick={load} disabled={loading}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors disabled:opacity-50">
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
                            <StatCard icon="group"      label="注册用户数"    value={data.totalUsers} />
                            <StatCard icon="visibility" label="累计访问次数"  value={data.totalPageViews} sub="登录用户每次会话记一次" />
                            <StatCard icon="today"      label="今日访问"      value={data.todayPageViews} />
                            <StatCard icon="smart_toy"  label="智能体总调用"  value={data.totalAgentCalls} />
                        </div>
                    </div>

                    {/* ── 调用趋势图 ── */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-slate-500 uppercase tracking-wide">
                                智能体调用趋势
                            </h3>
                            {/* 7天 / 30天 切换 */}
                            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                {([7, 30] as const).map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setTrendRange(n)}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                            trendRange === n
                                                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        近 {n} 天
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 px-6 pt-4 pb-2">
                            <TrendChart points={trendPoints} />
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
                                                        ? <span className={['text-yellow-500','text-slate-400','text-orange-400'][i] + ' material-icons-round text-lg'}>emoji_events</span>
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

                    {/* Teacher Stats */}
                    <div>
                        <h3 className="text-base font-bold text-slate-500 uppercase tracking-wide mb-4">
                            教师使用详情
                            <span className="ml-2 text-primary font-bold normal-case">{data.teacherStats.length} 位</span>
                        </h3>
                        {data.teacherStats.length === 0 ? (
                            <p className="text-slate-400 text-sm">暂无教师注册数据</p>
                        ) : (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                            <th className="text-left px-6 py-3 font-bold text-slate-500">姓名</th>
                                            <th className="text-left px-6 py-3 font-bold text-slate-500">学校 / 学院</th>
                                            <th className="text-right px-6 py-3 font-bold text-slate-500">调用次数</th>
                                            <th className="text-left px-6 py-3 font-bold text-slate-500">最常用智能体</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.teacherStats.map((t) => (
                                            <tr key={t.user_id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="px-6 py-3 font-medium text-slate-800 dark:text-slate-200">
                                                    {t.full_name || <span className="text-slate-400">未填写</span>}
                                                </td>
                                                <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                                                    <span>{t.school_name || '—'}</span>
                                                    {t.college_name && (
                                                        <span className="ml-1 text-xs text-slate-400">· {t.college_name}</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3 text-right font-bold text-slate-900 dark:text-white">
                                                    {t.totalCalls > 0
                                                        ? t.totalCalls
                                                        : <span className="text-slate-300 font-normal">0</span>}
                                                </td>
                                                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                                    {t.favoriteAgent
                                                        ? <span className="inline-flex items-center gap-1">
                                                            <span className="material-icons-round text-primary text-[14px]">star</span>
                                                            {t.favoriteAgent}
                                                          </span>
                                                        : <span className="text-slate-300">—</span>}
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
                            <StatCard icon="calendar_today" label="今日访问"   value={data.todayPageViews} />
                            <StatCard icon="date_range"     label="近 7 天访问" value={data.weekPageViews} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
