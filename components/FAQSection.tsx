import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HelpCircle } from "lucide-react"

interface FAQCardProps {
  question: string;
  answer: string;
}

const FAQCard: React.FC<FAQCardProps> = ({ question, answer }) => (
  <Card className="bg-blue-50 border-blue-200 hover:shadow-md transition-shadow duration-300">
    <CardHeader>
      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
        <HelpCircle size={32} className="text-green-600" />
      </div>
      <CardTitle className="text-xl font-sans text-blue-800">{question}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-blue-700 font-sans">{answer}</p>
    </CardContent>
  </Card>
)

const FAQSection: React.FC = () => {
  const faqs = [
    {
      question: "How do GLP-1 medications work?",
      answer: "GLP-1s help produce more of this hormone, impact hunger signaling, and slow down gastric emptying. This can lead to feeling 'full' for longer periods, making it easier to manage food intake."
    },
    {
      question: "What are the benefits of GLP-1 medications?",
      answer: "GLP-1 medications can impact overall longevity and well-being. However, without integration with behavioral medicine and lifestyle changes, these benefits will likely end when patients stop taking GLP-1 medications."
    },
    {
      question: "What are the most common side effects of GLP-1 medications?",
      answer: "The most common side effects include nausea, vomiting, diarrhea, stomach pain, low appetite, fatigue, and dizziness. There is also a risk of low blood sugar, which is more likely if you take other medications to manage blood sugar."
    },
    {
      question: "What are the consequences of not taking this medication?",
      answer: "This depends on why GLP-1 medications were recommended to you. If you choose not to take them, you may continue to have the same health status with regards to your diabetes, weight, or liver function."
    },
    {
      question: "How much do GLP-1 medications cost?",
      answer: "GLP-1s can be quite costly. The list price before insurance is ~$900-1400/month. Insurance may cover part or none of this cost. Approximately 20% of insured adults pay for GLP-1s fully out of pocket, while the cost is fully covered by insurance for ~25% of adults."
    }
  ]

  return (
    <section className="bg-white py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-blue-900 text-3xl md:text-4xl font-bold mb-12 text-center font-sans">
          Frequently Asked Questions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {faqs.map((faq, index) => (
            <FAQCard key={index} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default FAQSection