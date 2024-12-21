'use client'
import { useState } from 'react';
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown'

interface ChatMessage {
  type: 'user' | 'bot';
  content: string;
  timestamp?: string;
}

const markdownComponents: Components = {
  h1: ({children, ...props}) => <h1 className="text-2xl font-bold mb-4" {...props}>{children}</h1>,
  h2: ({children, ...props}) => <h2 className="text-xl font-bold mb-3" {...props}>{children}</h2>,
  h3: ({children, ...props}) => <h3 className="text-lg font-bold mb-2" {...props}>{children}</h3>,
  p: ({children, ...props}) => {
    if (typeof children === 'string' && children.includes('**: ')) {
      const [title, url] = children.split('**: ');
      return (
        <p className="mb-2 ml-4" {...props}>
          • <strong>{title.replace('* **', '')}</strong>:{' '}
          <a 
            href={url}
            className="text-[#FE3301] hover:underline cursor-pointer transition-colors duration-200"
            target="_blank"
            rel="noopener noreferrer"
          >
            {url}
          </a>
        </p>
      );
    }
    return <p className="mb-4" {...props}>{children}</p>;
  },
  ul: ({children, ...props}) => <ul className="list-disc pl-6 mb-4" {...props}>{children}</ul>,
  ol: ({children, ...props}) => <ol className="list-decimal pl-6 mb-4" {...props}>{children}</ol>,
  li: ({children, ...props}) => <li className="mb-1" {...props}>{children}</li>,
  a: ({href, children, ...props}) => (
    <a 
      href={href}
      className="text-[#FE3301] hover:underline cursor-pointer transition-colors duration-200"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  code: ({inline, className, children, ...props}: any) => 
    inline ? 
      <code className="bg-gray-100 px-1 rounded" {...props}>{children}</code> :
      <code className="block bg-gray-100 p-2 rounded mb-4" {...props}>{children}</code>,
  blockquote: ({children, ...props}) => 
    <blockquote className="border-l-4 border-[#FE3301] pl-4 italic my-4" {...props}>{children}</blockquote>,
  strong: ({children, ...props}) => {
    if (typeof children === 'string' && children === 'Sources:') {
      return <strong className="block font-bold text-lg mb-2" {...props}>{children}</strong>;
    }
    return <strong {...props}>{children}</strong>;
  }
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
      
      if (data.status === 'success' && data.response) {
        const botMessage: ChatMessage = {
          type: 'bot',
          content: data.response,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, botMessage]);
      }
      setIsTyping(false);
    } catch (error) {
      const errorMessage: ChatMessage = {
        type: 'bot',
        content: 'Sorry, there was an error processing your request.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsTyping(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-t from-[#FFF5F2] via-[#FFF9F7] to-white"></div>
      
      <div className="relative z-10">
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
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="h-[60vh] overflow-y-auto pr-4 space-y-4">
                  {messages.map((message, index) => (
                    <div 
                      key={index} 
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'w-full'}`}
                    >
                      <div 
                        className={`rounded-lg p-4 ${
                          message.type === 'user' 
                            ? 'max-w-[80%] bg-gradient-to-r from-[#FE3301] to-[#FF6B47] text-white' 
                            : 'w-full bg-gradient-to-r from-[#FFF5F2] to-[#FFF9F7] border border-[#FE330115]'
                        }`}
                      >
                        <ReactMarkdown components={markdownComponents}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  {(isTyping || isLoading) && (
                    <div className="w-full">
                      <div className="bg-gradient-to-[#FFF9F7] rounded-lg p-4 border border-[#FE330115]">
                        <div className="flex space-x-2 justify-center items-center">
                          <span className="sr-only">Loading...</span>
                          <div className="h-3 w-3 bg-[#FE3301] rounded-full animate-bounce"></div>
                          <div className="h-3 w-3 bg-[#FE3301] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="h-3 w-3 bg-[#FE3301] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <form onSubmit={handleSubmit} className="flex gap-2">
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
      </div>

      <style jsx global>{`
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-bounce {
          animation: bounce 0.6s infinite;
        }

        .backdrop-blur-sm {
          backdrop-filter: blur(8px);
        }

        .prose a {
          color: #FE3301;
          text-decoration: none;
        }

        .prose a:hover {
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .max-w-[80%] {
            max-width: 85%;
          }
        }
      `}</style>
    </div>
  );
}
