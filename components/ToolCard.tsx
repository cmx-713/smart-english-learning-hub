import React from 'react';
import { Tool } from '../types';

interface ToolCardProps {
    tool: Tool;
    onStart: (tool: Tool) => void;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool, onStart }) => {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-5 flex flex-col">

            {/* 分类标签 */}
            <div className="flex justify-end mb-4">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${tool.categoryColor}`}>
                    {tool.category}
                </span>
            </div>

            {/* 标题 */}
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1.5">
                {tool.title}
            </h3>

            {/* 描述 */}
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2 flex-grow mb-4">
                {tool.description}
            </p>

            {/* 标签 */}
            {tool.tags && tool.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {tool.tags.map(tag => (
                        <span key={tag} className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Apple 风格胶囊按钮 */}
            <button
                onClick={() => onStart(tool)}
                className="mt-auto self-start bg-primary hover:bg-primary-dark active:bg-primary-dark text-white px-5 py-2 rounded-full text-xs font-medium transition-colors"
            >
                开始使用 ›
            </button>
        </div>
    );
};

export default ToolCard;
