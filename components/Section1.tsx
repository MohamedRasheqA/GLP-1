import React from 'react'
import { Button } from "@/components/ui/button"
import { Heart, MessageCircle } from "lucide-react"

interface Section1Props {
  isSignedIn: boolean;
  onSignIn: () => void;
}

const Section1: React.FC<Section1Props> = ({ isSignedIn, onSignIn }) => {
  return (
    <>
    <section className="bg-blue-50 text-blue-900">
      <div className="container mx-auto px-4 py-16 flex flex-col items-center text-center min-h-[calc(50vh-4rem)]">
        <div className="flex items-center mb-6">
          <Heart className="w-12 h-12 text-green-500 mr-4" />
          <h1 className="text-blue-700 text-4xl md:text-5xl lg:text-6xl font-bold font-sans">
            Welcome to GLP-1 Assistant
          </h1>
        </div>
        
        <p className="text-blue-800 text-lg md:text-xl lg:text-2xl mb-8 max-w-3xl font-sans">
          Your AI-powered companion for all things related to GLP-1. Get expert advice, diet recommendations, your prescriptions, and more.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          
            <Button
              asChild
              size="lg"
              className="bg-green-500 text-white hover:bg-green-600 transition-colors duration-300"
            >
              <a href="/chat" className="flex items-center">
                <MessageCircle className="mr-2 h-5 w-5" />
                Start Chatting
              </a>
            </Button>
        </div>
      </div>
    </section>

    </>
  )
}


export default Section1