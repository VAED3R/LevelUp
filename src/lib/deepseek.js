export async function getRecommendedContent(studentProfile, performanceData, subjects) {
  const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
  console.log('DeepSeek API Key available:', !!apiKey);
  console.log('Student Profile for content:', studentProfile);
  console.log('Performance Data for content:', performanceData);
  console.log('Subjects for content:', subjects);
  
  const prompt = `
    Student Profile: ${JSON.stringify(studentProfile)}
    Performance: ${JSON.stringify(performanceData)}
    Subjects: ${JSON.stringify(subjects)}
    
    As an expert AI tutor, analyze the student's performance and suggest specific content recommendations. Return a JSON object with:
    - "topicsToFocus": 3 specific topics or concepts the student should focus on next
    - "resourceTypes": 2-3 types of resources (e.g., "video tutorials", "practice problems", "interactive simulations")
    - "difficultyLevel": suggested difficulty level for next study materials
    - "timeAllocation": how much time to spend on each topic (in minutes)
    - "nextSteps": 2 specific next steps for improvement
    
    Respond ONLY with a valid JSON object.
  `;

  console.log('Sending prompt to DeepSeek:', prompt);

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400
    })
  });

  console.log('DeepSeek response status:', response.status);
  const data = await response.json();
  console.log('DeepSeek response data:', data);
  let content = data.choices?.[0]?.message?.content || '{}';
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
    
    const parsed = JSON.parse(content);
    console.log('Parsed content recommendations:', parsed);
    return parsed;
  } catch (parseError) {
    console.error('JSON parsing error for content recommendations:', parseError);
    console.log('Raw content:', content);
    
    return { 
      error: "Could not parse content recommendations.", 
      raw: content,
      topicsToFocus: ["Review core concepts", "Practice problem-solving", "Apply theoretical knowledge"],
      resourceTypes: ["Video tutorials", "Practice exercises", "Interactive quizzes"],
      difficultyLevel: "medium",
      timeAllocation: 30,
      nextSteps: ["Complete practice problems", "Review weak areas"]
    };
  }
}

export async function getEnhancedDeepSeekRecommendations(studentProfile, performanceData, goals, recentActivity) {
  const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
  const prompt = `
    Student Profile: ${JSON.stringify(studentProfile)}
    Performance: ${JSON.stringify(performanceData)}
    Goals: ${JSON.stringify(goals)}
    Recent Activity: ${JSON.stringify(recentActivity)}
    As an expert AI tutor, analyze the above data and return a JSON object with the following keys:
    - "studyTips": 3 actionable, personalized study tips.
    - "feedback": 2-3 sentences of feedback on recent performance.
    - "learningStrategies": 2 strategies to improve weak areas.
    - "motivation": 1 motivational message.
    - "goalSuggestions": 1 suggestion for each active goal (if any).
    Respond ONLY with a valid JSON object.
  `;

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    })
  });

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || '{}';
  
  // Clean up the content to extract JSON
  try {
    // Try to find JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
    
    const parsed = JSON.parse(content);
    return parsed;
  } catch (parseError) {
    console.error('JSON parsing error:', parseError);
    console.log('Raw content:', content);
    
    // fallback: return a structured error object
    return { 
      error: "Could not parse AI response.", 
      raw: content,
      studyTips: ["Focus on your learning style preferences", "Take regular breaks during study sessions", "Review material consistently"],
      feedback: "Continue working on your academic goals and maintain consistency in your studies.",
      learningStrategies: ["Use active learning techniques", "Practice regularly with different materials"],
      motivation: "Keep up the great work! Every effort brings you closer to your goals.",
      goalSuggestions: {}
    };
  }
} 