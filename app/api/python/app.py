from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import os
import requests
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from datetime import datetime
app = Flask(__name__)
CORS(app,
     resources={
         r"/api/*": {
             "origins": ["https://glp-1.vercel.app"],
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
class GLP1Bot:
    def __init__(self):
        self.pplx_api_key = os.getenv("PPLX_API_KEY")
        self.pplx_model = os.getenv("PPLX_MODEL", "llama-3.1-sonar-large-128k-online")
        if not self.pplx_api_key:
            raise ValueError("PPLX API key not found in environment variables")
        self.pplx_headers = {
            "Authorization": f"Bearer {self.pplx_api_key}",
            "Content-Type": "application/json"
        }
        self.pplx_system_prompt = """You are a comprehensive medical information assistant specialized in GLP-1 medications.
        Provide detailed, evidence-based information about GLP-1 medications, focusing on medical accuracy and completeness.
        Your responses should:
        1. Be medically accurate and evidence-based
        2. Have clear, well-structured sections
        3. Include appropriate medical disclaimers
        4. Be easy for patients to understand
        5. Be comprehensive yet concise
        6. Use proper formatting with headers and bullet points
        Always maintain a professional yet approachable tone and include necessary safety disclaimers."""
    def get_pplx_response(self, query: str) -> Optional[str]:
        """Get response from PPLX API"""
        try:
            payload = {
                "model": self.pplx_model,
                "messages": [
                    {"role": "system", "content": self.pplx_system_prompt},
                    {"role": "user", "content": query}
                ],
                "temperature": float(os.getenv("TEMPERATURE", "0.1")),
                "max_tokens": int(os.getenv("MAX_TOKENS", "1500"))
            }
            response = requests.post(
                "https://api.perplexity.ai/chat/completions",
                headers=self.pplx_headers,
                json=payload,
                timeout=580
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"Error communicating with PPLX: {str(e)}")
            return None
    def format_response(self, response: str) -> str:
               return response
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
    def process_query(self, user_query: str) -> Dict[str, Any]:
        """Process user query through PPLX"""
        try:
            if not user_query.strip():
                return {
                    "status": "error",
                    "message": "Please enter a valid question."
                }
            print("\n:magnifying_glass: Retrieving information from medical knowledge base...")
            pplx_response = self.get_pplx_response(user_query)
            if not pplx_response:
                return {
                    "status": "error",
                    "message": "Failed to retrieve information from knowledge base."
                }
            query_category = self.categorize_query(user_query)
            formatted_response = self.format_response(pplx_response)
            return {
                "status": "success",
                "query_category": query_category,
                "original_query": user_query,
                "response": formatted_response,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error processing query: {str(e)}"
            }
bot = GLP1Bot()
@app.route('/api/chat', methods=['OPTIONS'])
def handle_options():
    response = jsonify({})
    response.headers.add('Access-Control-Allow-Origin', 'https://glp-1.vercel.app')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
    return response, 200
@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        query = data.get('query')
        if not query:
            return jsonify({
                "status": "error",
                "message": "No query provided"
            }), 400
        response = bot.process_query(query)
        return jsonify(response), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'https://glp-1.vercel.app')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response
if __name__ == '__main__':
    app.run(port=5000)