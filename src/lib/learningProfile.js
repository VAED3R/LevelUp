import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

export class LearningProfile {
  constructor(studentId) {
    this.studentId = studentId;
    this.profileRef = doc(db, 'learningProfiles', studentId);
  }

  // Initialize or get learning profile
  async getProfile() {
    try {
      const profileDoc = await getDoc(this.profileRef);
      if (profileDoc.exists()) {
        return profileDoc.data();
      } else {
        // Create default profile
        const defaultProfile = {
          learningStyle: 'visual', // visual, auditory, kinesthetic, reading
          preferredDifficulty: 'medium',
          studyTimePreference: 'evening', // morning, afternoon, evening, night
          attentionSpan: 25, // minutes
          subjects: {},
          learningGoals: [],
          strengths: [],
          weaknesses: [],
          interests: [],
          lastUpdated: new Date().toISOString()
        };
        await setDoc(this.profileRef, defaultProfile);
        return defaultProfile;
      }
    } catch (error) {
      console.error('Error getting learning profile:', error);
      throw error;
    }
  }

  // Update learning profile
  async updateProfile(updates) {
    try {
      await updateDoc(this.profileRef, {
        ...updates,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating learning profile:', error);
      throw error;
    }
  }

  // Analyze learning patterns from quiz results
  async analyzeLearningPatterns() {
    try {
      // Get quiz results
      const quizzesRef = collection(db, 'quizResults');
      const q = query(quizzesRef, where('studentId', '==', this.studentId));
      const querySnapshot = await getDocs(q);
      
      const patterns = {
        subjectPerformance: {},
        timeOfDay: {},
        questionTypes: {},
        difficultyProgression: {},
        studySessions: []
      };

      querySnapshot.forEach((doc) => {
        const result = doc.data();
        
        // Subject performance
        if (!patterns.subjectPerformance[result.subject]) {
          patterns.subjectPerformance[result.subject] = {
            totalQuizzes: 0,
            averageScore: 0,
            totalScore: 0,
            improvement: 0
          };
        }
        patterns.subjectPerformance[result.subject].totalQuizzes++;
        patterns.subjectPerformance[result.subject].totalScore += result.score;
        patterns.subjectPerformance[result.subject].averageScore = 
          patterns.subjectPerformance[result.subject].totalScore / 
          patterns.subjectPerformance[result.subject].totalQuizzes;

        // Time of day analysis
        const hour = new Date(result.completedAt).getHours();
        const timeSlot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
        patterns.timeOfDay[timeSlot] = (patterns.timeOfDay[timeSlot] || 0) + 1;

        // Question type analysis
        if (result.questionAnalysis) {
          result.questionAnalysis.forEach(q => {
            const type = q.type || 'multiple_choice';
            if (!patterns.questionTypes[type]) {
              patterns.questionTypes[type] = { correct: 0, total: 0 };
            }
            patterns.questionTypes[type].total++;
            if (q.correct) patterns.questionTypes[type].correct++;
          });
        }
      });

      return patterns;
    } catch (error) {
      console.error('Error analyzing learning patterns:', error);
      throw error;
    }
  }

  // Generate personalized recommendations
  async generateRecommendations() {
    try {
      const profile = await this.getProfile();
      const patterns = await this.analyzeLearningPatterns();
      
      const recommendations = {
        studySchedule: this.generateStudySchedule(profile, patterns),
        contentRecommendations: await this.getContentRecommendations(profile, patterns),
        difficultyAdjustments: this.getDifficultyAdjustments(patterns),
        learningStrategies: this.getLearningStrategies(profile),
        focusAreas: this.getFocusAreas(patterns)
      };

      return recommendations;
    } catch (error) {
      console.error('Error generating recommendations:', error);
      throw error;
    }
  }

  // Generate optimal study schedule
  generateStudySchedule(profile, patterns) {
    const schedule = {
      recommendedTime: profile.studyTimePreference,
      sessionDuration: profile.attentionSpan,
      breaks: Math.ceil(profile.attentionSpan / 25) * 5, // 5 min break every 25 min
      subjects: []
    };

    // Prioritize subjects based on performance
    const subjectPriorities = Object.entries(patterns.subjectPerformance)
      .sort((a, b) => a[1].averageScore - b[1].averageScore) // Focus on weaker subjects
      .map(([subject, data]) => ({
        subject,
        priority: data.averageScore < 70 ? 'high' : data.averageScore < 85 ? 'medium' : 'low',
        recommendedTime: data.averageScore < 70 ? 45 : data.averageScore < 85 ? 30 : 20
      }));

    schedule.subjects = subjectPriorities;
    return schedule;
  }

  // Get personalized content recommendations
  async getContentRecommendations(profile, patterns) {
    try {
      // Get available content from Cloudinary or other sources
      const contentRef = collection(db, 'educationalContent');
      
      // Check if we have subjects to query for
      const subjects = Object.keys(patterns.subjectPerformance);
      if (subjects.length === 0) {
        // If no subjects, return default recommendations
        return this.getDefaultRecommendations(profile);
      }
      
      const q = query(contentRef, where('subjects', 'array-contains-any', subjects));
      const querySnapshot = await getDocs(q);
      
      const recommendations = [];
      querySnapshot.forEach((doc) => {
        const content = doc.data();
        const relevanceScore = this.calculateContentRelevance(content, profile, patterns);
        
        if (relevanceScore > 0.6) { // Only recommend highly relevant content
          recommendations.push({
            ...content,
            relevanceScore,
            reason: this.getRecommendationReason(content, profile, patterns)
          });
        }
      });

      // If no recommendations found, return default ones
      if (recommendations.length === 0) {
        return this.getDefaultRecommendations(profile);
      }

      return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.error('Error getting content recommendations:', error);
      return this.getDefaultRecommendations(profile);
    }
  }

  // Get default recommendations when no specific content is available
  getDefaultRecommendations(profile) {
    const defaultRecommendations = [
      {
        id: 'default-1',
        title: 'Study Skills Workshop',
        description: 'Learn effective study techniques tailored to your learning style',
        subject: 'Study Skills',
        difficulty: profile.preferredDifficulty,
        learningStyle: profile.learningStyle,
        duration: '30 minutes',
        relevanceScore: 0.8,
        reason: 'Based on your learning style preferences'
      },
      {
        id: 'default-2',
        title: 'Time Management Tips',
        description: 'Improve your study schedule and productivity',
        subject: 'Productivity',
        difficulty: 'medium',
        learningStyle: 'visual',
        duration: '20 minutes',
        relevanceScore: 0.7,
        reason: 'Helps optimize your study time preferences'
      },
      {
        id: 'default-3',
        title: 'Note-Taking Strategies',
        description: 'Master note-taking methods for better retention',
        subject: 'Study Skills',
        difficulty: 'easy',
        learningStyle: profile.learningStyle,
        duration: '25 minutes',
        relevanceScore: 0.6,
        reason: 'Enhances your learning effectiveness'
      }
    ];

    return defaultRecommendations;
  }

  // Calculate content relevance score
  calculateContentRelevance(content, profile, patterns) {
    let score = 0;
    
    // Subject relevance
    if (patterns.subjectPerformance[content.subject]) {
      const performance = patterns.subjectPerformance[content.subject].averageScore;
      if (performance < 70) score += 0.4; // High priority for weak subjects
      else if (performance < 85) score += 0.2; // Medium priority
    }

    // Learning style match
    if (content.learningStyle === profile.learningStyle) score += 0.3;
    
    // Difficulty match
    if (content.difficulty === profile.preferredDifficulty) score += 0.2;
    
    // Interest match
    if (profile.interests.some(interest => 
      content.tags?.includes(interest))) score += 0.1;

    return Math.min(score, 1);
  }

  // Get recommendation reason
  getRecommendationReason(content, profile, patterns) {
    const reasons = [];
    
    if (patterns.subjectPerformance[content.subject]?.averageScore < 70) {
      reasons.push('Focus on improving this subject');
    }
    
    if (content.learningStyle === profile.learningStyle) {
      reasons.push('Matches your learning style');
    }
    
    if (content.difficulty === profile.preferredDifficulty) {
      reasons.push('Appropriate difficulty level');
    }

    return reasons.join(', ');
  }

  // Get difficulty adjustments
  getDifficultyAdjustments(patterns) {
    const adjustments = {};
    
    Object.entries(patterns.subjectPerformance).forEach(([subject, data]) => {
      if (data.averageScore > 90) {
        adjustments[subject] = 'increase';
      } else if (data.averageScore < 60) {
        adjustments[subject] = 'decrease';
      } else {
        adjustments[subject] = 'maintain';
      }
    });

    return adjustments;
  }

  // Get learning strategies
  getLearningStrategies(profile) {
    const strategies = {
      visual: [
        'Use mind maps and diagrams',
        'Watch educational videos',
        'Create flashcards with images',
        'Use color coding for notes'
      ],
      auditory: [
        'Listen to educational podcasts',
        'Read aloud when studying',
        'Participate in group discussions',
        'Use verbal mnemonics'
      ],
      kinesthetic: [
        'Use hands-on activities',
        'Take frequent breaks to move',
        'Use physical objects for learning',
        'Practice with real-world examples'
      ],
      reading: [
        'Read extensively on topics',
        'Take detailed notes',
        'Write summaries',
        'Use text-based resources'
      ]
    };

    return strategies[profile.learningStyle] || strategies.visual;
  }

  // Get focus areas for improvement
  getFocusAreas(patterns) {
    return Object.entries(patterns.subjectPerformance)
      .filter(([subject, data]) => data.averageScore < 75)
      .sort((a, b) => a[1].averageScore - b[1].averageScore)
      .slice(0, 3)
      .map(([subject, data]) => ({
        subject,
        currentScore: data.averageScore,
        targetScore: 85,
        improvementNeeded: 85 - data.averageScore
      }));
  }
} 