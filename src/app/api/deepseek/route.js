export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('DeepSeek API Route - JSON parse error:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        details: parseError.message 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { model = 'deepseek-reasoner', messages } = body;
    
    if (!messages || !Array.isArray(messages)) {
      console.error('DeepSeek API Route - Invalid messages format');
      return new Response(JSON.stringify({ 
        error: 'Invalid messages format. Expected array of message objects.',
        details: 'Messages must be an array'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
    
    console.log('DeepSeek API Route - API Key available:', !!apiKey);
    console.log('DeepSeek API Route - Model:', model);
    console.log('DeepSeek API Route - Messages count:', messages?.length);
    
    if (!apiKey) {
      console.error('DeepSeek API Route - API key not configured');
      return new Response(JSON.stringify({ 
        error: 'DeepSeek API key not configured. Please set NEXT_PUBLIC_DEEPSEEK_API_KEY environment variable.',
        details: 'Missing environment variable'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('DeepSeek API Route - Making request to DeepSeek API...');
    console.log('DeepSeek API Route - Request body size:', JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 2000,
      temperature: 0.7
    }).length, 'characters');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout
    
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_tokens: 3000,
          temperature: 0.7,
          stream: false
        }),
        signal: controller.signal
      });
      
            clearTimeout(timeoutId);
      console.log('DeepSeek API Route - Response status:', response.status);
      console.log('DeepSeek API Route - Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.text();
        console.error('DeepSeek API error:', errorData);
        return new Response(JSON.stringify({ 
          error: 'Failed to generate response from DeepSeek API',
          details: errorData 
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return new Response(JSON.stringify({ error: 'No content received from DeepSeek API' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log('DeepSeek API Route - Successfully generated content, length:', content.length);
      console.log('DeepSeek API Route - Content preview:', content.substring(0, 200) + '...');
      console.log('DeepSeek API Route - Usage:', data.usage);

      return new Response(JSON.stringify({ 
        response: content,
        model: model,
        usage: data.usage
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('DeepSeek API Route - Fetch error:', fetchError);
      
      if (fetchError.name === 'AbortError') {
        return new Response(JSON.stringify({ 
          error: 'Request timeout - DeepSeek API took too long to respond',
          details: 'Request timed out after 1 minute'
        }), {
          status: 408,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ 
        error: 'Failed to connect to DeepSeek API',
        details: fetchError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('DeepSeek API route error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 