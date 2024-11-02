import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Heart, Home, MessageCircle } from "lucide-react"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-blue-200 bg-blue-50 shadow-sm">
      <div className="container flex h-16 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Heart className="h-8 w-8 text-green-500" />
            <span className="hidden font-bold text-xl text-blue-700 sm:inline-block font-sans">
              GLP-1 Assistant
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-base font-medium">
            <Link href="/">
              <Button variant="ghost" className="flex items-center text-blue-600 hover:text-blue-800 hover:bg-blue-100">
                <Home className="mr-2 h-5 w-5" />
                Home
              </Button>
            </Link>
            <Link href="/chat">
              <Button variant="ghost" className="flex items-center text-blue-600 hover:text-blue-800 hover:bg-blue-100">
                <MessageCircle className="mr-2 h-5 w-5" />
                Chat
              </Button>
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <Button variant="outline" className="inline-flex items-center md:hidden text-blue-700 border-blue-300 hover:bg-blue-100">
              <Heart className="mr-2 h-5 w-5 text-green-500" />
              <span className="font-sans">GLP-1 Assistant</span>
            </Button>
          </div>
          <nav className="flex items-center md:hidden">
            <Link href="/">
              <Button variant="ghost" size="lg" className="text-blue-600 hover:text-blue-800 hover:bg-blue-100">
                <Home className="h-6 w-6" />
                <span className="sr-only">Home</span>
              </Button>
            </Link>
            <Link href="/chat">
              <Button variant="ghost" size="lg" className="text-blue-600 hover:text-blue-800 hover:bg-blue-100">
                <MessageCircle className="h-6 w-6" />
                <span className="sr-only">Chat</span>
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}