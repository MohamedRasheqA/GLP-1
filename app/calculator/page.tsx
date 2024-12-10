'use client'

import { useState } from 'react'
import Image from 'next/image'

interface AnalysisResult {
  analysis: string
  category: string
  confidence: number
  status: string
  timestamp: string
}

export default function Calculator() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setSelectedImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const analyzeImage = async () => {
    if (!selectedImage) return

    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/calculator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: selectedImage }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || 'Failed to analyze image')
      }

      const result = await response.json()
      console.log('Analysis result:', result)
      setAnalysisResult(result)
    } catch (error) {
      console.error('Error analyzing image:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
      setAnalysisResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Food Image Analysis</h1>
      
      <div className="space-y-4">
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
        />

        {selectedImage && (
          <div className="relative w-64 h-64">
            <Image
              src={selectedImage}
              alt="Selected food image"
              fill
              className="object-cover rounded-lg"
            />
          </div>
        )}

        <button
          onClick={analyzeImage}
          disabled={!selectedImage || isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {isLoading ? 'Analyzing...' : 'Analyze Image'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {analysisResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Analysis Results</h2>
            <p className="mb-2">
              <strong>Category:</strong> {analysisResult.category || 'N/A'}
            </p>
            <p className="mb-2">
              <strong>Confidence:</strong> 
              {analysisResult.confidence ? `${analysisResult.confidence.toFixed(2)}%` : 'N/A'}
            </p>
            <p className="whitespace-pre-line">
              {analysisResult.analysis || 'No analysis available'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
