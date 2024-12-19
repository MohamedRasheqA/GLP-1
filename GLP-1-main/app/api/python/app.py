import requests
import json
from typing import Dict, Any, Optional, Generator, List, ClassVar
import os
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime
# import io  # Commented out - used for image processing
# import base64  # Commented out - used for image encoding/decoding
import logging
from openai import OpenAI

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "https://glp-1-lovat.vercel.app"],
        "methods": ["POST", "GET", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

load_dotenv()

"""
Food Analysis Configuration - Currently Disabled
These labels were used for categorizing food images:
LABELS = [
    "Clearly Healthy",
    "Borderline", 
    "Mixed",
    "Clearly Unhealthy"
]
"""

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
        self.pplx_api_key = os.getenv('PPLX_API_KEY')
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
        # OpenAI Configuration
        self.openai_client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        if not os.getenv('OPENAI_API_KEY'):
            raise ValueError("OpenAI API key not provided")

        # Conversation History Management
        self.conversation_history = []
        self.max_history_length = 5
        
        self.initialized = True

    # ... [Previous methods remain unchanged] ...

    """
    Image Analysis Feature - Currently Disabled
    
    def analyze_food(self, image_data) -> Dict[str, Any]:
        '''
        Analyze food image for comprehensive health assessment
        Parameters:
            image_data: Binary image data
        Returns:
            Dict containing analysis results including category, confidence, and detailed analysis
        '''
        try:
            base64_image = base64.b64encode(image_data).decode('utf-8')
            
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "System prompt for food analysis..."  # Abbreviated for clarity
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1000
            )
            
            analysis_text = response.choices[0].message.content
            lines = analysis_text.split('\n')
            
            # Analysis parsing logic
            category = ""
            confidence = 0
            analysis = []
            current_section = ""

            for line in lines:
                if line.startswith('Category:'):
                    category = line.split(':', 1)[1].strip()
                elif line.startswith('Confidence:'):
                    confidence = float(line.split(':', 1)[1].strip().replace('%', ''))
                elif line.startswith('Analysis:'):
                    current_section = "analysis"
                elif current_section == "analysis":
                    analysis.append(line.strip())

            analysis_text = '\n'.join(analysis)
            
            return {
                "status": "success",
                "category": category,
                "confidence": confidence,
                "analysis": analysis_text,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
        except Exception as e:
            logger.error(f"Error in analyze_food: {str(e)}")
            return {
                "status": "error",
                "message": str(e),
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
    """

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

"""
Image Analysis Routes - Currently Disabled

@app.route('/api/analyze-food', methods=['POST'])
def analyze_food():
    '''Handle food image analysis requests'''
    try:
        if 'image' not in request.files:
            return jsonify({
                "status": "error",
                "message": "No image file provided"
            }), 400

        image_file = request.files['image']
        image_data = image_file.read()
        
        assistant = HealthAssistant()
        response = assistant.analyze_food(image_data)
        
        return jsonify(response)

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/calculator', methods=['POST'])
def analyze_image():
    '''Handle image analysis calculator requests'''
    try:
        data = request.json
        if not data or 'image' not in data:
            logger.error("No image data in request")
            return jsonify({
                'status': 'error',
                'message': 'No image data provided'
            }), 400

        image_data = base64.b64decode(data['image'].split(',')[1])
        health_assistant = HealthAssistant()
        result = health_assistant.analyze_food(image_data)
        
        logger.info(f"Image analysis completed: {result}")
        return jsonify(result)

    except Exception as e:
        logger.error(f"Error in analyze_image: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
"""

# ... [Remaining routes and code remain unchanged] ...

if __name__ == '__main__':
    print("Starting Flask server on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)