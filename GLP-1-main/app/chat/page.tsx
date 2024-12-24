'use client'

import { useState } from 'react';
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send } from "lucide-react";

interface ChatMessage {
  type: 'user' | 'bot';
  content: string;
  timestamp?: string;
}

const formatMarkdown = (content: string) => {
  // First, parse the content to extract the JSON structure if it exists
  let parsedContent;
  try {
    // Check if the content is a JSON string and contains markdown content
    const isJson = typeof content === 'string' && content.includes('content\n: \n"');
    parsedContent = isJson 
      ? content.split('content\n: \n"')[1].split('"\ntimestamp')[0]
      : content;
    
    // Unescape newlines
    parsedContent = parsedContent.replace(/\\n/g, '\n');
  } catch (error) {
    console.error('Error parsing content:', error);
    return <div>{content}</div>;
  }

  // Extract references and their URLs
  const referenceMap = new Map();
  const lines = parsedContent.split('\n');
  const sourceSection = lines.join('\n').split('**Sources:**')[1];
  
  if (sourceSection) {
    const sourceLines = sourceSection.trim().split('\n');
    sourceLines.forEach((line, index) => {
      if (line.startsWith('- **') && line.includes('**: ')) {
        const refNumber = (index + 1).toString();
        const url = line.split('**: ')[1].trim();
        referenceMap.set(refNumber, url);
      }
    });
  }

  const parts = parsedContent.split('\n');
  let formattedContent = [];
  let inList = false;
  let listItems = [];

  const processText = (text: string) => {
    // Process bold text
    const boldPattern = /\*\*(.*?)\*\*/g;
    const refPattern = /\[(\d+)\]/g;
    
    const parts = text.split(boldPattern);
    return parts.map((part, index) => {
      if (index % 2 === 0) {
        // Split the text by references and map them to elements
        return part.split(refPattern).map((text, i) => {
          if (i % 2 === 0) return text;
          const url = referenceMap.get(text);
          return url ? (
            <a
              key={`ref-${text}-${i}`}
              href={url}
              className="text-[#FE3301] hover:underline cursor-pointer transition-colors duration-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              [{text}]
            </a>
          ) : `[${text}]`;
        });
      } else {
        return <strong key={index} className="font-bold">{part}</strong>;
      }
    });
  };

  for (let i = 0; i < parts.length; i++) {
    let line = parts[i].trim();
    if (!line) continue;

    // Headers (###)
    if (line.startsWith('###')) {
      if (inList) {
        formattedContent.push(
          <ul key={`list-${i}`} className="list-disc pl-6 mb-4">
            {listItems}
          </ul>
        );
        inList = false;
        listItems = [];
      }
      formattedContent.push(
        <h3 key={i} className="text-lg font-bold mb-2">
          {line.replace('### ', '')}
        </h3>
      );
      continue;
    }

    // Bullet points
    if (line.startsWith('- ')) {
      inList = true;
      const listContent = line.slice(2);
      listItems.push(
        <li key={`li-${i}`} className="mb-1">
          {processText(listContent)}
        </li>
      );
      continue;
    }

    // Sources section
    if (line.startsWith('**Sources:**')) {
      if (inList) {
        formattedContent.push(
          <ul key={`list-${i}`} className="list-disc pl-6 mb-4">
            {listItems}
          </ul>
        );
        inList = false;
        listItems = [];
      }
      formattedContent.push(
        <div key={i} className="mt-6">
          <strong className="block font-bold text-lg mb-4">
            Sources:
          </strong>
          <div className="space-y-3">
            {Array.from(referenceMap.entries()).map(([number, url]) => (
              <div key={number} className="flex gap-2">
                <span className="font-medium">[{number}]</span>
                <a
                  href={url}
                  className="text-[#FE3301] hover:underline cursor-pointer transition-colors duration-200 break-all"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {url}
                </a>
              </div>
            ))}
          </div>
        </div>
      );
      continue;
    }

    // Skip individual source lines since we handle them in the Sources section
    if (line.startsWith('- **') && line.includes('**: ')) {
      continue;
    }

    // Regular text
    if (!inList) {
      formattedContent.push(
        <p key={i} className="mb-4 break-words">
          {processText(line)}
        </p>
      );
    }
  }

  // Add any remaining list items
  if (inList) {
    formattedContent.push(
      <ul key="final-list" className="list-disc pl-6 mb-4">
        {listItems}
      </ul>
    );
  }

  return <div className="space-y-2">{formattedContent}</div>;
};

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      type: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: input }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      console.log('API Response:', data);
      
      if (data.status === 'success' && data.response) {
        const botMessage: ChatMessage = {
          type: 'bot',
          content: data.response,
          timestamp: new Date().toISOString(),
        };
        console.log('Bot Message:', botMessage);
        setMessages(prev => [...prev, botMessage]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        type: 'bot',
        content: 'Sorry, there was an error processing your request.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-t from-[#FFF5F2] via-[#FFF9F7] to-white">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-[#FE3301]">
          GLP-1 Assistant
        </h1>
        
        <Card className="max-w-4xl mx-auto bg-white/80 backdrop-blur-sm shadow-lg">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-[#FE3301]">
              <MessageCircle className="h-6 w-6" />
              GLP-1 Discussion
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col h-[calc(100vh-20rem)]">
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                {messages.map((message, index) => (
                  <div 
                    key={index} 
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`rounded-lg p-4 max-w-[85%] sm:max-w-[75%] ${
                        message.type === 'user' 
                          ? 'bg-gradient-to-r from-[#FE3301] to-[#FF6B47] text-white' 
                          : 'bg-gradient-to-r from-[#FFF5F2] to-[#FFF9F7] border border-[#FE330115]'
                      }`}
                    >
                      {message.type === 'user' ? (
                        <p className="break-words">{message.content}</p>
                      ) : (
                        formatMarkdown(message.content)
                      )}
                    </div>
                  </div>
                ))}
                {(isTyping || isLoading) && (
                  <div className="flex justify-start">
                    <div className="bg-gradient-to-r from-[#FFF5F2] to-[#FFF9F7] rounded-lg p-4 border border-[#FE330115] max-w-[85%] sm:max-w-[75%]">
                      <div className="flex space-x-2 justify-center items-center h-6">
                        <span className="sr-only">Loading...</span>
                        <div className="h-2 w-2 bg-[#FE3301] rounded-full animate-pulse"></div>
                        <div className="h-2 w-2 bg-[#FE3301] rounded-full animate-pulse delay-150"></div>
                        <div className="h-2 w-2 bg-[#FE3301] rounded-full animate-pulse delay-300"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="bg-[#FE3301] text-white hover:bg-[#FE3301]/90"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </main>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .animate-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .delay-150 { animation-delay: 150ms; }
        .delay-300 { animation-delay: 300ms; }
        
        .backdrop-blur-sm {
          backdrop-filter: blur(8px);
        }

        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }

        .scrollbar-thumb-gray-300::-webkit-scrollbar-thumb {
          background-color: #D1D5DB;
          border-radius: 3px;
        }

        .scrollbar-track-transparent::-webkit-scrollbar-track {
          background-color: transparent;
        }
      `}</style>
    </div>
  );
}
