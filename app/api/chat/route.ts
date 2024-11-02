import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({
        status: 'error',
        message: 'No query provided'
      }, { status: 400 });
    }

    console.log('Sending request to LLM API:', query);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 590000); // 590 second timeout

    const response = await fetch('https://glp-1-xplo.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM API Error:', errorText);
      throw new Error(`LLM API responded with status: ${response.status}. Details: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('API Error:', error);
  }
} 
