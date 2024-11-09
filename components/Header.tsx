import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Heart, Home, MessageCircle } from "lucide-react"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-blue-200 bg-blue-50 shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        <div className="mr-4 flex items-center justify-between w-full">
          <Link href="/" className="ml-8 flex items-center space-x-2">
            <Heart className="h-8 w-8 text-green-500" />
            <span className="font-bold text-base text-blue-700 sm:inline-block font-sans">
              GLP-1 Assistant
            </span>
          </Link>
          <nav className="flex items-center space-x-3 text-base font-medium">
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
      </div>
    </header>
  )
}
