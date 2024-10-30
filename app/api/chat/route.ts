import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    const response = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Internal server error'
    }, { status: 500 });
  }
} 