import requests
import json
from typing import Dict, Any, Optional, Generator, List, ClassVar
import os
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from datetime import datetime
import logging
from openai import OpenAI
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_session():
    if not hasattr(get_session, 'session'):
        session = requests.Session()
        retry = Retry(total=3, backoff_factor=0.1)
        adapter = HTTPAdapter(max_retries=retry)
        session.mount('http://', adapter)
        session.mount('https://', adapter)
        get_session.session = session
    return get_session.session

def get_openai_client():
    try:
        if not hasattr(get_openai_client, 'client'):
            api_key = os.environ.get('OPENAI_API_KEY')
            if not api_key:
                logger.error("OpenAI API key not found")
                raise ValueError("OpenAI API key not provided")
            get_openai_client.client = OpenAI(api_key=api_key)
        return get_openai_client.client
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {str(e)}")
        raise

def init_app():
    app = Flask(__name__)
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:3000", "https://glp-1-lovat.vercel.app"],
            "methods": ["POST", "GET", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    return app

app = init_app()

class UserProfileManager:
    def __init__(self, openai_client: OpenAI):
        self.client = openai_client
        self.system_instructions = {
            "personal_info": """
            You are a medical system assistant collecting personal information.
            
            OBJECTIVE:
            Extract personal information from user input, focusing on three key fields:
            1. name
            2. age
            3. location

            RULES:
            1. Only extract information that is explicitly stated
            2. Format response as JSON: {"name": "", "age": "", "location": ""}
            3. If a field is missing, leave it empty
            4. For age, only accept numeric values
            """,

            "medical_info": """
            You are a medical system assistant collecting information about a patient's condition.
            
            OBJECTIVE:
            Extract medical information from user input, focusing on three key fields:
            1. diagnosis
            2. concern
            3. target

            RULES:
            1. Only extract information that is explicitly stated
            2. Format response as JSON: {"diagnosis": "", "concern": "", "target": ""}
            3. If a field is missing, leave it empty
            4. Keep medical terminology as stated by the user
            """
        }

    def process_user_input(self, user_input: str, info_type: str) -> Dict[str, str]:
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": self.system_instructions[info_type]},
                    {"role": "user", "content": user_input}
                ]
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Error processing input: {str(e)}")
            return {}

