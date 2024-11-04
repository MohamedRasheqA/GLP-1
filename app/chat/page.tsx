"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send } from "lucide-react";

interface ChatResponse {
  status?: string;
  query_category: string;
  original_query: string;
  response: string;
  disclaimer: string;
  sources: string;
}

interface ChatMessage {
  type: 'user' | 'bot';
  content: string;
  timestamp?: string;
  category?: string;
  sources?: string;
  disclaimer?: string;
}

const formatMessage = (content: string) => {
  // Add line breaks before headings if they don't already exist
  content = content.replace(/([^\n])# /g, '$1\n# ');
  content = content.replace(/([^\n])## /g, '$1\n## ');
  content = content.replace(/([^\n])### /g, '$1\n### ');
  
  // Convert headings to styled elements
  content = content.replace(/## (.*)/g, '<h2 class="text-lg font-semibold text-blue-700 mt-6 mb-3">$1</h2>');
  content = content.replace(/### (.*)/g, '<h3 class="text-md font-semibold text-blue-600 mt-4 mb-2">$1</h3>');
  content = content.replace(/# (.*)/g, '<h1 class="text-xl font-bold text-blue-800 mt-8 mb-4">$1</h1>');
  
  // Style text elements
  content = content.replace(/\*\*(.*?)\*\*/g, '<span class="font-semibold text-blue-700">$1</span>');
  content = content.replace(/• (.*)/g, '<li class="ml-4 text-blue-600">• $1</li>');
  
  return content;
};

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      type: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInput('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: input })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data: ChatResponse = await response.json();
      
      if (data.response) {
        const botMessage: ChatMessage = {
          type: 'bot',
          content: data.response,
          timestamp: new Date().toISOString(),
          category: data.query_category,
          sources: data.sources,
          disclaimer: data.disclaimer
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        type: 'bot',
        content: error instanceof Error ? 
          `Error: ${error.message}` : 
          'An error occurred. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <MessageCircle className="h-6 w-6 text-green-500" />
              Chat with GLP-1 Assistant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[60vh] overflow-y-auto mb-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-100 ml-auto max-w-[80%]'
                      : 'bg-gray-100 mr-auto max-w-[80%]'
                  }`}
                >
                  {message.category && (
                    <div className="text-xs text-blue-600 mb-1">
                      Category: {message.category}
                    </div>
                  )}
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: message.type === 'bot' 
                        ? formatMessage(message.content)
                        : message.content 
                    }}
                  />
                  {message.sources && (
                    <div className="mt-2 text-sm text-gray-600 border-t pt-2">
                      <strong>Sources:</strong>
                      <div dangerouslySetInnerHTML={{ __html: formatMessage(message.sources) }} />
                    </div>
                  )}
                  {message.disclaimer && (
                    <div className="mt-2 text-sm text-red-600 border-t pt-2">
                      {message.disclaimer}
                    </div>
                  )}
                  {message.timestamp && (
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="text-center text-gray-500">
                  Processing your request...
                </div>
              )}
            </div>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about GLP-1 medications..."
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
