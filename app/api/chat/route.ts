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
    
    const response = await fetch('https://glp-1-llm.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    console.log('LLM API Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM API Error:', errorText);
      throw new Error(`LLM API responded with status: ${response.status}. Details: ${errorText}`);
    }

    const data = await response.json();
    console.log('LLM API Response Data:', data);
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
} 