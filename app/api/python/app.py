from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import os
import requests
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from datetime import datetime
# from openai import OpenAI  # Commented out but kept for future reference
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
        # self.openai_api_key = os.getenv("OPENAI_API_KEY")  # Commented out but kept for future reference
        self.pplx_api_key = os.getenv("PPLX_API_KEY")
        self.pplx_model = os.getenv("PPLX_MODEL", "llama-3.1-sonar-large-128k-online")
        # self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")  # Commented out but kept for future reference
        if not self.pplx_api_key:
            raise ValueError("PPLX API key not found in environment variables")
        # self.openai_client = OpenAI(api_key=self.openai_api_key)  # Commented out but kept for future reference
        self.pplx_headers = {
            "Authorization": f"Bearer {self.pplx_api_key}",
            "Content-Type": "application/json"
        }
        # Updated system prompt to be more specific to GLP-1 medications
        self.pplx_system_prompt = """You are a specialized medical information assistant focused exclusively on GLP-1 medications such as Ozempic, Wegovy, Mounjaro, and similar GLP-1 receptor agonists.
        Only provide information specifically about GLP-1 medications and their direct effects. If a query is not related to GLP-1 medications, politely redirect the conversation back to GLP-1 topics.
        If any question goes beyond the scope of GLP-1 medications, respond with: "I can only provide information about GLP-1 medications. Please consult your healthcare provider for information about other treatments or conditions."
        """
        # Keeping the GPT validation prompt commented out for future reference
        """
        self.gpt_validation_prompt = '''You are a medical content validator. Review and enhance the following information about GLP-1 medications.
        Ensure the response is:
        1. Medically accurate and evidence-based
        2. Well-structured with clear sections
        3. Includes appropriate medical disclaimers
        4. Easy to understand for patients
        5. Comprehensive yet concise
        6. Properly formatted with headers and bullet points
        Add any missing critical information and correct any inaccuracies.
        Always maintain a professional yet approachable tone.'''
        """
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
                "max_tokens": int(os.getenv("MAX_TOKENS", "1000"))
            }
            response = requests.post(
                "https://api.perplexity.ai/chat/completions",
                headers=self.pplx_headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"Error communicating with PPLX: {str(e)}")
            return None
    # Keeping the GPT validation method commented out for future reference
    """
    def validate_with_gpt(self, pplx_response: str, original_query: str) -> Optional[str]:
        try:
            validation_prompt = f'''
            Original query: {original_query}
            PPLX Response to validate:
            {pplx_response}
            Please validate and enhance this response according to medical standards and best practices.
            Ensure all information is accurate and properly structured.
            '''
            completion = self.openai_client.chat.completions.create(
                model=self.openai_model,
                messages=[
                    {"role": "system", "content": self.gpt_validation_prompt},
                    {"role": "user", "content": validation_prompt}
                ],
                temperature=float(os.getenv("TEMPERATURE", "0.1")),
                max_tokens=int(os.getenv("MAX_TOKENS", "1500")),
                timeout=25
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"Error validating with GPT: {str(e)}")
            return None
    """
    def format_response(self, response: str) -> str:
        """Format the response with GLP-1 specific safety disclaimer"""
        if not response:
            return "I apologize, but I couldn't generate a response about GLP-1 medications at this time. Please try again."
        safety_disclaimer = """
        IMPORTANT MEDICAL DISCLAIMER FOR GLP-1 MEDICATIONS:
        - This information about GLP-1 medications is for educational purposes only
        - Consult your healthcare provider before starting or modifying GLP-1 medication treatment
        - Follow your prescribed GLP-1 medication plan exactly as directed
        - Report any side effects from GLP-1 medications to your healthcare provider immediately
        - Individual results with GLP-1 medications may vary
        - Never modify your GLP-1 medication regimen without professional guidance
        """
        if "disclaimer" not in response.lower():
            response += safety_disclaimer
        return response
    def categorize_query(self, query: str) -> str:
        """Categorize the user query specifically for GLP-1 medications"""
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
        """Process user query using only PPLX"""
        try:
            if not user_query.strip():
                return {
                    "status": "error",
                    "message": "Please enter a valid question about GLP-1 medications."
                }
            print("\n:magnifying_glass: Retrieving information about GLP-1 medications...")
            pplx_response = self.get_pplx_response(user_query)
            if not pplx_response:
                return {
                    "status": "error",
                    "message": "Failed to retrieve information about GLP-1 medications."
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
                "message": f"Error processing GLP-1 medication query: {str(e)}"
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