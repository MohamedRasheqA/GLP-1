import requests
import json
from typing import Dict, Any, Optional, Generator
import os
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime
import re


app = Flask(__name__)
CORS(app,
     resources={
         r"/api/*": {
             "origins": ["http://localhost:3000", "https://glp-1-lovat.vercel.app", "https://glp-1-xplo.vercel.app"],
             "methods": ["POST", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization"],
             "expose_headers": ["Content-Type"],
             "max_age": 86400,
             "supports_credentials": True
         }
     })

load_dotenv()

@app.route('/')
@app.route('/database')
def serve_spa():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        query = data.get('query')
        
        if not query:
            return jsonify({
                "status": "error",
                "message": "No query provided"
            }), 400

        # Initialize bot with API key from environment
        bot = GLP1Bot()
        response = bot.get_response(query)
        
        # Add status field to match frontend expectations
        response["status"] = "success"
        response["timestamp"] = datetime.now().isoformat()
        
        return jsonify(response)

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

class GLP1Bot:
    def __init__(self, api_key: str = None):
        """Initialize the GLP1Bot with PPLX client and system prompts"""
        self.pplx_api_key = api_key or os.getenv('PPLX_API_KEY')
        if not self.pplx_api_key:
            raise ValueError("PPLX API key not provided")
            
        self.pplx_model = "llama-3.1-sonar-large-128k-online"  
        
        self.pplx_headers = {
            "Authorization": f"Bearer {self.pplx_api_key}",
            "Content-Type": "application/json"
        }
        
        self.pplx_system_prompt = """
You are a specialized medical information assistant focused EXCLUSIVELY on GLP-1 medications (such as Ozempic, Wegovy, Mounjaro, etc.). You must:

1. ONLY provide information about GLP-1 medications and directly related topics
2. For any query not specifically about GLP-1 medications or their direct effects, respond with:
   "I apologize, but I can only provide information about GLP-1 medications and related topics. Your question appears to be about something else. Please ask a question specifically about GLP-1 medications, their usage, effects, or related concerns."

3. For valid GLP-1 queries, structure your response with:
   - An empathetic opening acknowledging the patient's situation
   - Clear, validated medical information about GLP-1 medications
   - Important safety considerations or disclaimers
   - An encouraging closing that reinforces their healthcare journey

4. Always provide source citations which is related to the generated response. Importantly only provide sources for about GLP-1 medications
5. Provide response in a simple manner that is easy to understand at preferably a 11th grade literacy level with reduced pharmaceutical or medical jargon
6. Always Return sources in a hyperlink format

Remember: You must NEVER provide information about topics outside of GLP-1 medications and their direct effects.
Each response must include relevant medical disclaimers and encourage consultation with healthcare providers.
"""

    def get_response(self, query: str) -> Dict[str, Any]:
        """Get response from PPLX API"""
        try:
            if not query.strip():
                return {
                    "status": "error",
                    "message": "Please enter a valid question."
                }
            
            payload = {
                "model": self.pplx_model,
                "messages": [
                    {"role": "system", "content": self.pplx_system_prompt},
                    {"role": "user", "content": f"{query}\n\nPlease include sources for the information provided, formatted as 'Title: URL' on separate lines."}
                ],
                "temperature": 0.1,
                "max_tokens": 1500
            }
            
            response = requests.post(
                "https://api.perplexity.ai/chat/completions",
                headers=self.pplx_headers,
                json=payload
            )
            
            response.raise_for_status()
            response_data = response.json()
            content = response_data['choices'][0]['message']['content']
            
            query_category = self.categorize_query(query)
            
            return {
                "query": query,
                "query_category": query_category,
                "response": content.strip(),
                "disclaimer": "Always consult your healthcare provider before making any changes to your medication or treatment plan.",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
        except Exception as e:
            return {
                "status": "error",
                "query": query,
                "message": f"Error processing query: {str(e)}",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

    def categorize_query(self, query: str) -> str:
        """Categorize the user query"""
        categories = {
            "dosage": ["dose", "dosage", "how to take", "when to take", "injection", "administration"],
            "side_effects": ["side effect", "adverse", "reaction", "problem", "issues", "symptoms"],
            "benefits": ["benefit", "advantage", "help", "work", "effect", "weight", "glucose"],
            "storage": ["store", "storage", "keep", "refrigerate", "temperature"],
            "lifestyle": ["diet", "exercise", "lifestyle", "food", "alcohol", "eating"],
            "interactions": ["interaction", "drug", "medication", "combine", "mixing"],
            "cost": ["cost", "price", "insurance", "coverage", "afford"]
        }
        
        query_lower = query.lower()
        for category, keywords in categories.items():
            if any(keyword in query_lower for keyword in keywords):
                return category
        return "general"

def main():
    """Main function to run the GLP-1 Assistant"""
    try:
        bot = GLP1Bot()
        
        while True:
            query = input("Enter your question (or 'quit' to exit): ").strip()
            
            if query.lower() == 'quit':
                response_data = {
                    "status": "exit",
                    "message": "Thank you for using the GLP-1 Medication Assistant. Goodbye!",
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                print(json.dumps(response_data, indent=2))
                break
            
            if query:
                response = bot.get_response(query)
                print(json.dumps(response, indent=2))
            else:
                error_response = {
                    "status": "error",
                    "message": "Please enter a valid question.",
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                print(json.dumps(error_response, indent=2))
                
    except Exception as e:
        error_response = {
            "status": "error",
            "message": f"An error occurred: {str(e)}",
            "details": "Please check your configuration and try again.",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        print(json.dumps(error_response, indent=2))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
