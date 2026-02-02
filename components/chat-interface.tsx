import { useState, useRef, useEffect } from 'react'
import { Input } from "@/components/ui/input"
import { Loader2, MessageCircle, X, Send } from 'lucide-react'
import type { Timestamp } from '@/types'

interface Message {
  content: string
  role: 'user' | 'assistant'
}

interface ChatInterfaceProps {
  timestamps: Timestamp[]
  className?: string
}

export default function ChatInterface({ timestamps, className = '' }: ChatInterfaceProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = { content: input, role: 'user' as const }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage], events: timestamps })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get response')
      }
      
      const data = await response.json()
      setMessages(prev => [...prev, data])
    } catch (error: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to process your message.'}`
      }])
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 rounded-full p-4 bg-mint text-gray-dark shadow-lg shadow-mint/20 hover:bg-mint-light transition-colors z-50 ${className}`}
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    )
  }

  return (
    <div className={`fixed bottom-6 right-6 w-80 h-[450px] bg-[#111] rounded-2xl shadow-2xl border border-white/10 flex flex-col z-50 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h3 className="font-medium text-white">AI Assistant</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          <X className="h-4 w-4 text-gray" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray text-sm text-center py-8">
            Ask me about the detected events
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-mint text-gray-dark'
                  : 'bg-white/5 text-white'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 rounded-xl px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-mint" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-white/5">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray/50 text-sm"
            disabled={isLoading}
          />
          <button 
            type="submit"
            disabled={isLoading}
            className="p-2.5 bg-mint text-gray-dark rounded-lg hover:bg-mint-light transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  )
}
