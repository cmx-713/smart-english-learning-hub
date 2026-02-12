export interface Tool {
    id: string;
    title: string;
    description: string;
    icon: string;
    iconBg: string;
    iconColor: string;
    level: string;
    levelColor?: string; // e.g. "bg-amber-100 text-amber-700"
    category: string;
    categoryColor: string;
    rating?: number; // 0-5
    reviewCount?: number; // e.g. 21
    tags?: string[]; // e.g. ["Visual Graph", "Knowledge"]
    systemInstruction: string;
    cozeBotId?: string; // The ID of the bot in Coze platform
    externalLink?: string; // If present, opens in new tab instead of modal
}

export type MessageRole = 'user' | 'model';

export interface Message {
    id: string;
    role: MessageRole;
    text: string;
}