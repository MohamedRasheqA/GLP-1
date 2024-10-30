import React from 'react'
import Link from 'next/link'

const Footer: React.FC = () => {
  return (
    <footer className="bg-black text-white py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div className="flex flex-col space-y-4">
            <h3 className="text-[rgba(23,155,215,255)] font-semibold text-lg">About GLP-1</h3>
            <p className="text-sm text-gray-300">
              Providing expert guidance and information about GLP-1 agonists for type 2 diabetes and obesity management.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col space-y-4">
            <h3 className="text-[rgba(23,155,215,255)] font-semibold text-lg">Quick Links</h3>
            <nav>
              <ul className="space-y-2">
                <li>
                  <Link 
                    href="/about" 
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/resources" 
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    Resources
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/contact" 
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          {/* Legal */}
          <div className="flex flex-col space-y-4">
            <h3 className="text-[rgba(23,155,215,255)] font-semibold text-lg">Legal</h3>
            <nav>
              <ul className="space-y-2">
                <li>
                  <Link 
                    href="/terms" 
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/privacy" 
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/disclaimer" 
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    Medical Disclaimer
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-300 mb-4 md:mb-0">
            © {new Date().getFullYear()} GLP-1 Assistant. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <a 
              href="https://twitter.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-gray-300 hover:text-white transition-colors"
            >
              Twitter
            </a>
            <a 
              href="https://linkedin.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-gray-300 hover:text-white transition-colors"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer