export async function getRecommendedContent(studentProfile, performanceData, subjects) {
  const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
  
  // Debug: Log the received learning profile data
  console.log('getRecommendedContent received learning profile:', {
    learningStyle: studentProfile?.learningStyle,
    studyPreference: studentProfile?.studyPreference,
    attentionSpan: studentProfile?.attentionSpan,
    preferredDifficulty: studentProfile?.preferredDifficulty,
    studyTimePreference: studentProfile?.studyTimePreference,
    interests: studentProfile?.interests,
    strengths: studentProfile?.strengths,
    weaknesses: studentProfile?.weaknesses,
    learningGoals: studentProfile?.learningGoals,
    subjects: studentProfile?.subjects
  });
  
  // Extract all learning preferences from profile
  const learningStyle = studentProfile?.learningStyle || 'active';
  const studyPreference = studentProfile?.studyPreference || 'visual';
  const attentionSpan = studentProfile?.attentionSpan || 25;
  const preferredDifficulty = studentProfile?.preferredDifficulty || 'medium';
  const studyTimePreference = studentProfile?.studyTimePreference || 'morning';
  const interests = studentProfile?.interests || [];
  const strengths = studentProfile?.strengths || [];
  const weaknesses = studentProfile?.weaknesses || [];
  const learningGoals = studentProfile?.learningGoals || [];
  const profileSubjects = studentProfile?.subjects || {};
  
  const prompt = `
    Student Profile: ${JSON.stringify(studentProfile)}
    Performance: ${JSON.stringify(performanceData)}
    Subjects: ${JSON.stringify(subjects)}
    
    Complete Learning Preferences Analysis:
    - Learning Style: ${learningStyle} (how they process information)
    - Study Preference: ${studyPreference} (how they prefer to study)
    - Attention Span: ${attentionSpan} minutes (optimal study session length)
    - Preferred Difficulty: ${preferredDifficulty} (content complexity preference)
    - Study Time Preference: ${studyTimePreference} (when they prefer to study)
    - Interests: ${interests.join(', ') || 'Not specified'}
    - Strengths: ${strengths.join(', ') || 'Not specified'}
    - Weaknesses: ${weaknesses.join(', ') || 'Not specified'}
    - Active Learning Goals: ${learningGoals.length} goals
    - Subject Performance: ${JSON.stringify(profileSubjects)}
    
    As an expert AI tutor, analyze the student's complete profile and performance to suggest highly personalized content recommendations. Consider ALL their learning preferences, goals, and performance patterns.
    
    Return a JSON object with:
    - "topicsToFocus": 3 specific topics or concepts the student should focus on next, considering their learning style, interests, and weaknesses
    - "resourceTypes": 2-3 types of resources that match their study preference and learning style
    - "difficultyLevel": suggested difficulty level based on their preference and performance
    - "timeAllocation": how much time to spend on each topic (in minutes), optimized for their ${attentionSpan}-minute attention span
    - "nextSteps": 2 specific next steps tailored to their learning style, study preferences, and active goals
    - "studySessionFormat": recommended study session structure based on their attention span, learning style, and study time preference
    - "goalIntegration": how to integrate their active learning goals with the recommended content
    - "motivationFactors": motivational elements based on their interests and strengths
    
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
      max_tokens: 600
    })
  });

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || '{}';
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
    
    const parsed = JSON.parse(content);
    return parsed;
  } catch (parseError) {
    console.error('JSON parsing error for content recommendations:', parseError);
    
    // Enhanced fallback recommendations based on complete learning preferences
    const fallbackResources = {
      visual: ["Video tutorials", "Infographics", "Mind maps", "Diagrams and charts"],
      auditory: ["Podcasts", "Audio lectures", "Group discussions", "Verbal explanations"],
      reading: ["Comprehensive articles", "Textbooks", "Study guides", "Written summaries"],
      kinesthetic: ["Interactive simulations", "Hands-on projects", "Practice exercises", "Physical models"],
      mixed: ["Multi-modal resources", "Combined approaches", "Varied materials", "Flexible learning methods"]
    };
    
    const timeBasedSuggestions = {
      early_morning: "Focus on complex topics when your mind is fresh",
      morning: "Tackle challenging subjects during peak energy hours",
      afternoon: "Use this time for practice and application exercises",
      evening: "Review and consolidate what you've learned",
      night: "Focus on reflection and planning for tomorrow",
      late_night: "Use this time for light review and preparation"
    };
    
    return { 
      error: "Could not parse content recommendations.", 
      raw: content,
      topicsToFocus: ["Review core concepts", "Practice problem-solving", "Apply theoretical knowledge"],
      resourceTypes: fallbackResources[studyPreference] || ["Video tutorials", "Practice exercises", "Interactive quizzes"],
      difficultyLevel: preferredDifficulty,
      timeAllocation: Math.min(attentionSpan, 30),
      nextSteps: ["Complete practice problems", "Review weak areas"],
      studySessionFormat: `Study in ${attentionSpan}-minute sessions with 5-minute breaks during ${typeof studyTimePreference === 'string' ? studyTimePreference : 'morning'}`,
      goalIntegration: learningGoals.length > 0 ? 
        `Align your study sessions with your ${learningGoals.length} active goals` : 
        "Set specific learning goals to enhance your progress",
      motivationFactors: interests.length > 0 ? 
        `Connect your studies to your interests: ${interests.join(', ')}` : 
        "Focus on building your strengths and improving weak areas"
    };
  }
}

export async function getEnhancedDeepSeekRecommendations(studentProfile, performanceData, goals, recentActivity) {
  const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
  
  // Debug: Log the received learning profile data
  console.log('getEnhancedDeepSeekRecommendations received learning profile:', {
    learningStyle: studentProfile?.learningStyle,
    studyPreference: studentProfile?.studyPreference,
    attentionSpan: studentProfile?.attentionSpan,
    preferredDifficulty: studentProfile?.preferredDifficulty,
    studyTimePreference: studentProfile?.studyTimePreference,
    interests: studentProfile?.interests,
    strengths: studentProfile?.strengths,
    weaknesses: studentProfile?.weaknesses,
    learningGoals: studentProfile?.learningGoals,
    subjects: studentProfile?.subjects
  });
  
  // Extract all learning preferences from profile
  const learningStyle = studentProfile?.learningStyle || 'active';
  const studyPreference = studentProfile?.studyPreference || 'visual';
  const attentionSpan = studentProfile?.attentionSpan || 25;
  const preferredDifficulty = studentProfile?.preferredDifficulty || 'medium';
  const studyTimePreference = studentProfile?.studyTimePreference || 'morning';
  const interests = studentProfile?.interests || [];
  const strengths = studentProfile?.strengths || [];
  const weaknesses = studentProfile?.weaknesses || [];
  const learningGoals = studentProfile?.learningGoals || [];
  const profileSubjects = studentProfile?.subjects || {};
  
  const prompt = `
    Student Profile: ${JSON.stringify(studentProfile)}
    Performance: ${JSON.stringify(performanceData)}
    Goals: ${JSON.stringify(goals)}
    Recent Activity: ${JSON.stringify(recentActivity)}
    
    Complete Learning Preferences Analysis:
    - Learning Style: ${learningStyle} (how they process and understand information)
    - Study Preference: ${studyPreference} (how they prefer to absorb information)
    - Attention Span: ${attentionSpan} minutes (optimal focus duration)
    - Preferred Difficulty: ${preferredDifficulty} (content complexity preference)
    - Study Time Preference: ${studyTimePreference} (when they prefer to study)
    - Interests: ${interests.join(', ') || 'Not specified'}
    - Strengths: ${strengths.join(', ') || 'Not specified'}
    - Weaknesses: ${weaknesses.join(', ') || 'Not specified'}
    - Active Learning Goals: ${learningGoals.length} goals
    - Subject Performance: ${JSON.stringify(profileSubjects)}
    
    As an expert AI tutor, analyze the above complete data and provide highly personalized recommendations that align with ALL the student's learning preferences. Consider their learning style, study preferences, attention span, goals, interests, and performance patterns when crafting advice.
    
    Return a JSON object with the following keys:
    - "studyTips": 3 actionable, personalized study tips that match their learning style, study preferences, and attention span
    - "feedback": 2-3 sentences of feedback on recent performance, considering their learning preferences and goals
    - "learningStrategies": 2 strategies to improve weak areas, tailored to their learning style and interests
    - "motivation": 1 motivational message that resonates with their interests, strengths, and goals
    - "goalSuggestions": 1 suggestion for each active goal (if any), considering their learning preferences and study time preference
    - "studySchedule": recommended study schedule based on their attention span, learning style, and study time preference
    - "resourceRecommendations": specific types of resources that match their study preferences and learning style
    - "timeOptimization": how to optimize their study sessions based on their preferred study time
    - "strengthLeverage": how to use their strengths to improve weak areas
    - "interestIntegration": how to connect their interests with their learning goals
    
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
      max_tokens: 800
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
    
    // Enhanced fallback recommendations based on complete learning preferences
    const studyTipsByStyle = {
      active: [
        "Engage in group discussions and debates",
        "Practice teaching concepts to others",
        "Use hands-on activities and experiments"
      ],
      reflective: [
        "Take time to think through problems before solving",
        "Keep a learning journal to reflect on concepts",
        "Review and analyze your study sessions"
      ],
      sequential: [
        "Follow step-by-step learning approaches",
        "Create detailed outlines and study plans",
        "Build knowledge systematically from basics to advanced"
      ],
      global: [
        "Start with the big picture before diving into details",
        "Use mind maps to see connections between topics",
        "Look for patterns and relationships across subjects"
      ],
      sensing: [
        "Focus on concrete examples and real-world applications",
        "Use practical exercises and hands-on practice",
        "Connect theory to actual problems and situations"
      ],
      intuitive: [
        "Explore theoretical concepts and abstract thinking",
        "Look for underlying principles and patterns",
        "Experiment with different approaches to problems"
      ]
    };
    
    const resourceRecommendations = {
      visual: ["Video tutorials", "Infographics", "Diagrams and charts", "Mind maps"],
      auditory: ["Podcasts", "Audio lectures", "Group discussions", "Verbal explanations"],
      reading: ["Comprehensive articles", "Textbooks", "Study guides", "Written summaries"],
      kinesthetic: ["Interactive simulations", "Hands-on projects", "Physical models", "Practice exercises"],
      mixed: ["Multi-modal resources", "Combined approaches", "Varied materials", "Flexible learning methods"]
    };
    
    const timeBasedSuggestions = {
      early_morning: "Focus on complex topics when your mind is fresh",
      morning: "Tackle challenging subjects during peak energy hours",
      afternoon: "Use this time for practice and application exercises",
      evening: "Review and consolidate what you've learned",
      night: "Focus on reflection and planning for tomorrow",
      late_night: "Use this time for light review and preparation"
    };
    
    // Enhanced fallback: return a structured error object with personalized content
    return { 
      error: "Could not parse AI response.", 
      raw: content,
      studyTips: studyTipsByStyle[learningStyle] || ["Focus on your learning style preferences", "Take regular breaks during study sessions", "Review material consistently"],
      feedback: `Based on your ${learningStyle} learning style and ${studyPreference} study preferences, continue working on your academic goals and maintain consistency in your studies.`,
      learningStrategies: ["Use active learning techniques", "Practice regularly with different materials"],
      motivation: interests.length > 0 ? 
        `Keep up the great work! Connect your studies to your interests: ${interests.join(', ')}` : 
        "Keep up the great work! Every effort brings you closer to your goals.",
      goalSuggestions: learningGoals.length > 0 ? 
        learningGoals.reduce((suggestions, goal) => {
          const timePref = typeof studyTimePreference === 'string' ? studyTimePreference : 'morning';
          suggestions[goal.title || 'Learning Goal'] = `Focus on this goal during your preferred study time (${timePref})`;
          return suggestions;
        }, {}) : 
        { "Set Learning Goals": "Create specific, measurable goals to enhance your progress" },
      studySchedule: `Study in ${attentionSpan}-minute focused sessions with 5-minute breaks during ${typeof studyTimePreference === 'string' ? studyTimePreference : 'morning'}, using ${studyPreference} learning methods.`,
      resourceRecommendations: resourceRecommendations[studyPreference] || ["Video tutorials", "Practice exercises", "Interactive quizzes"],
      timeOptimization: typeof studyTimePreference === 'string' && typeof timeBasedSuggestions[studyTimePreference] === 'string' ? 
        timeBasedSuggestions[studyTimePreference] : 
        "Optimize your study sessions based on your energy levels",
      strengthLeverage: strengths.length > 0 ? 
        `Use your strengths in ${strengths.join(', ')} to build confidence in challenging areas` : 
        "Identify and build on your natural strengths",
      interestIntegration: interests.length > 0 ? 
        `Connect your studies to your interests: ${interests.join(', ')}` : 
        "Explore ways to make your studies more engaging"
    };
  }
}

async function callDeepSeek(prompt) {
  const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
  
  if (!apiKey) {
    throw new Error('DeepSeek API key not found');
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      return null;
    }
  } catch (error) {
    console.error('Error calling DeepSeek API:', error);
    throw error;
  }
} 