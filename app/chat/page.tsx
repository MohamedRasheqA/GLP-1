"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send } from "lucide-react";

interface ChatResponse {
  status: string;
  query_category: string;
  original_query: string;
  response: string;
  sources: string;
  timestamp: string;
}

interface ChatMessage {
  type: 'user' | 'bot';
  content: string;
  sources?: Array<{ title: string; url: string; }>;
  timestamp?: string;
  category?: string;
}

// Add interface for formatted response
interface FormattedResponse {
  content: string;
  metadata?: {
    category?: string;
    timestamp?: string;
    sources?: Array<{
      title: string;
      url: string;
    }>;
  };
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const formatResponse = (data: any): FormattedResponse => {
    console.log('Formatting response data:', data);
    
    let formattedContent = formatMarkdown(data.response || '');
    
    // Format sources into an array and clean up the data
    let sources = Array.isArray(data.sources) ? data.sources : [data.sources];
    sources = sources
      .filter(Boolean)
      .map((source: string) => {
        // Extract title and URL using regex
        const match = source.match(/\*\*(.*?)\*\*:\s*(https?:\/\/[^\s]+)/);
        if (match) {
          return {
            title: `- **${match[1]}**: ${match[2]}`,  // Keep original format with bullet and bold
            url: match[2].trim()
          };
        }
        return { title: source, url: '' };
      });
    
    return {
      content: formattedContent,
      metadata: {
        category: data.query_category,
        timestamp: data.timestamp,
        sources
      }
    };
  };

  const formatMarkdown = (content: string): string => {
    // Remove URL conversion to hyperlinks, just keep the plain URL
    content = content.replace(
      /(https?:\/\/[^\s<]+)/g,
      '$1'  // Changed from hyperlink format to just the URL
    );

    // Add line breaks before headings if they don't already exist
    content = content.replace(/([^\n])# /g, '$1\n# ');
    content = content.replace(/([^\n])## /g, '$1\n## ');
    content = content.replace(/([^\n])### /g, '$1\n### ');
    
    // Remove dashes before headings
    content = content.replace(/- (?=(#|##|###))/g, '');
    
    // Remove standalone ###, ##, -, and : symbols that aren't part of headings
    content = content.replace(/(?<!#)###(?!#)/g, '');
    content = content.replace(/(?<!#)##(?!#)/g, '');
    content = content.replace(/(?<![a-zA-Z])-(?![a-zA-Z])/g, '');
    content = content.replace(/(?<![0-9]):(?![0-9])/g, '');
    
    // Convert ## headings to custom styled h2
    content = content.replace(/## (.*?):(.*)/g, '<h2 class="text-lg font-semibold text-blue-700 mt-6 mb-3">$1$2</h2>');
    content = content.replace(/## (.*)/g, '<h2 class="text-lg font-semibold text-blue-700 mt-6 mb-3">$1</h2>');
    
    // Convert ### headings to custom styled h3
    content = content.replace(/### (.*?):(.*)/g, '<h3 class="text-md font-semibold text-blue-600 mt-4 mb-2">$1$2</h3>');
    content = content.replace(/### (.*)/g, '<h3 class="text-md font-semibold text-blue-600 mt-4 mb-2">$1</h3>');
    
    // Convert # headings to custom styled h1
    content = content.replace(/# (.*?):(.*)/g, '<h1 class="text-xl font-bold text-blue-800 mt-8 mb-4">$1$2</h1>');
    content = content.replace(/# (.*)/g, '<h1 class="text-xl font-bold text-blue-800 mt-8 mb-4">$1</h1>');
    
    // Convert ** bold text ** to styled spans with new line
    content = content.replace(/\*\*(.*?)\*\*/g, '<div class="font-semibold text-blue-700 my-2">$1</div>');
    
    // Convert bullet points to styled lists
    content = content.replace(/• (.*)/g, '<li class="ml-4 text-blue-600">• $1</li>');
    
    // Convert dash/hyphen lists to styled items on new lines
    content = content.replace(/- (.*)/g, '<div class="ml-4 my-2">- $1</div>');
    
    return content;
  };

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
      console.log('Sending chat request:', input);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5900000); // 5900 second timeout

      const response = await fetch('api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query: input }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 504) {
          throw new Error('Request timed out. Please try again.');
        }
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Raw chat response:', data);

      if (data.status === 'success' && data.response) {
        const formattedResponse = formatResponse(data);
        console.log('Formatted response:', formattedResponse);

        const botMessage: ChatMessage = {
          type: 'bot',
          content: formattedResponse.content,
          sources: formattedResponse.metadata?.sources,
          timestamp: formattedResponse.metadata?.timestamp || new Date().toISOString(),
          category: formattedResponse.metadata?.category
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        throw new Error(data.message || 'Invalid response format');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        type: 'bot',
        content: error instanceof Error ? 
          `Error: ${error.message}` : 
          'Sorry, the request timed out. Please try again.',
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
                <div key={index} className={`message ${message.type}`}>
                  <div className="content">
                    {message.type === 'bot' ? (
                      <FormattedChatResponse 
                        content={message.content}
                        metadata={{
                          category: message.category,
                          timestamp: message.timestamp,
                          sources: message.sources
                        }}
                      />
                    ) : (
                      <div>{message.content}</div>
                    )}
                  </div>
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

// New component for formatted responses
const FormattedChatResponse: React.FC<FormattedResponse> = ({ content, metadata }) => {
  return (
    <div className="formatted-response">
      {metadata?.category && (
        <div className="text-sm text-blue-600 mb-2">
          Category: {metadata.category}
        </div>
      )}
      <div 
        className="prose prose-blue max-w-none"
        dangerouslySetInnerHTML={{ __html: content }}
      />
      {metadata?.sources && metadata.sources.length > 0 && (
        <div className="mt-4 text-sm border-t pt-2">
          <div className="font-semibold text-blue-700 mb-2">Sources:</div>
          <div className="pl-4">
            {metadata.sources.map((source: any, index: number) => (
              <div key={index} className="text-gray-600">
                {source.title.replace(
                  /(https?:\/\/[^\s]+)/g,
                  '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>'
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {metadata?.timestamp && (
        <div className="text-xs text-gray-500 mt-2">
          {new Date(metadata.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

