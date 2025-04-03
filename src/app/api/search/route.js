import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
        return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    try {
        console.log('Making request to SearXNG with query:', query);
        const response = await fetch(`http://localhost:8080/search?q=${encodeURIComponent(query)}&format=json`);
        
        if (!response.ok) {
            console.error('SearXNG response not OK:', {
                status: response.status,
                statusText: response.statusText
            });
            return NextResponse.json({ 
                error: 'SearXNG request failed',
                status: response.status,
                statusText: response.statusText
            }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Proxy error details:', {
            message: error.message,
            stack: error.stack,
            cause: error.cause
        });
        return NextResponse.json({ 
            error: 'Failed to fetch search results',
            details: error.message
        }, { status: 500 });
    }
} 