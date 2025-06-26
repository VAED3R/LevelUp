import { db } from './firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

export class AdaptiveQuiz {
  constructor(studentId, subject) {
    this.studentId = studentId;
    this.subject = subject;
    this.currentDifficulty = 'medium';
    this.performanceHistory = [];
    this.questionBank = [];
  }

  // Initialize adaptive quiz with student's learning profile
  async initializeQuiz() {
    try {
      // Get student's learning profile
      const profileRef = doc(db, 'learningProfiles', this.studentId);
      const profileDoc = await getDoc(profileRef);
      const profile = profileDoc.exists() ? profileDoc.data() : null;

      // Get performance history
      await this.loadPerformanceHistory();

      // Set initial difficulty based on historical performance
      this.currentDifficulty = this.calculateInitialDifficulty();

      // Load question bank
      await this.loadQuestionBank();

      return {
        currentDifficulty: this.currentDifficulty,
        totalQuestions: this.questionBank.length,
        estimatedTime: this.calculateEstimatedTime(),
        learningStyle: profile?.learningStyle || 'visual'
      };
    } catch (error) {
      console.error('Error initializing adaptive quiz:', error);
      throw error;
    }
  }

  // Load student's performance history
  async loadPerformanceHistory() {
    try {
      const resultsRef = collection(db, 'quizResults');
      const q = query(
        resultsRef, 
        where('studentId', '==', this.studentId),
        where('subject', '==', this.subject)
      );
      const querySnapshot = await getDocs(q);
      
      this.performanceHistory = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    } catch (error) {
      console.error('Error loading performance history:', error);
      this.performanceHistory = [];
    }
  }

  // Calculate initial difficulty based on historical performance
  calculateInitialDifficulty() {
    if (this.performanceHistory.length === 0) {
      return 'medium';
    }

    // Get recent performance (last 5 quizzes)
    const recentQuizzes = this.performanceHistory.slice(0, 5);
    const averageScore = recentQuizzes.reduce((sum, quiz) => sum + quiz.score, 0) / recentQuizzes.length;

    if (averageScore >= 85) return 'hard';
    if (averageScore >= 70) return 'medium';
    return 'easy';
  }

  // Load question bank from database
  async loadQuestionBank() {
    try {
      const questionsRef = collection(db, 'questions');
      const q = query(
        questionsRef,
        where('subject', '==', this.subject),
        where('difficulty', 'in', ['easy', 'medium', 'hard'])
      );
      const querySnapshot = await getDocs(q);
      
      this.questionBank = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    } catch (error) {
      console.error('Error loading question bank:', error);
      this.questionBank = [];
    }
  }

  // Get next question based on current performance
  getNextQuestion(currentScore, questionsAnswered) {
    // Adjust difficulty based on current performance
    this.adjustDifficulty(currentScore, questionsAnswered);

    // Filter questions by current difficulty
    const availableQuestions = this.questionBank.filter(q => 
      q.difficulty === this.currentDifficulty
    );

    if (availableQuestions.length === 0) {
      // Fallback to any difficulty if no questions available
      return this.questionBank[Math.floor(Math.random() * this.questionBank.length)];
    }

    // Select question based on learning style and performance
    return this.selectOptimalQuestion(availableQuestions, currentScore, questionsAnswered);
  }

  // Adjust difficulty based on current performance
  adjustDifficulty(currentScore, questionsAnswered) {
    if (questionsAnswered < 3) return; // Don't adjust too early

    const performanceRate = currentScore / questionsAnswered;
    
    if (performanceRate >= 0.8 && this.currentDifficulty !== 'hard') {
      this.currentDifficulty = this.getNextDifficulty('up');
    } else if (performanceRate <= 0.4 && this.currentDifficulty !== 'easy') {
      this.currentDifficulty = this.getNextDifficulty('down');
    }
  }

  // Get next difficulty level
  getNextDifficulty(direction) {
    const difficulties = ['easy', 'medium', 'hard'];
    const currentIndex = difficulties.indexOf(this.currentDifficulty);
    
    if (direction === 'up' && currentIndex < difficulties.length - 1) {
      return difficulties[currentIndex + 1];
    } else if (direction === 'down' && currentIndex > 0) {
      return difficulties[currentIndex - 1];
    }
    
    return this.currentDifficulty;
  }

  // Select optimal question based on learning style and performance
  selectOptimalQuestion(questions, currentScore, questionsAnswered) {
    // Get learning profile for question selection
    const profile = this.getLearningProfile();
    
    // Score questions based on various factors
    const scoredQuestions = questions.map(question => {
      let score = 0;
      
      // Learning style preference
      if (question.learningStyle === profile?.learningStyle) {
        score += 2;
      }
      
      // Performance-based selection
      const performanceRate = currentScore / questionsAnswered;
      if (performanceRate < 0.5 && question.difficulty === 'easy') {
        score += 1; // Prefer easier questions for struggling students
      } else if (performanceRate > 0.8 && question.difficulty === 'hard') {
        score += 1; // Prefer harder questions for excelling students
      }
      
      // Question type variety
      const questionTypes = this.getQuestionTypesUsed();
      if (!questionTypes.includes(question.type)) {
        score += 1; // Encourage variety
      }
      
      // Topic coverage
      const topicsCovered = this.getTopicsCovered();
      if (!topicsCovered.includes(question.topic)) {
        score += 1; // Encourage topic variety
      }
      
      return { ...question, selectionScore: score };
    });

    // Return question with highest score
    return scoredQuestions.sort((a, b) => b.selectionScore - a.selectionScore)[0];
  }

