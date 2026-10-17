'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { ChatMessage } from '@/lib/multiplayer-store';

interface InGameChatProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
}

const QUICK_EMOJIS = ['👋', '👏', '🔥', '😮', '🧠', '⚔️', '☕', '👍'];
const QUICK_PHRASES = [
  'Chào kỳ thủ! Chúc may mắn!',
  'Nước đi hay quá!',
  'Căng thẳng thật đấy!',
  'Kẹp nhiều quân quá!',
  'Cảm ơn trận đấu!',
];

export const InGameChat: React.FC<InGameChatProps> = ({
  messages,
  currentUserId,
  onSendMessage,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showQuick, setShowQuick] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text) return;
    onSendMessage(text);
    if (!textToSend) {
      setInputText('');
    }
    setShowQuick(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-2">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#FAF6F0] hover:bg-[#F2ECE0] border border-[#DDD3C2] rounded-xl text-xs text-[#2C2723] transition-colors shadow-xs"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#A83226]" />
          <span className="font-semibold text-xs">Trò chuyện trong ván đấu</span>
          {messages.length > 0 && (
            <span className="px-1.5 py-0.2 rounded bg-[#EFE8DC] text-[#5C544B] font-mono text-[10px]">
              {messages.length}
            </span>
          )}
          {!isOpen && messages.length > 0 && (
            <span className="text-[#6B635A] truncate max-w-[180px] sm:max-w-[260px] ml-2 text-[11px]">
              {messages[messages.length - 1].senderName}: {messages[messages.length - 1].text}
            </span>
          )}
        </div>
        <div>{isOpen ? <ChevronDown className="w-4 h-4 text-[#6B635A]" /> : <ChevronUp className="w-4 h-4 text-[#6B635A]" />}</div>
      </button>

      {/* Expanded Chat Body */}
      {isOpen && (
        <div className="mt-1 bg-[#FAF6F0] border border-[#DDD3C2] rounded-xl p-3 shadow-sm">
          {/* Messages Container */}
          <div className="h-36 overflow-y-auto space-y-2 pr-1 text-xs">
            {messages.length === 0 ? (
              <div className="text-center text-[#8C8478] py-6">
                Chưa có tin nhắn nào. Gửi lời chào đến đối thủ!
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === currentUserId;
                const isSystem = msg.senderId === 'sys';

                if (isSystem) {
                  return (
                    <div
                      key={msg.id}
                      className="text-center text-[11px] text-[#A83226] py-1 bg-[#F5ECE8] rounded-lg border border-[#F0D5D1]"
                    >
                      {msg.text}
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1 mb-0.5 text-[10px] text-[#6B635A]">
                      <span>{msg.senderName}</span>
                      {msg.color && (
                        <span
                          className={`w-2 h-2 rounded-full ${
                            msg.color === 'B' ? 'bg-[#1F1C19]' : 'bg-[#FAF6EF] border border-[#C5BDB0]'
                          }`}
                        />
                      )}
                      <span>· {msg.time}</span>
                    </div>
                    <div
                      className={`px-3 py-1.5 rounded-xl max-w-[80%] break-words ${
                        isMe
                          ? 'bg-[#A83226] text-white font-medium shadow-xs'
                          : 'bg-[#EFE8DC] text-[#1F1C19] border border-[#DCD3C4]'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick reactions strip */}
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[#DDD3C2] overflow-x-auto pb-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSend(emoji)}
                className="p-1 hover:bg-[#EFE8DC] rounded-lg text-sm transition-colors shrink-0"
              >
                {emoji}
              </button>
            ))}
            <button
              onClick={() => setShowQuick(!showQuick)}
              className="ml-auto text-[11px] text-[#A83226] hover:text-[#93291F] font-semibold px-2 py-0.5 rounded bg-[#F5ECE8] border border-[#F0D5D1] shrink-0"
            >
              Mẫu câu
            </button>
          </div>

          {/* Quick Phrases popup */}
          {showQuick && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 my-2 p-2 bg-[#F2ECE0] rounded-xl border border-[#DDD3C2]">
              {QUICK_PHRASES.map((phrase) => (
                <button
                  key={phrase}
                  onClick={() => handleSend(phrase)}
                  className="text-left text-[11px] p-1.5 bg-[#FAF6EF] hover:bg-[#EFE8DC] text-[#2C2723] rounded-lg transition-colors truncate border border-[#D5CCBC]"
                >
                  {phrase}
                </button>
              ))}
            </div>
          )}

          {/* Input field */}
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập tin nhắn..."
              maxLength={100}
              className="flex-1 bg-[#FAF6EF] text-[#1F1C19] text-xs px-3 py-1.5 rounded-lg border border-[#D5CCBC] focus:outline-none focus:border-[#A83226]"
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim()}
              className="p-2 bg-[#A83226] hover:bg-[#93291F] disabled:opacity-40 text-white rounded-lg transition-colors border border-[#7A2118]"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
