import requests
import json
from typing import Dict, Any, Optional, Generator, List, ClassVar
import os
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime
import openai
import io
import base64
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

# Food Analysis Labels
LABELS = ["Clearly Healthy", "Borderline", "Mixed", "Clearly Unhealthy"]

class UserProfileManager:
    def __init__(self, openai_client: OpenAI):
        self.client = openai_client
        self.system_instructions = {
            "personal_info": """ You are a specialized medical information assistant focused EXCLUSIVELY on GLP-1 medications (such as Ozempic, Wegovy, Mounjaro, etc.). You must:
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
You are a medical content validator specialized in GLP-1 medications.
Review and enhance the information about GLP-1 medications only.
Maintain a professional yet approachable tone, emphasizing both expertise and emotional support.
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
        """Initialize both GLP-1 and Food Analysis capabilities"""
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
        
        # Keep the system prompt
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
        
        # Food Analysis Configuration - Simplified to use only OpenAI
        self.openai_client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        if not os.getenv('OPENAI_API_KEY'):
            raise ValueError("OpenAI API key not provided")

        # Add conversation history management
        self.conversation_history = []
        self.max_history_length = 5
        
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
            
            logger.info(f"Sending request with messages: {messages}")  # Debug log
            
            payload = {
                "model": self.pplx_model,
                "messages": messages,
                "temperature": 0.1,
                "max_tokens": 1500
            }
            
            response = requests.post(
                "https://api.perplexity.ai/chat/completions",
                headers=self.pplx_headers,
                json=payload
            )
            
            logger.info(f"API Response status: {response.status_code}")  # Debug log
            
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
            
            logger.info(f"Generated response: {content[:100]}...")  # Debug log
            
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

    def analyze_food(self, image_data) -> Dict[str, Any]:
        """Analyze food image for comprehensive health assessment"""
        try:
            # Convert to base64
            base64_image = base64.b64encode(image_data).decode('utf-8')
            
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": """You are a nutritional analysis expert. Provide a comprehensive analysis of the food image:

1. Health Category: Classify as one of:
   - Clearly Healthy
   - Borderline
   - Mixed
   - Clearly Unhealthy

2. Confidence Score: Provide a confidence level (0-100%)

3. Detailed Analysis:
   Break down the following aspects:
   - Caloric Content: Analyze the caloric density and impact
   - Macronutrients: Evaluate proteins, fats, carbohydrates present
   - Processing Level: Assess how processed the foods are
   - Nutritional Profile: Identify key nutrients present or lacking
   - Health Implications: Discuss potential health effects
   - Portion Considerations: Comment on serving sizes if relevant

4. Summary: Conclude with overall health impact and recommendations

Format your response exactly as:
Category: [category]
Confidence: [number]%
Analysis:
[Provide detailed analysis]
[Include specific items from the image in your analysis]
[Importantly, is any of the above aspects not applicable to the image mean please leave it that aspects in response ]
[End with a summary statement]"""
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
            
            # Parse the response
            analysis_text = response.choices[0].message.content
            
            # Extract information using string parsing
            lines = analysis_text.split('\n')
            
            # Initialize variables
            category = ""
            confidence = 0
            analysis = []
            current_section = ""

            # Parse the response more comprehensively
            for line in lines:
                if line.startswith('Category:'):
                    category = line.split(':', 1)[1].strip()
                elif line.startswith('Confidence:'):
                    confidence = float(line.split(':', 1)[1].strip().replace('%', ''))
                elif line.startswith('Analysis:'):
                    current_section = "analysis"
                elif current_section == "analysis":
                    analysis.append(line.strip())

            # Join analysis lines with proper formatting
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

        assistant = HealthAssistant()  # Will return the singleton instance
        response = assistant.get_glp1_response(query)
        
        logger.info(f"Chat response: {response}")  # Debug log
        
        return jsonify(response)

    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/analyze-food', methods=['POST'])
def analyze_food():
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
    try:
        data = request.json
        if not data or 'image' not in data:
            logger.error("No image data in request")
            return jsonify({
                'status': 'error',
                'message': 'No image data provided'
            }), 400

        # Get base64 image data
        image_data = base64.b64decode(data['image'].split(',')[1])
        
        # Process image using HealthAssistant
        health_assistant = HealthAssistant()
        result = health_assistant.analyze_food(image_data)
        
        logger.info(f"Image analysis completed: {result}")
        
        return jsonify(result)  # Return the result directly

    except Exception as e:
        logger.error(f"Error in analyze_image: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Health check endpoint
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

        openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        profile_manager = UserProfileManager(openai_client)
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

        openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        profile_manager = UserProfileManager(openai_client)
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

# Add new route for chat history
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

if __name__ == '__main__':
    print("Starting Flask server on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
