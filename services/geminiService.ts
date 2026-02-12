import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Message } from '../types';

let chatSession: Chat | null = null;

const getAIClient = () => {
    // API key must be provided via environment variable
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const startChatSession = (systemInstruction: string) => {
    const ai = getAIClient();
    // Using a performant model for chat interactions
    chatSession = ai.chats.create({
        model: 'gemini-2.5-flash-latest', // Fast and capable model
        config: {
            systemInstruction: systemInstruction,
        },
    });
    return chatSession;
};

export const sendMessageStream = async function* (message: string): AsyncGenerator<string, void, unknown> {
    if (!chatSession) {
        throw new Error("Chat session not initialized");
    }

    try {
        const result = await chatSession.sendMessageStream({ message });
        
        for await (const chunk of result) {
             const c = chunk as GenerateContentResponse;
             if (c.text) {
                 yield c.text;
             }
        }
    } catch (error) {
        console.error("Error sending message to Gemini:", error);
        yield "Sorry, I encountered an error while processing your request.";
    }
};