  // Get learning profile (simplified)
  getLearningProfile() {
    // This would typically come from the LearningProfile class
    return {
      learningStyle: 'visual',
      preferredDifficulty: 'medium'
    };
  }

  // Get question types used so far
  getQuestionTypesUsed() {
    // This would track question types in the current quiz session
    return ['multiple_choice']; // Placeholder
  }

  // Get topics covered so far
  getTopicsCovered() {
    // This would track topics in the current quiz session
    return []; // Placeholder
  }

  // Calculate estimated time for quiz
  calculateEstimatedTime() {
    const baseTimePerQuestion = 60; // seconds
    const difficultyMultiplier = {
      easy: 0.8,
      medium: 1.0,
      hard: 1.3
    };
    
    return Math.ceil(baseTimePerQuestion * difficultyMultiplier[this.currentDifficulty] * 10);
  }

  // Process quiz completion and update learning profile
  async completeQuiz(quizData) {
    try {
      const result = {
        studentId: this.studentId,
        subject: this.subject,
        score: quizData.score,
        totalQuestions: quizData.totalQuestions,
        difficulty: this.currentDifficulty,
        timeSpent: quizData.timeSpent,
        completedAt: new Date().toISOString(),
        questionAnalysis: quizData.questionAnalysis,
        learningInsights: this.generateLearningInsights(quizData)
      };

      // Save quiz result
      const resultsRef = collection(db, 'quizResults');
      await addDoc(resultsRef, result);

      // Update learning profile
      await this.updateLearningProfile(result);

      return result;
    } catch (error) {
      console.error('Error completing quiz:', error);
      throw error;
    }
  }

  // Generate learning insights from quiz performance
  generateLearningInsights(quizData) {
    const insights = {
      strengths: [],
      weaknesses: [],
      recommendations: [],
      difficultyProgression: this.currentDifficulty
    };

    // Analyze question performance
    if (quizData.questionAnalysis) {
      const topicPerformance = {};
      const typePerformance = {};

      quizData.questionAnalysis.forEach(q => {
        // Topic analysis
        if (!topicPerformance[q.topic]) {
          topicPerformance[q.topic] = { correct: 0, total: 0 };
        }
        topicPerformance[q.topic].total++;
        if (q.correct) topicPerformance[q.topic].correct++;

        // Question type analysis
        if (!typePerformance[q.type]) {
          typePerformance[q.type] = { correct: 0, total: 0 };
        }
        typePerformance[q.type].total++;
        if (q.correct) typePerformance[q.type].correct++;
      });

      // Identify strengths and weaknesses
      Object.entries(topicPerformance).forEach(([topic, data]) => {
        const successRate = data.correct / data.total;
        if (successRate >= 0.8) {
          insights.strengths.push(topic);
        } else if (successRate <= 0.4) {
          insights.weaknesses.push(topic);
        }
      });

      // Generate recommendations
      if (insights.weaknesses.length > 0) {
        insights.recommendations.push(
          `Focus on improving ${insights.weaknesses.join(', ')}`
        );
      }

      if (quizData.score >= 90) {
        insights.recommendations.push('Consider more challenging content');
      } else if (quizData.score <= 60) {
        insights.recommendations.push('Review fundamental concepts');
      }
    }

    return insights;
  }

  // Update learning profile with new insights
  async updateLearningProfile(quizResult) {
    try {
      const profileRef = doc(db, 'learningProfiles', this.studentId);
      const profileDoc = await getDoc(profileRef);
      
      if (profileDoc.exists()) {
        const profile = profileDoc.data();
        const insights = quizResult.learningInsights;

        // Update subject performance
        if (!profile.subjects[this.subject]) {
          profile.subjects[this.subject] = {
            totalQuizzes: 0,
            averageScore: 0,
            totalScore: 0,
            lastQuizDate: null
          };
        }

        const subject = profile.subjects[this.subject];
        subject.totalQuizzes++;
        subject.totalScore += quizResult.score;
        subject.averageScore = subject.totalScore / subject.totalQuizzes;
        subject.lastQuizDate = quizResult.completedAt;

        // Update strengths and weaknesses
        profile.strengths = [...new Set([...profile.strengths, ...insights.strengths])];
        profile.weaknesses = [...new Set([...profile.weaknesses, ...insights.weaknesses])];

        // Update preferred difficulty if needed
        if (quizResult.score >= 85 && profile.preferredDifficulty !== 'hard') {
          profile.preferredDifficulty = 'hard';
        } else if (quizResult.score <= 60 && profile.preferredDifficulty !== 'easy') {
          profile.preferredDifficulty = 'easy';
        }

        await updateDoc(profileRef, profile);
      }
    } catch (error) {
      console.error('Error updating learning profile:', error);
    }
  }
} 