class HealthAssistant:
    _instance: ClassVar[Optional['HealthAssistant']] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.initialized = False
        return cls._instance
    
    def __init__(self):
        """Initialize GLP-1 capabilities"""
        if self.initialized:
            return
            
        # GLP-1 Configuration
        self.pplx_api_key = os.environ.get('PPLX_API_KEY')
        if not self.pplx_api_key:
            raise ValueError("PPLX API key not provided")
        
        self.pplx_model = "llama-3.1-sonar-large-128k-online"
        self.pplx_headers = {
            "Authorization": f"Bearer {self.pplx_api_key}",
            "Content-Type": "application/json"
        }
        
        self.pplx_system_prompt = """
You are a specialized medical information assistant focused EXCLUSIVELY on GLP-1 medications (such as Ozempic, Wegovy, Mounjaro, etc.) and healthy eating habits. You must:

1. ONLY provide information about GLP-1 medications and directly related topics, including dietary recommendations
2. For any query not specifically about GLP-1 medications or their direct effects, respond with:
   "I apologize, but I can only provide information about GLP-1 medications and related topics. Your question appears to be about something else. Please ask a question specifically about GLP-1 medications, their usage, effects, or related concerns."

3. For valid GLP-1 queries, structure your response with:
   - An empathetic opening acknowledging the patient's situation
   - Clear, validated medical information about GLP-1 medications
   - Important safety considerations or disclaimers
   - An encouraging closing that reinforces their healthcare journey

4. Provide response in a simple manner that is easy to understand at preferably a 11th grade literacy level with reduced pharmaceutical or medical jargon
5. Always Return sources in a hyperlink format
"""
        # Conversation History Management
        self.conversation_history = []
        self.max_history_length = 5
        self.session = get_session()
        
        self.initialized = True

    def get_glp1_response(self, query: str) -> Dict[str, Any]:
        """Get response for GLP-1 related queries"""
        try:
            if not query.strip():
                return {
                    "status": "error",
                    "message": "Please enter a valid question."
                }
            
            response = self.get_pplx_response(query)
            return response
            
        except Exception as e:
            logger.error(f"Error in get_glp1_response: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }

    def get_pplx_response(self, query: str) -> Dict[str, Any]:
        """Get response while maintaining conversation context"""
        try:
            # Build messages including conversation history
            messages = [
                {"role": "system", "content": self.pplx_system_prompt}
            ]
            
            # Add conversation history
            for exchange in self.conversation_history:
                messages.append({"role": "user", "content": exchange["query"]})
                messages.append({"role": "assistant", "content": exchange["response"]})
            
            # Add current query
            messages.append({
                "role": "user", 
                "content": f"{query}\n\nPlease include sources for the information provided, formatted as 'Title: URL' on separate lines."
            })
            
            logger.info(f"Sending request with messages: {messages}")
            
            payload = {
                "model": self.pplx_model,
                "messages": messages,
                "temperature": 0.1,
                "max_tokens": 1500
            }
            
            response = self.session.post(
                "https://api.perplexity.ai/chat/completions",
                headers=self.pplx_headers,
                json=payload
            )
            
            logger.info(f"API Response status: {response.status_code}")
            
            response.raise_for_status()
            response_data = response.json()
            content = response_data['choices'][0]['message']['content']
            
            # Update conversation history
            self.conversation_history.append({
                "query": query,
                "response": content,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            
            # Maintain history size
            if len(self.conversation_history) > self.max_history_length:
                self.conversation_history.pop(0)
            
            logger.info(f"Generated response: {content[:100]}...")
            
            return {
                "status": "success",
                "query": query,
                "query_category": self.categorize_query(query),
                "response": content.strip(),
                "disclaimer": "Always consult your healthcare provider before making any changes to your medication or treatment plan.",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "conversation_history": self.conversation_history
            }
            
        except Exception as e:
            logger.error(f"Error in get_pplx_response: {str(e)}")
            return {
                "status": "error",
                "query": query,
                "query_category": "error",
                "response": f"An error occurred: {str(e)}",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
    
    def clear_conversation_history(self):
        """Clear the conversation history"""
        self.conversation_history = []
    
    def get_conversation_history(self) -> List[Dict[str, Any]]:
        """Get the current conversation history"""
        return self.conversation_history

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

def get_profile_manager():
    client = get_openai_client()
    return UserProfileManager(client)

# Flask routes
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

        assistant = HealthAssistant()
        response = assistant.get_glp1_response(query)
        
        logger.info(f"Chat response: {response}")
        
        return jsonify(response)

    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'}), 200

@app.route('/api/profile/personal', methods=['POST'])
def process_personal_info():
    try:
        data = request.get_json()
        user_input = data.get('input')
        
        if not user_input:
            return jsonify({
                "status": "error",
                "message": "No input provided"
            }), 400

        profile_manager = get_profile_manager()
        result = profile_manager.process_user_input(user_input, "personal_info")
        
        return jsonify({
            "status": "success",
            "data": result
        })

    except Exception as e:
        logger.error(f"Error in process_personal_info: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/profile/medical', methods=['POST'])
def process_medical_info():
    try:
        data = request.get_json()
        user_input = data.get('input')
        
        if not user_input:
            return jsonify({
                "status": "error",
                "message": "No input provided"
            }), 400

        profile_manager = get_profile_manager()
        result = profile_manager.process_user_input(user_input, "medical_info")
        
        return jsonify({
            "status": "success",
            "data": result
        })

    except Exception as e:
        logger.error(f"Error in process_medical_info: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/chat-history', methods=['GET'])
def get_chat_history():
    try:
        assistant = HealthAssistant()
        history = assistant.get_chat_history()
        
        return jsonify({
            "status": "success",
            "history": history
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'public, max-age=300'  # Cache for 5 minutes
    return response

if __name__ == '__main__':
    print("Starting Flask server on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
