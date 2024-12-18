'use client'

import { useState } from 'react'
import { Header } from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Send } from "lucide-react"

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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [inputMode, setInputMode] = useState<'field' | 'conversation'>('field')
  const [showAgeError, setShowAgeError] = useState(false)
  const [isTyping, setIsTyping] = useState(false)

  const [fieldData, setFieldData] = useState<FieldData>({
    name: '',
    age: '',
    location: '',
    diagnosis: '',
    concern: '',
    target: ''
  })

  const validateAge = (age: string): boolean => {
    const numericAge = Number(age)
    return !isNaN(numericAge) && numericAge > 0 && numericAge < 150
  }

  const formatResponse = (data: any): FormattedResponse => {
    let formattedContent = formatMarkdown(data.response || '')
    
    let sources = Array.isArray(data.sources) ? data.sources : [data.sources]
    sources = sources
      .filter(Boolean)
      .map((source: string) => {
        const match = source.match(/\*\*(.*?)\*\*:\s*(https?:\/\/[^\s]+)/)
        if (match) {
          return {
            title: match[1],
            url: match[2].trim()
          }
        }
        return { title: source, url: '' }
      })
    
    return {
      content: formattedContent,
      metadata: {
        category: data.query_category,
        timestamp: data.timestamp,
        sources
      }
    }
  }

  const formatMarkdown = (content: string): string => {
    // Replace URLs with links
    content = content.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-[#FE3301] hover:underline">$1</a>'
    );

    // Ensure there's a newline before headings if not already present
    content = content.replace(/([^\n])# /g, '$1\n# ');
    content = content.replace(/([^\n])## /g, '$1\n## ');
    content = content.replace(/([^\n])### /g, '$1\n### ');

    // Remove dashes before headings
    content = content.replace(/- (?=(#|##|###))/g, '');

    // Remove standalone heading markers
    content = content.replace(/(?<!#)###(?!#)/g, '');
    content = content.replace(/(?<!#)##(?!#)/g, '');
    content = content.replace(/(?<![a-zA-Z])-(?![a-zA-Z])/g, '');
    content = content.replace(/(?<![0-9]):(?![0-9])/g, '');

    // Updated heading styles to match your theme
    content = content.replace(/# (.*?):(.*)/g, '<h1 class="text-xl font-bold text-blue-800 mt-8 mb-4">$1$2</h1>');
    content = content.replace(/# (.*)/g, '<h1 class="text-xl font-bold text-blue-800 mt-8 mb-4">$1</h1>');

    content = content.replace(/## (.*?):(.*)/g, '<h2 class="text-lg font-semibold text-blue-700 mt-6 mb-3">$1$2</h2>');
    content = content.replace(/## (.*)/g, '<h2 class="text-lg font-semibold text-blue-700 mt-6 mb-3">$1</h2>');

    content = content.replace(/### (.*?):(.*)/g, '<h3 class="text-md font-semibold text-blue-600 mt-4 mb-2">$1$2</h3>');
    content = content.replace(/### (.*)/g, '<h3 class="text-md font-semibold text-blue-600 mt-4 mb-2">$1</h3>');

    // Format bold text
    content = content.replace(/\*\*(.*?)\*\*/g, '<div class="font-semibold text-blue-700 my-2">$1</div>');

    // Format list items
    content = content.replace(/• (.*)/g, '<li class="ml-4 text-blue-600">• $1</li>');
    content = content.replace(/- (.*)/g, '<div class="ml-4 my-2">- $1</div>');

    return content;
  }

  const handleFieldChange = (field: keyof FieldData, value: string) => {
    if (field === 'age') {
      if (value !== '' && !validateAge(value)) {
        setShowAgeError(true)
        return
      }
      setShowAgeError(false)
    }
    setFieldData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (inputMode === 'field') {
      if (!validateAge(fieldData.age)) {
        setShowAgeError(true)
        return
      }
      setInputMode('conversation')
      await processFieldData()
      return
    }

    if (!input.trim()) return

    const userMessage: ChatMessage = {
      type: 'user',
      content: input,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    
    setIsLoading(true)
    setIsTyping(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: input }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      if (data.status === 'success' && data.response) {
        const formattedResponse = formatResponse(data)
        const botMessage: ChatMessage = {
          type: 'bot',
          content: formattedResponse.content,
          sources: formattedResponse.metadata?.sources,
          timestamp: new Date().toISOString(),
          category: formattedResponse.metadata?.category
        }
        setMessages(prev => [...prev, botMessage])
        setIsTyping(false)
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        type: 'bot',
        content: 'Sorry, there was an error processing your request.',
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
      setIsTyping(false)
    } finally {
      setIsLoading(false)
    }
  }

  const processFieldData = async () => {
    const formattedQuery = `
      Patient Information:
      Name: ${fieldData.name}
      Age: ${fieldData.age}
      Location: ${fieldData.location}
      Diagnosis: ${fieldData.diagnosis}
      Main Concern: ${fieldData.concern}
      Treatment Goal: ${fieldData.target}
    `

    const summaryMessage: ChatMessage = {
      type: 'bot',
      content: "I'll help you with your medical consultation. Let me analyze this information.",
      timestamp: new Date().toISOString()
    }
    setMessages([summaryMessage])

    setIsLoading(true)
    setIsTyping(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: formattedQuery }),
      })

      const data = await response.json()

      if (response.ok && data.status === 'success') {
        const formattedResponse = formatResponse(data)
        const analysisMessage: ChatMessage = {
          type: 'bot',
          content: formattedResponse.content,
          sources: formattedResponse.metadata?.sources,
          timestamp: new Date().toISOString(),
          category: formattedResponse.metadata?.category
        }
        
        const followUpMessage: ChatMessage = {
          type: 'bot',
          content: "Please feel free to ask any questions about the analysis or treatment options.",
          timestamp: new Date().toISOString()
        }
        
        setMessages(prev => [...prev, analysisMessage, followUpMessage])
        setIsTyping(false)
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        type: 'bot',
        content: 'Sorry, I encountered an error while processing your information.',
        timestamp: new Date().toISOString()
      }])
      setIsTyping(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-[#FFF5F2] via-[#FFF9F7] to-white"></div>
        <div className="absolute inset-0">
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-[#FFF5F2]">
            <div className="absolute inset-0 bg-gradient-radial-bottom"></div>
            <div className="absolute inset-0 bg-gradient-conic-bottom"></div>
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-center mb-8 text-[#FE3301]">
            Medical Consultation Assistant
          </h1>
          
          <div className="flex justify-center gap-4 mb-8">
            <Button
              onClick={() => setInputMode('field')}
              variant={inputMode === 'field' ? 'default' : 'outline'}
              className={`transition-all ${inputMode === 'field' ? 'bg-[#FE3301] text-white' : 'hover:bg-[#FE3301] hover:text-white'}`}
            >
              Guided Consultation
            </Button>
            <Button
              onClick={() => {
                setInputMode('conversation');
                setMessages([]);
              }}
              variant={inputMode === 'conversation' ? 'default' : 'outline'}
              className={`transition-all ${inputMode === 'conversation' ? 'bg-[#FE3301] text-white' : 'hover:bg-[#FE3301] hover:text-white'}`}
            >
              Open Discussion
            </Button>
          </div>

          <Card className="max-w-4xl mx-auto bg-white/80 backdrop-blur-sm shadow-lg">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-[#FE3301]">
                <MessageCircle className="h-6 w-6" />
                {inputMode === 'field' ? 'Patient Information' : 'Medical Discussion'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {inputMode === 'field' ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {showAgeError && (
                    <div className="text-red-500 text-sm p-3 bg-red-50 rounded-lg">
                      Please enter a valid age between 1 and 150.
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">Patient Name</label>
                      <Input
                        value={fieldData.name}
                        onChange={(e) => handleFieldChange('name', e.target.value)}
                        placeholder="Enter patient's name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">Age</label>
                      <Input
                        value={fieldData.age}
                        onChange={(e) => handleFieldChange('age', e.target.value)}
                        placeholder="Patient's age"
                        required
                        className={showAgeError ? 'border-red-500' : ''}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Location</label>
                    <Input
                      value={fieldData.location}
                      onChange={(e) => handleFieldChange('location', e.target.value)}
                      placeholder="Patient's location"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Current Diagnosis</label>
                    <Input
                      value={fieldData.diagnosis}
                      onChange={(e) => handleFieldChange('diagnosis', e.target.value)}
                      placeholder="Enter current diagnosis"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Main Concern</label>
                    <Input
                      value={fieldData.concern}
                      onChange={(e) => handleFieldChange('concern', e.target.value)}
                      placeholder="Primary medical concern"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Treatment Goal</label>
                    <Input
                      value={fieldData.target}
                      onChange={(e) => handleFieldChange('target', e.target.value)}
                      placeholder="Desired treatment outcome"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-[#FE3301] text-white hover:bg-[#FE3301]/90"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex space-x-2 justify-center items-center">
                        <span className="sr-only">Loading...</span>
                        <div className="h-3 w-3 bg-white rounded-full animate-loading-bounce [animation-delay:-0.3s]"></div>
                        <div className="h-3 w-3 bg-white rounded-full animate-loading-bounce [animation-delay:-0.15s]"></div>
                        <div className="h-3 w-3 bg-white rounded-full animate-loading-bounce"></div>
                      </div>
                    ) : (
                      "Begin Consultation"
                    )}
                  </Button>
                </form>
              ) : (
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
                              ? 'max-w-[80%] bg-gradient-to-r from-[#FE3301] to-[#FF6B47] text-white shadow-md' 
                              : 'w-full bg-gradient-to-r from-[#FFF5F2] to-[#FFF9F7] shadow-sm border border-[#FE330115]'
                          }`}
                        >
                          <div 
                            className={`prose max-w-none text-sm ${
                              message.type === 'user' 
                                ? 'text-white' 
                                : 'text-gray-800'
                            }`}
                            dangerouslySetInnerHTML={{ 
                              __html: message.content
                            }}
                          />
                          {message.sources && message.sources.length > 0 && (
                            <div className="mt-2 text-xs border-t border-[#FE330120] pt-2">
                              <div className={message.type === 'user' ? 'text-white' : 'text-gray-600'}>
                                Sources:
                              </div>
                              {message.sources.map((source, idx) => (
                                <div key={idx} className="ml-2">
                                  • {source.title}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {(isTyping || isLoading) && (
                      <div className="w-full">
                        <div className="bg-gradient-to-r from-[#FFF5F2] to-[#FFF9F7] rounded-lg p-4 border border-[#FE330115]">
                          <div className="flex space-x-2 justify-center items-center">
                            <span className="sr-only">Loading...</span>
                            <div className="h-3 w-3 bg-[#FE3301] rounded-full animate-loading-bounce [animation-delay:-0.3s]"></div>
                            <div className="h-3 w-3 bg-[#FE3301] rounded-full animate-loading-bounce [animation-delay:-0.15s]"></div>
                            <div className="h-3 w-3 bg-[#FE3301] rounded-full animate-loading-bounce"></div>
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
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <style jsx global>{`
        /* Non-linear gradient background */
        .fixed.inset-0 {
          background: 
            radial-gradient(circle at 20% 20%, rgba(254, 51, 1, 0.05) 0%, transparent 50%),
            radial-gradient(circle at 80% 30%, rgba(254, 51, 1, 0.04) 0%, transparent 40%),
            radial-gradient(circle at 40% 70%, rgba(254, 51, 1, 0.06) 0%, transparent 45%),
            radial-gradient(circle at 70% 80%, rgba(254, 51, 1, 0.05) 0%, transparent 35%),
            linear-gradient(135deg, 
              rgba(254, 51, 1, 0.02) 0%,
              rgba(254, 51, 1, 0.04) 25%,
              rgba(254, 51, 1, 0.03) 50%,
              rgba(254, 51, 1, 0.05) 75%,
              rgba(254, 51, 1, 0.02) 100%
            );
        }

        /* Remove the split gradient sections */
        .bg-gradient-radial-bottom,
        .bg-gradient-conic-bottom,
        .top-gradient {
          display: none;
        }

        /* Update question text color */
        .prose .question-text {
          color: #000000 !important; /* Set color to black */
          font-weight: 500; /* Set font weight */
        }

        /* Update bot message container background */
        .max-w-[80%]:not(.bg-[#FE3301]) {
          background: linear-gradient(145deg,
            rgba(254, 51, 1, 0.03) 0%,
            rgba(254, 51, 1, 0.05) 50%,
            rgba(254, 51, 1, 0.03) 100%
          );
          backdrop-filter: blur(8px);
        }

        /* Loading indicator animation */
        @keyframes loading-bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-loading-bounce {
          animation: loading-bounce 0.6s infinite;
          will-change: transform;
        }

        /* Card background */
        .bg-white\/80 {
          background: rgba(255, 255, 255, 0.9) !important;
          backdrop-filter: blur(12px);
          border: 1px solid rgba(254, 51, 1, 0.1);
        }

        /* Accent decorations */
        .accent-circle {
          opacity: 0.4;
          mix-blend-mode: multiply;
        }

        /* Add word breaking and wrapping for links */
        .prose a {
          word-break: break-word;
          overflow-wrap: break-word;
          display: inline-block;
          max-width: 100%;
        }

        /* Update the message container styles */
        .max-w-[80%] {
          overflow-wrap: break-word;
          word-wrap: break-word;
          word-break: break-word;
          hyphens: auto;
        }

        /* Update prose container */
        .prose {
          overflow-wrap: break-word;
          word-wrap: break-word;
          word-break: break-word;
          max-width: 100%;
        }

        /* Ensure sources stay contained */
        .mt-2.text-xs.border-t {
          word-break: break-word;
          overflow-wrap: break-word;
        }

        /* Style adjustments for links in sources */
        .mt-3.text-xs a {
          word-break: break-word;
          overflow-wrap: break-word;
          display: inline-block;
          max-width: 100%;
        }

        /* Add padding for better text wrapping */
        .rounded-lg.p-4 {
          padding: 1rem;
          overflow: hidden;
        }

        /* Ensure all text content wraps properly */
        .prose * {
          overflow-wrap: break-word;
          word-wrap: break-word;
          word-break: break-word;
        }

        /* Message container styles */
        .w-full {
          margin: 0.75rem 0;
        }

        /* Question (User) message gradient */
        .bg-gradient-to-r.from-\[#FE3301\] {
          background: linear-gradient(
            135deg,
            #FE3301 0%,
            #FF6B47 100%
          );
          box-shadow: 0 2px 8px rgba(254, 51, 1, 0.15);
        }

        /* Answer (Bot) message gradient */
        .bg-gradient-to-r.from-\[#FFF5F2\] {
          background: linear-gradient(
            135deg,
            #FFF5F2 0%,
            #FFF9F7 100%
          );
          box-shadow: 0 2px 4px rgba(254, 51, 1, 0.05);
        }

        /* Responsive message width adjustments */
        @media (max-width: 640px) {
          .max-w-[80%] {
            max-width: 85%;
          }
        }

        /* Link styles */
        .prose a {
          word-break: break-word;
          overflow-wrap: break-word;
          display: inline-block;
          max-width: 100%;
        }

        /* Loading animation */
        @keyframes loading-bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-loading-bounce {
          animation: loading-bounce 0.6s infinite;
          will-change: transform;
        }

        /* Card hover effects */
        .rounded-lg {
          transition: transform 0.2s ease;
        }

        .rounded-lg:hover {
          transform: translateY(-1px);
        }

        /* Ensure proper spacing in mobile */
        @media (max-width: 640px) {
          .space-y-4 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 1rem;
          }
          
          .p-4 {
            padding: 1rem;
          }
        }
      `}</style>

      <div className="accent-circle"></div>
      <div className="accent-circle"></div>
      <div className="top-gradient"></div>
    </div>
  );
}

// Utility component for formatted chat responses
const FormattedChatResponse: React.FC<FormattedResponse> = ({ content, metadata }) => {
  return (
    <div className="formatted-chat-response">
      {metadata?.category && (
        <div className="text-xs text-gray-500 mb-2">
          Category: {metadata.category}
        </div>
      )}
      <div 
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: content }}
      />
      {metadata?.sources && metadata.sources.length > 0 && (
        <div className="mt-3 text-xs text-gray-500">
          <div className="font-medium mb-1">Sources:</div>
          <div className="space-y-1">
            {metadata.sources.map((source, index) => (
              <div key={index}>
                {source.title}
                {source.url && (
                  <a 
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-[#FE3301] hover:underline"
                  >
                    (link)
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {metadata?.timestamp && (
        <div className="text-[10px] text-gray-400 mt-2">
          {new Date(metadata.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};
