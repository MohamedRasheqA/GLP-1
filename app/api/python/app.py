from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from openai import OpenAI
import requests
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from datetime import datetime

app = Flask(__name__)

# Initialize CORS before any routes
CORS(app, resources={
    r"/*": {
        "origins": ["https://glp-1.vercel.app"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 600
    }
})

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'https://glp-1.vercel.app')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('Access-Control-Max-Age', '600')
    return response

@app.route('/api/chat', methods=['OPTIONS'])
def handle_options():
    response = jsonify({})
    return response, 204
