import React from 'react';

interface ContactModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up">

                {/* Header */}
                <div className="p-8 pb-6 border-b border-slate-100 dark:border-slate-700/50 relative">
                    <button
                        onClick={onClose}
                        className="absolute right-6 top-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        <span className="material-icons-round">close</span>
                    </button>
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 mx-auto transform -rotate-6 shadow-sm">
                        <span className="material-icons-round text-3xl">support_agent</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center">联系老师</h2>
                    <p className="text-slate-500 text-center mt-2">在使用过程中遇到问题？欢迎随时联系反馈。</p>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    {/* WaitChat Placeholder or Email */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-4 mb-4">
                            <span className="material-icons-round text-green-500 text-2xl">wechat</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">微信客服 (WeChat)</span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            添加小助手微信，获取专属指导与答疑服务。
                        </p>
                        <div className="w-full h-12 bg-slate-200 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-600">
                            微信号: 123448625
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-4 mb-4">
                            <span className="material-icons-round text-blue-500 text-2xl">mail</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">电子邮件 (Email)</span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            您也可以通过邮件发送详细的问题描述或截图。
                        </p>
                        <a href="mailto:support@aiforeng.com" className="w-full flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 transition-all">
                            <span className="material-icons-round text-sm">open_in_new</span>
                            cmx@nmu.edu.cn
                        </a>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ContactModal;
