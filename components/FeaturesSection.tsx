import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, LayoutDashboard, Pill, Info } from "lucide-react"

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => (
  <Card className="bg-blue-50 border-blue-200 hover:shadow-md transition-shadow duration-300">
    <CardHeader>
      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
        {React.cloneElement(icon as React.ReactElement, { className: "text-green-600" })}
      </div>
      <CardTitle className="text-xl font-sans text-blue-800">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-blue-700 font-sans">{description}</p>
    </CardContent>
  </Card>
)

const FeaturesSection: React.FC = () => {
  return (
    <section className="bg-white py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-blue-900 text-3xl md:text-4xl font-bold mb-12 text-center font-sans">
          Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<MessageSquare size={32} />}
            title="Expert Information"
            description="Get instant answers to your questions about GLP-1 medications from our AI assistant."
          />
          <FeatureCard
            icon={<LayoutDashboard size={32} />}
            title="Treatment Guidance"
            description="Learn about treatment options and management strategies for type 2 diabetes and obesity."
          />
          <FeatureCard
            icon={<Pill size={32} />}
            title="Medication Management"
            description="Understand dosing, administration, and monitoring of GLP-1 agonists."
          />
          <FeatureCard
            icon={<Info size={32} />}
            title="About GLP-1"
            description="Glucagon-like peptide-1 (GLP-1) agonists are medications for type 2 diabetes mellitus and obesity, working to lower serum glucose levels and manage metabolism."
          />
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection;