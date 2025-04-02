"use client";

import Navbar from "@/components/teacherNavbar";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import styles from "./page.module.css";

export default function QuizCreator() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [numQuestions, setNumQuestions] = useState(1);
  const [questions, setQuestions] = useState([]);
  const [teacherEmail, setTeacherEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // AI quiz generation parameters
  const [aiSubject, setAiSubject] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [topic, setTopic] = useState("");
  const [aiNumQuestions, setAiNumQuestions] = useState(5);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState("");

  // Get teacher email from Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setTeacherEmail(user.email);
      } else {
        setTeacherEmail("");
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch teacher subjects from Firestore
  useEffect(() => {
    if (!teacherEmail) return;
    
    const fetchSubjects = async () => {
      try {
        const teacherQuery = await getDocs(collection(db, "users"));
        const teacher = teacherQuery.docs.find(
          (doc) => doc.data().email === teacherEmail
        )?.data();

        if (teacher) {
          const teacherSubjects = teacher.subject
            .split(",")
            .map((sub) => sub.trim().toLowerCase().replace(/ /g, "_"));
          setSubjects(teacherSubjects);
        }
      } catch (error) {
        console.error("Error fetching subjects:", error);
      }
    };
    fetchSubjects();
  }, [teacherEmail]);

  // Initialize manual quiz questions based on the number of questions
  useEffect(() => {
    setQuestions(
      Array.from({ length: numQuestions }, () => ({
        question: "",
        options: ["", "", "", ""],
        correctAnswer: "",
      }))
    );
  }, [numQuestions]);

  // Manual quiz handlers
  const handleQuestionChange = (index, value) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index].question = value;
    setQuestions(updatedQuestions);
  };

  const handleOptionChange = (qIndex, oIndex, value) => {
    const updatedQuestions = [...questions];
    updatedQuestions[qIndex].options[oIndex] = value;
    setQuestions(updatedQuestions);
  };

  const handleCorrectAnswerChange = (qIndex, value) => {
    const updatedQuestions = [...questions];
    updatedQuestions[qIndex].correctAnswer = value;
    setQuestions(updatedQuestions);
  };

  const validateQuiz = () => {
    if (!selectedSubject) {
      setAiError("Please select a subject");
      return false;
    }

    for (const q of questions) {
      if (!q.question.trim()) {
        setAiError("All questions must have text");
        return false;
      }

      if (q.options.some(opt => !opt.trim())) {
        setAiError("All options must be filled in");
        return false;
      }

      if (!q.correctAnswer) {
        setAiError("Please select a correct answer for each question");
        return false;
      }
    }

    return true;
  };

  const handleSaveQuiz = async () => {
    if (!validateQuiz()) return;

    setIsSaving(true);
    try {
      const quizRef = doc(collection(db, `quizzes_${selectedSubject}`));
      await setDoc(quizRef, { 
        questions,
        createdBy: teacherEmail,
        createdAt: new Date().toISOString(),
        subject: selectedSubject,
        isAIGenerated: false
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving quiz:", error);
      setAiError("Failed to save quiz. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // AI quiz generation handler using DeepSeek API
  const handleGenerateAIQuiz = async () => {
    // Validate inputs
    if (!aiSubject) {
      setAiError("Please enter a subject");
      return;
    }
    if (!difficulty) {
      setAiError("Please select a difficulty level");
      return;
    }
    if (!topic) {
      setAiError("Please enter a topic");
      return;
    }
    if (aiNumQuestions < 1 || aiNumQuestions > 20) {
      setAiError("Number of questions must be between 1 and 20");
      return;
    }

    setLoadingAI(true);
    setAiError("");
  
    try {
      const prompt = `Generate ${aiNumQuestions} ${difficulty} difficulty multiple choice questions about ${topic} in ${aiSubject}. 
      Return ONLY a JSON array where each element has:
      - "question": string
      - "options": string array (exactly 4 items)
      - "correctAnswer": string (must match one option exactly)
      
      Example:
      [{
        "question": "What is 2+2?",
        "options": ["3", "4", "5", "6"],
        "correctAnswer": "4"
      }]`;
  
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: "json_object" } // Request JSON response
        }),
        signal: AbortSignal.timeout(15000)
      });
  
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
  
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
  
      if (!content) {
        throw new Error("No content received from API");
      }
  
      // Try to extract JSON from markdown or plain text response
      let parsedQuestions = [];
      try {
        // First try parsing as pure JSON
        parsedQuestions = JSON.parse(content);
      } catch (e) {
        // If pure JSON fails, try extracting JSON from markdown code block
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          parsedQuestions = JSON.parse(jsonMatch[1]);
        } else {
          // If no code block, try parsing the whole content directly
          parsedQuestions = JSON.parse(content);
        }
      }
  
      // Validate the parsed questions
      if (!Array.isArray(parsedQuestions)) {
        throw new Error("API did not return an array of questions");
      }
  
      const generatedQuestions = parsedQuestions.map((q, index) => {
        if (!q.question || !q.options || !q.correctAnswer) {
          throw new Error(`Question ${index + 1} is missing required fields`);
        }
  
        return {
          question: q.question,
          options: Array.isArray(q.options) ? q.options.slice(0, 4) : [],
          correctAnswer: q.correctAnswer
        };
      });
  
      setQuestions(generatedQuestions);
      setNumQuestions(generatedQuestions.length);
      setSelectedSubject(aiSubject.toLowerCase().replace(/ /g, "_"));
  
    } catch (error) {
      console.error("Error generating quiz:", error);
      setAiError(`Generation failed: ${error.message}. Trying fallback...`);
      generateLocalFallbackQuestions();
    } finally {
      setLoadingAI(false);
    }
  };

  const addQuestion = () => {
    setNumQuestions(prev => prev + 1);
    setQuestions([...questions, {
      question: "",
      options: ["", "", "", ""],
      correctAnswer: ""
    }]);
  };

  const removeQuestion = (index) => {
    if (numQuestions <= 1) return;
    setNumQuestions(prev => prev - 1);
    setQuestions(questions.filter((_, i) => i !== index));
  };

  return (
    <div>
      <Navbar />
      <div className={styles.container}>
        <div className={styles.content}>
          <h1 className={styles.title}>Create a Quiz</h1>

          {/* Manual Quiz Section */}
          <section className={styles.section}>
            <h2>Manual Quiz Creation</h2>
            <div className={styles.formGroup}>
              <label className={styles.label}>Subject:</label>
              <select
                className={styles.select}
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                required
              >
                <option value="">Select Subject</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Number of Questions:</label>
              <div className={styles.numberInputContainer}>
                <button 
                  className={styles.numberInputButton}
                  onClick={() => setNumQuestions(prev => Math.max(1, prev - 1))}
                  disabled={numQuestions <= 1}
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="50"
                  className={styles.numberInput}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <button 
                  className={styles.numberInputButton}
                  onClick={() => setNumQuestions(prev => prev + 1)}
                >
                  +
                </button>
              </div>
            </div>

            {questions.map((q, qIndex) => (
              <div key={qIndex} className={styles.questionCard}>
                <div className={styles.questionHeader}>
                  <h3>Question {qIndex + 1}</h3>
                  {numQuestions > 1 && (
                    <button 
                      className={styles.removeButton}
                      onClick={() => removeQuestion(qIndex)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                
                <input
                  type="text"
                  placeholder={`Enter question ${qIndex + 1}`}
                  className={styles.questionInput}
                  value={q.question}
                  onChange={(e) => handleQuestionChange(qIndex, e.target.value)}
                  required
                />
                
                <div className={styles.optionsGrid}>
                  {q.options.map((option, oIndex) => (
                    <div key={oIndex} className={styles.optionItem}>
                      <input
                        type="text"
                        placeholder={`Option ${oIndex + 1}`}
                        className={styles.optionInput}
                        value={option}
                        onChange={(e) =>
                          handleOptionChange(qIndex, oIndex, e.target.value)
                        }
                        required
                      />
                      <input
                        type="radio"
                        name={`correctAnswer-${qIndex}`}
                        checked={q.correctAnswer === option}
                        onChange={() => handleCorrectAnswerChange(qIndex, option)}
                        disabled={!option.trim()}
                        className={styles.radioInput}
                      />
                      <label>Correct</label>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className={styles.buttonGroup}>
              <button 
                onClick={addQuestion}
                className={styles.secondaryButton}
              >
                Add Question
              </button>
              <button 
                onClick={handleSaveQuiz} 
                className={styles.primaryButton}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Quiz"}
              </button>
            </div>
            {saveSuccess && (
              <div className={styles.successMessage}>
                Quiz saved successfully!
              </div>
            )}
            {aiError && !saveSuccess && (
              <div className={styles.errorMessage}>{aiError}</div>
            )}
          </section>

          <hr className={styles.divider} />

          {/* AI Generation Section */}
          <section className={styles.section}>
            <h2>Generate Quiz with AI</h2>
            
            <div className={styles.formGroup}>
              <label className={styles.label}>Subject:</label>
              <input
                type="text"
                placeholder="Enter subject (e.g., mathematics)"
                className={styles.input}
                value={aiSubject}
                onChange={(e) => setAiSubject(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Difficulty:</label>
              <select
                className={styles.select}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Topic:</label>
              <input
                type="text"
                placeholder="Enter specific topic"
                className={styles.input}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Number of Questions:</label>
              <input
                type="number"
                min="1"
                max="20"
                className={styles.input}
                value={aiNumQuestions}
                onChange={(e) => setAiNumQuestions(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
              />
            </div>

            <button
              onClick={handleGenerateAIQuiz}
              className={styles.primaryButton}
              disabled={loadingAI}
            >
              {loadingAI ? "Generating..." : "Generate Quiz"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}