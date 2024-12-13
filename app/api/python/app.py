import requests
import json
from typing import Dict, Any, Optional, Generator
import os
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime
import re
import logging
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import torch
import openai
import io
import base64

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app,
     resources={
         r"/api/*": {
             "origins": ["http://localhost:3000", "https://glp-1-lovat.vercel.app", "https://glp-1-xplo.vercel.app"],
             "methods": ["POST", "GET", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization"],
             "expose_headers": ["Content-Type"],
             "max_age": 86400,
             "supports_credentials": True
         }
     })

load_dotenv()

# Food Analysis Labels
LABELS = ["Clearly Healthy", "Borderline", "Mixed", "Clearly Unhealthy"]

class HealthAssistant:
    def __init__(self, api_key: str = None):
        """Initialize both GLP-1 and Food Analysis capabilities"""
        # GLP-1 Configuration
        self.pplx_api_key = api_key or os.getenv('PPLX_API_KEY')
        if not self.pplx_api_key:
            raise ValueError("PPLX API key not provided")
            
        self.pplx_model = "llama-3.1-sonar-large-128k-online"
        self.pplx_headers = {
            "Authorization": f"Bearer {self.pplx_api_key}",
            "Content-Type": "application/json"
        }
        
        # Food Analysis Configuration
        self.clip_model = None
        self.clip_processor = None
        self.openai_client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        # Load CLIP models
        self.load_models()
        
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

4. Always provide source citations which is related to the generated response. Importantly only provide sources for about GLP-1 medications
5. Provide response in a simple manner that is easy to understand at preferably a 11th grade literacy level with reduced pharmaceutical or medical jargon
6. Always Return sources in a hyperlink format
"""

    def load_models(self):
        """Load CLIP models for food analysis"""
        try:
            logger.info("Loading CLIP models...")
            os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
            self.clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            self.clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            logger.info("CLIP models loaded successfully")
        except Exception as e:
            logger.error(f"Error loading CLIP models: {str(e)}")
            raise

    def get_response(self, query: str) -> Dict[str, Any]:
        """Get response for GLP-1 related queries"""
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
                "status": "success",
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

    def analyze_food(self, image_data) -> Dict[str, Any]:
        """Analyze food image for health assessment"""
        try:
            # Convert base64 to PIL Image
            image = Image.open(io.BytesIO(image_data)).convert("RGB")
            
            # Resize image if needed
            max_size = 768
            ratio = min(max_size/image.width, max_size/image.height)
            new_size = (int(image.width * ratio), int(image.height * ratio))
            resized_image = image.resize(new_size, Image.Resampling.LANCZOS)
            
            # CLIP processing
            inputs = self.clip_processor(
                text=LABELS, images=resized_image, return_tensors="pt", padding=True
            )
            
            outputs = self.clip_model(**inputs)
            logits_per_image = outputs.logits_per_image
            probs = logits_per_image.softmax(dim=1)
            predicted_idx = probs.argmax(dim=1).item()
            predicted_label = LABELS[predicted_idx]
            confidence_score = probs[0][predicted_idx].item() * 100
            
            # Prepare image for GPT
            buffered = io.BytesIO()
            resized_image.save(buffered, format="JPEG", quality=80)
            base64_image = base64.b64encode(buffered.getvalue()).decode("utf-8")
            
            # GPT Analysis
            gpt_response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "Analyze the food image based on health criteria. Be concise."
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Category: {predicted_label}\nConfidence: {confidence_score:.2f}%"
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=300
            )
            
            gpt_analysis = gpt_response.choices[0].message.content
            
            return {
                "status": "success",
                "category": predicted_label,
                "confidence": confidence_score,
                "analysis": gpt_analysis,
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

        assistant = HealthAssistant()
        response = assistant.get_response(query)
        
        return jsonify(response)

    except Exception as e:
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
        assistant = HealthAssistant()
        result = assistant.analyze_food(image_data)
        
        logger.info(f"Image analysis completed: {result}")
        
        return jsonify(result)

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

def main():
    """Main function to run the Health Assistant"""
    try:
        assistant = HealthAssistant()
        
        while True:
            query = input("Enter your question (or 'quit' to exit): ").strip()
            
            if query.lower() == 'quit':
                response_data = {
                    "status": "exit",
                    "message": "Thank you for using the Health Assistant. Goodbye!",
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                print(json.dumps(response_data, indent=2))
                break
            
            if query:
                response = assistant.get_response(query)
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
    print("Starting Flask server on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
