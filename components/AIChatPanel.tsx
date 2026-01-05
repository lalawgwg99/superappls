import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Loader2, Sparkles } from 'lucide-react';
import { SalesRecord, AnalysisResult } from '../types';
import { askSalesQuestion, ChatMessage } from '../services/chatService';

interface Props {
    rawRecords: SalesRecord[];
    analysisResult: AnalysisResult | null;
}

const AIChatPanel: React.FC<Props> = ({ rawRecords, analysisResult }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 快捷問題建議
    const quickQuestions = [
        '哪個品牌賣最好？',
        '總共賣了多少台？',
        'LG 冰箱業績如何？',
        '這個月業績趨勢？'
    ];

    // 自動捲動到最新訊息
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (question?: string) => {
        const q = question || input.trim();
        if (!q || isLoading) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: q,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            const response = await askSalesQuestion(q, rawRecords, analysisResult, messages);
            const aiMessage: ChatMessage = {
                role: 'assistant',
                content: response,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMessage]);
        } catch (err: any) {
            setError(err.message || '發生錯誤');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 hover:scale-110"
                title="AI 助手"
            >
                <MessageCircle className="w-6 h-6" />
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-bold">AI 銷售分析助手</span>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.length === 0 && (
                    <div className="text-center py-8">
                        <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 mb-4">有什麼想問的嗎？</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {quickQuestions.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(q)}
                                    className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-md'
                                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
                                }`}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 px-4 py-2 rounded-2xl rounded-bl-md shadow-sm">
                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="text-center text-red-500 text-sm bg-red-50 p-2 rounded-lg">
                        {error}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="輸入問題..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        disabled={isLoading}
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isLoading}
                        className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIChatPanel;
