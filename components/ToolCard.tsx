import React from 'react';
import { Tool } from '../types';

interface ToolCardProps {
    tool: Tool;
    onStart: (tool: Tool) => void;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool, onStart }) => {
    return (
        <div className="group bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full relative overflow-hidden">
            {/* Header: Icon and Category */}
            <div className="flex justify-between items-start mb-4">
                <div className={`p-4 rounded-2xl ${tool.iconBg} transition-transform group-hover:scale-105`}>
                    <span className={`material-icons-round text-3xl ${tool.iconColor}`}>{tool.icon}</span>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold tracking-wide ${tool.categoryColor}`}>
                    {tool.category}
                </span>
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary transition-colors tracking-tight">
                {tool.title}
            </h3>

            {/* Rating */}
            {tool.rating && (
                <div className="flex items-center gap-2 mb-4">
                    <div className="flex text-yellow-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={`material-icons-round text-lg ${i < Math.floor(tool.rating!) ? '' : 'text-slate-200 dark:text-slate-600'}`}>
                                star
                            </span>
                        ))}
                    </div>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{tool.rating}</span>
                    <span className="text-sm text-slate-400 font-medium">({tool.reviewCount})</span>
                </div>
            )}
            
            {/* Description */}
            <p className="text-base text-slate-500 dark:text-slate-400 mb-6 flex-grow leading-relaxed">
                {tool.description}
            </p>
            
            {/* Footer Area */}
            <div className="mt-auto space-y-5">
                {/* Feature Tags */}
                {tool.tags && tool.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {tool.tags.map(tag => (
                            <div key={tag} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                                <span className="material-icons-round text-[14px] opacity-70">extension</span>
                                {tag}
                            </div>
                        ))}
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                    <button 
                        onClick={() => onStart(tool)}
                        className="flex-1 bg-primary hover:bg-blue-700 text-white py-3 rounded-xl text-base font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                    >
                        <span className="material-icons-round">
                            {tool.externalLink ? 'open_in_new' : 'play_arrow'}
                        </span>
                        {tool.externalLink ? '跳转' : '开始'}
                    </button>
                    <button className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 py-3 rounded-xl text-base font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                        <span className="material-icons-round text-slate-400">menu_book</span>
                        指南
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ToolCard;