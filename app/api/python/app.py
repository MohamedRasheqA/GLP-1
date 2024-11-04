import requests
import json
import os
from typing import Dict, Any, Optional, Generator
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class GLP1Bot:
    def __init__(self, model: str = "llama-3.1-sonar-large-128k-online"):
        """Initialize the GLP1Bot with PPLX client and system prompts"""
        self.pplx_api_key = os.getenv('PPLX_API_KEY')
        if not self.pplx_api_key:
            raise ValueError("PPLX_API_KEY not found in environment variables")
            
        self.pplx_model = model
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
Remember: You must NEVER provide information about topics outside of GLP-1 medications and their direct effects.
Each response must include relevant medical disclaimers and encourage consultation with healthcare providers.
You are a medical content validator specialized in GLP-1 medications.
Review and enhance the information about GLP-1 medications only.
Maintain a professional yet approachable tone, emphasizing both expertise and emotional support.
"""
    def stream_response(self, query: str) -> Generator[Dict[str, Any], None, None]:
        """Stream response from PPLX API with sources"""
        try:
            payload = {
                "model": self.pplx_model,
                "messages": [
                    {"role": "system", "content": self.pplx_system_prompt},
                    {"role": "user", "content": f"{query}\n\nPlease include sources for the information provided."}
                ],
                "temperature": 0.1,
                "max_tokens": 4096,
                "stream": True
            }
            response = requests.post(
                "https://api.perplexity.ai/chat/completions",
                headers=self.pplx_headers,
                json=payload,
                stream=True
            )
            response.raise_for_status()
            accumulated_content = ""
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        try:
                            json_str = line[6:]
                            if json_str.strip() == '[DONE]':
                                break
                            chunk = json.loads(json_str)
                            if chunk['choices'][0]['finish_reason'] is not None:
                                break
                            content = chunk['choices'][0]['delta'].get('content', '')
                            if content:
                                accumulated_content += content
                                yield {
                                    "type": "content",
                                    "data": content,
                                    "accumulated": accumulated_content
                                }
                        except json.JSONDecodeError:
                            continue
            content_parts = accumulated_content.split("\nSources:", 1)
            main_content = content_parts[0].strip()
            sources = content_parts[1].strip() if len(content_parts) > 1 else "no sources provided"
            yield {
                "type": "complete",
                "content": main_content,
                "sources": sources
            }
        except Exception as e:
            yield {
                "type": "error",
                "message": f"Error communicating with PPLX: {str(e)}"
            }
    def process_query(self, user_query: str) -> Dict[str, Any]:
        """Process user query and return response"""
        try:
            if not user_query.strip():
                return {
                    "status": "error",
                    "message": "Please enter a valid question."
                }
            query_category = self.categorize_query(user_query)
            full_response = ""
            sources = ""
            for chunk in self.stream_response(user_query):
                if chunk["type"] == "error":
                    return {"status": "error", "message": chunk["message"]}
                elif chunk["type"] == "content":
                    full_response = chunk["accumulated"]
                elif chunk["type"] == "complete":
                    full_response = chunk["content"]
                    sources = chunk["sources"]
            disclaimer = "Always consult your healthcare provider before making any changes to your medication or treatment plan."
            return {
                "query_category": query_category,
                "original_query": user_query,
                "response": full_response,
                "disclaimer": disclaimer,
                "sources": sources
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error processing query: {str(e)}"
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
    """Main function to handle user input and display JSON response"""
    try:
        bot = GLP1Bot()
        while True:
            print("\nEnter your query about GLP-1 medications (or 'exit' to quit):")
            query = input("> ").strip()
            if query.lower() == 'exit':
                break
            response = bot.process_query(query)
            # Print formatted JSON response
            print(json.dumps(response, indent=2, ensure_ascii=False))
    except KeyboardInterrupt:
        print("\nExiting program...")
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, indent=2))
if __name__ == "__main__":
    main()

