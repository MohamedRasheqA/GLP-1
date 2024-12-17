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
  expectingResponse?: boolean;
  fieldName?: string;
}

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

interface FieldData {
  name: string;
  age: string;
  location: string;
  diagnosis: string;
  concern: string;
  target: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputMode, setInputMode] = useState<'field' | 'conversation'>('field');
  const [showAgeError, setShowAgeError] = useState(false);

  const [fieldData, setFieldData] = useState<FieldData>({
    name: '',
    age: '',
    location: '',
    diagnosis: '',
    concern: '',
    target: ''
  });

  const validateAge = (age: string): boolean => {
    const numericAge = Number(age);
    return !isNaN(numericAge) && numericAge > 0 && numericAge < 150;
  };

  const formatResponse = (data: any): FormattedResponse => {
    console.log('Formatting response data:', data);
    
    let formattedContent = formatMarkdown(data.response || '');
    
    let sources = Array.isArray(data.sources) ? data.sources : [data.sources];
    sources = sources
      .filter(Boolean)
      .map((source: string) => {
        const match = source.match(/\*\*(.*?)\*\*:\s*(https?:\/\/[^\s]+)/);
        if (match) {
          return {
            title: `- **${match[1]}**: ${match[2]}`,
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
    content = content.replace(
      /(https?:\/\/[^\s<]+)/g,
      '$1'
    );

    content = content.replace(/([^\n])# /g, '$1\n# ');
    content = content.replace(/([^\n])## /g, '$1\n## ');
    content = content.replace(/([^\n])### /g, '$1\n### ');
    
    content = content.replace(/- (?=(#|##|###))/g, '');
    
    content = content.replace(/(?<!#)###(?!#)/g, '');
    content = content.replace(/(?<!#)##(?!#)/g, '');
    content = content.replace(/(?<![a-zA-Z])-(?![a-zA-Z])/g, '');
    content = content.replace(/(?<![0-9]):(?![0-9])/g, '');
    
    content = content.replace(/## (.*?):(.*)/g, '<h2 class="text-lg font-semibold text-blue-700 mt-6 mb-3">$1$2</h2>');
    content = content.replace(/## (.*)/g, '<h2 class="text-lg font-semibold text-blue-700 mt-6 mb-3">$1</h2>');
    
    content = content.replace(/### (.*?):(.*)/g, '<h3 class="text-md font-semibold text-blue-600 mt-4 mb-2">$1$2</h3>');
    content = content.replace(/### (.*)/g, '<h3 class="text-md font-semibold text-blue-600 mt-4 mb-2">$1</h3>');
    
    content = content.replace(/# (.*?):(.*)/g, '<h1 class="text-xl font-bold text-blue-800 mt-8 mb-4">$1$2</h1>');
    content = content.replace(/# (.*)/g, '<h1 class="text-xl font-bold text-blue-800 mt-8 mb-4">$1</h1>');
    
    content = content.replace(/\*\*(.*?)\*\*/g, '<div class="font-semibold text-blue-700 my-2">$1</div>');
    
    content = content.replace(/• (.*)/g, '<li class="ml-4 text-blue-600">• $1</li>');
    
    content = content.replace(/- (.*)/g, '<div class="ml-4 my-2">- $1</div>');
    
    return content;
  };

  const handleFieldChange = (field: keyof FieldData, value: string) => {
    if (field === 'age') {
      if (value !== '' && !validateAge(value)) {
        setShowAgeError(true);
        return;
      }
      setShowAgeError(false);
    }
    setFieldData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (inputMode === 'field') {
      if (!validateAge(fieldData.age)) {
        setShowAgeError(true);
        return;
      }
      setInputMode('conversation');
      await processFieldData();
      return;
    } else {
      if (!input.trim()) return;

      const userMessage: ChatMessage = {
        type: 'user',
        content: input,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, userMessage]);
      setInput('');

      setIsLoading(true);
      try {
        console.log('Sending chat request:', input);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5900000);

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
          const botMessage: ChatMessage = {
            type: 'bot',
            content: formattedResponse.content,
            timestamp: formattedResponse.metadata?.timestamp || new Date().toISOString(),
            sources: formattedResponse.metadata?.sources,
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
    }
  };

  const processFieldData = async () => {
    const formattedQuery = `Please provide a medical summary and recommendations for the following patient:
      Patient Name: ${fieldData.name}
      Age: ${fieldData.age}
      Location: ${fieldData.location}
      Diagnosis: ${fieldData.diagnosis}
      Concern: ${fieldData.concern}
      Target: ${fieldData.target}
    `;

    const summaryIntro: ChatMessage = {
      type: 'bot',
      content: "Thank you for providing the patient information. Here's a summary and recommendations:",
      timestamp: new Date().toISOString()
    };
    setMessages([summaryIntro]);

    setIsLoading(true);
    try {
      const response = await fetch('api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query: formattedQuery }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === 'success' && data.response) {
        const formattedResponse = formatResponse(data);
        
        const botMessage: ChatMessage = {
          type: 'bot',
          content: formattedResponse.content,
          sources: formattedResponse.metadata?.sources,
          timestamp: formattedResponse.metadata?.timestamp || new Date().toISOString(),
          category: formattedResponse.metadata?.category
        };
        
        setMessages(prev => [...prev, botMessage]);

        const followUpMessage: ChatMessage = {
          type: 'bot',
          content: "You can now ask any follow-up questions about the patient or their treatment plan.",
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, followUpMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        type: 'bot',
        content: error instanceof Error ? 
          `Error: ${error.message}` : 
          'Sorry, there was an error processing your request.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [summaryIntro, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startFieldConversation = () => {
    const initialMessage: ChatMessage = {
      type: 'bot',
      content: "Let's gather some information. What is the patient's name?",
      timestamp: new Date().toISOString(),
      expectingResponse: true,
      fieldName: 'name'
    };
    setMessages([initialMessage]);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="area">
        <ul className="circles">
          {[...Array(10)].map((_, index) => (
            <li key={index}></li>
          ))}
        </ul>
      </div>

      <div className="relative z-10">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-center text-[#FE3301] mb-6">
            Medical Information System
          </h1>
          
          <div className="flex justify-center gap-4 mb-6">
            <Button
              onClick={() => setInputMode('field')}
              variant={inputMode === 'field' ? 'default' : 'outline'}
              className="text-white bg-[#FE3301]"
            >
              Enter by Field
            </Button>
            <Button
              onClick={() => {
                setInputMode('conversation');
                setMessages([]);
              }}
              variant={inputMode === 'conversation' ? 'default' : 'outline'}
            >
              Enter by Conversation
            </Button>
          </div>

          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-black">
                <MessageCircle className="h-6 w-6 text-black" />
                {inputMode === 'field' ? 'Field Input' : 'Conversation Mode'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inputMode === 'field' ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {showAgeError && (
                    <div className="text-red-500 text-sm mb-2 p-2 bg-red-50 rounded-md">
                      Please enter a valid numeric age between 1 and 150.
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-black mb-1">Name</label>
                      <Input
                        value={fieldData.name}
                        onChange={(e) => handleFieldChange('name', e.target.value)}
                        placeholder="Patient Name"
                        required
                        className="border-[#FE3301] focus:border-[#FE3301] text-[#FE3301]"
                      />
                    </div>
                    <div>
                    <label className="block text-sm font-medium mb-1">Age</label>
                      <Input
                        value={fieldData.age}
                        onChange={(e) => handleFieldChange('age', e.target.value)}
                        placeholder="Age"
                        required
                        type="text"
                        className={showAgeError ? 'border-red-500' : ''}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Location</label>
                    <Input
                      value={fieldData.location}
                      onChange={(e) => setFieldData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Location"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Diagnosis</label>
                    <Input
                      value={fieldData.diagnosis}
                      onChange={(e) => setFieldData(prev => ({ ...prev, diagnosis: e.target.value }))}
                      placeholder="Current Diagnosis"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Concern</label>
                    <Input
                      value={fieldData.concern}
                      onChange={(e) => setFieldData(prev => ({ ...prev, concern: e.target.value }))}
                      placeholder="Main Concern"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Target</label>
                    <Input
                      value={fieldData.target}
                      onChange={(e) => setFieldData(prev => ({ ...prev, target: e.target.value }))}
                      placeholder="Treatment Target"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full text-white bg-[#FE3301]"
                    disabled={isLoading}
                  >
                    {isLoading ? "Processing..." : "Submit and Continue to Chat"}
                  </Button>
                </form>
              ) : (
                <>
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
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <style jsx global>{`
        .area {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          z-index: 1;
        }

        .circles {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          margin: 0;
          padding: 0;
        }

        .circles li {
          position: absolute;
          display: block;
          list-style: none;
          width: 20px;
          height: 20px;
          background: rgba(254, 51, 1, 0.2);
          animation: animate 25s linear infinite;
          bottom: -150px;
          border-radius: 50%;
        }

        .circles li:nth-child(1) {
          left: 25%;
          width: 80px;
          height: 80px;
          animation-delay: 0s;
        }

        .circles li:nth-child(2) {
          left: 10%;
          width: 20px;
          height: 20px;
          animation-delay: 2s;
          animation-duration: 12s;
        }

        .circles li:nth-child(3) {
          left: 70%;
          width: 20px;
          height: 20px;
          animation-delay: 4s;
        }

        .circles li:nth-child(4) {
          left: 40%;
          width: 60px;
          height: 60px;
          animation-delay: 0s;
          animation-duration: 18s;
        }

        .circles li:nth-child(5) {
          left: 65%;
          width: 20px;
          height: 20px;
          animation-delay: 0s;
        }

        .circles li:nth-child(6) {
          left: 75%;
          width: 110px;
          height: 110px;
          animation-delay: 3s;
        }

        .circles li:nth-child(7) {
          left: 35%;
          width: 150px;
          height: 150px;
          animation-delay: 7s;
        }

        .circles li:nth-child(8) {
          left: 50%;
          width: 25px;
          height: 25px;
          animation-delay: 15s;
          animation-duration: 45s;
        }

        .circles li:nth-child(9) {
          left: 20%;
          width: 15px;
          height: 15px;
          animation-delay: 2s;
          animation-duration: 35s;
        }

        .circles li:nth-child(10) {
          left: 85%;
          width: 150px;
          height: 150px;
          animation-delay: 0s;
          animation-duration: 11s;
        }

        @keyframes animate {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.5;
            border-radius: 50%;
          }
          100% {
            transform: translateY(-1000px) rotate(720deg);
            opacity: 0;
            border-radius: 50%;
          }
        }
      `}</style>
    </div>
  );
}

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
