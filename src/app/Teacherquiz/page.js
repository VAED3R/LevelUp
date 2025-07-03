"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "@/components/teacherNavbar";
import styles from "./page.module.css";

export default function TeacherQuiz() {
    const [subject, setSubject] = useState("");
    const [semester, setSemester] = useState("");
    const [topic, setTopic] = useState("");
    const [numQuestions, setNumQuestions] = useState(5);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [teacherEmail, setTeacherEmail] = useState("");
    const [subjects, setSubjects] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [allSubjectsData, setAllSubjectsData] = useState([]);
    const [error, setError] = useState("");
    const [isManualMode, setIsManualMode] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState({
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0
    });
    const [topics, setTopics] = useState([]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setTeacherEmail(user.email);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const fetchSubjects = async () => {
            try {
                const subjectsQuery = await getDocs(collection(db, "subjects"));
                const subjectsData = subjectsQuery.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log("All subjects from collection:", subjectsData);

                // Store all subjects data for filtering later
                setAllSubjectsData(subjectsData);

                // Extract unique semesters
                const uniqueSemesters = [...new Set(
                    subjectsData.map(subject => subject.semester).filter(Boolean)
                )];

                console.log("Available semesters:", uniqueSemesters);
                setSemesters(uniqueSemesters.sort());
                
                // Clear subjects initially
                setSubjects([]);
            } catch (error) {
                console.error("Error fetching subjects:", error);
                setError("Failed to load subjects");
            }
        };

        fetchSubjects();
    }, []);

    // Filter subjects based on selected semester
    useEffect(() => {
        if (semester && allSubjectsData.length > 0) {
            // Filter subjects by selected semester
            const filteredSubjects = allSubjectsData.filter(
                subject => subject.semester === semester
            );

            // Extract unique subject names for the selected semester
            const uniqueSubjects = [...new Set(
                filteredSubjects.map(subject => subject.courseName).filter(Boolean)
            )];

            console.log(`Subjects for semester ${semester}:`, uniqueSubjects);
            setSubjects(uniqueSubjects.sort());
            
            // Reset selected subject when semester changes
            setSubject("");
        } else {
            setSubjects([]);
            setSubject("");
        }
    }, [semester, allSubjectsData]);

    // Fetch topics for selected subject
    useEffect(() => {
        const fetchTopics = async () => {
            if (subject) {
                try {
                    const res = await fetch("/api/get-topics", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ subject }),
                    });
                    const data = await res.json();
                    setTopics(data.topics || []);
                } catch (e) {
                    setTopics([]);
                }
            } else {
                setTopics([]);
            }
        };
        fetchTopics();
    }, [subject]);

    const handleOptionChange = (index, value) => {
        const newOptions = [...currentQuestion.options];
        newOptions[index] = value;
        setCurrentQuestion({
            ...currentQuestion,
            options: newOptions
        });
    };

    const handleAddQuestion = () => {
        if (!currentQuestion.question || currentQuestion.options.some(opt => !opt)) {
            setError("Please fill in all fields for the question");
            return;
        }

        setQuestions([...questions, currentQuestion]);
        setCurrentQuestion({
            question: "",
            options: ["", "", "", ""],
            correctAnswer: 0
        });
        setError("");
    };

    const handleRemoveQuestion = (index) => {
        const newQuestions = questions.filter((_, i) => i !== index);
        setQuestions(newQuestions);
    };

    const generateQuestions = async () => {
        if (!subject || !semester || !topic) {
            setError("Please fill in all fields");
            return;
        }

        // Validate topic first
        setLoading(true);
        setError("");
        try {
            const validateRes = await fetch("/api/validate-topic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject, topic }),
            });
            const validateData = await validateRes.json();
            if (!validateData.valid) {
                setError("Topic not found in allowed topics. Please choose a valid topic.");
                setLoading(false);
                return;
            }
        } catch (e) {
            setError("Error validating topic. Please try again.");
            setLoading(false);
            return;
        }

        try {
            const prompt = `Generate ${numQuestions} multiple choice questions about ${topic} in ${subject} for semester ${semester}. 
            IMPORTANT: Return ONLY a JSON array in the following format, with no additional text or explanation:
            [
                {
                    "question": "What is...",
                    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
                    "correctAnswer": 0
                },
                ...
            ]
            Make sure the response is valid JSON and follows this exact structure.`;

            const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [{ 
                        role: "user", 
                        content: prompt 
                    }],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                throw new Error("Failed to generate questions");
            }

            const data = await response.json();
            let generatedQuestions;
            
            try {
                const content = data.choices[0].message.content.trim();
                generatedQuestions = JSON.parse(content);
                
                if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
                    throw new Error("Invalid question format");
                }
                
                generatedQuestions.forEach((q, index) => {
                    if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || 
                        typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
                        throw new Error(`Invalid question format at index ${index}`);
                    }
                });
                
                setQuestions(generatedQuestions);
            } catch (parseError) {
                console.error("Error parsing API response:", parseError);
                throw new Error("Failed to parse generated questions");
            }
        } catch (error) {
            console.error("Error generating quiz:", error);
            const templateQuestions = [];
            for (let i = 0; i < numQuestions; i++) {
                templateQuestions.push({
                    question: `Question ${i + 1} about ${topic} in ${subject}`,
                    options: [
                        `Option 1 for question ${i + 1}`,
                        `Option 2 for question ${i + 1}`,
                        `Option 3 for question ${i + 1}`,
                        `Option 4 for question ${i + 1}`
                    ],
                    correctAnswer: 0
                });
            }
            setQuestions(templateQuestions);
            setError("Using template questions. Please modify them as needed.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveQuiz = async () => {
        if (!subject || !semester || !topic || questions.length === 0) {
            setError("Please generate or create questions first");
            return;
        }

        setLoading(true);
        try {
            const quizData = {
                subject,
                semester,
                topic,
                questions,
                teacherEmail,
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, "quizzes"), quizData);
            alert("Quiz saved successfully!");
        } catch (error) {
            console.error("Error saving quiz:", error);
            setError("Error saving quiz. Please try again.");
        }
        setLoading(false);
    };

    return (
        <div className={styles.container}>
            <Navbar />
            <div className={styles.content}>
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h1 className={styles.sectionTitle}>Create Quiz</h1>
                        <p className={styles.sectionSubtitle}>Generate or manually create quizzes for your students</p>
                    </div>

                    <div className={styles.quizForm}>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Semester</label>
                                <select
                                    key="semester-select"
                                    value={semester}
                                    onChange={(e) => setSemester(e.target.value)}
                                    className={styles.select}
                                    required
                                >
                                    <option value="">Select Semester</option>
                                    {semesters.map((semesterItem) => (
                                        <option key={semesterItem} value={semesterItem}>
                                            {semesterItem}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Subject</label>
                                <select
                                    key="subject-select"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className={styles.select}
                                    required
                                    disabled={!semester}
                                >
                                    <option value="">
                                        {semester ? "Select Subject" : "Select semester first"}
                                    </option>
                                    {subjects.map((subjectName) => (
                                        <option key={subjectName} value={subjectName}>
                                            {subjectName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Topic</label>
                            <select
                                key="topic-select"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                className={styles.select}
                                disabled={!subject}
                            >
                                <option value="">{subject ? "Select Topic" : "Select subject first"}</option>
                                {topics.map((topicName, idx) => (
                                    <option key={topicName + '-' + idx} value={topicName}>
                                        {topicName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.modeToggle}>
                            <button
                                key="ai-mode-button"
                                className={`${styles.modeButton} ${!isManualMode ? styles.active : ''}`}
                                onClick={() => setIsManualMode(false)}
                            >
                                <span className={styles.modeIcon}>🤖</span>
                                AI Generation
                            </button>
                            <button
                                key="manual-mode-button"
                                className={`${styles.modeButton} ${isManualMode ? styles.active : ''}`}
                                onClick={() => setIsManualMode(true)}
                            >
                                <span className={styles.modeIcon}>✏️</span>
                                Manual Creation
                            </button>
                        </div>

                        {!isManualMode ? (
                            <div className={styles.aiSection}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Number of Questions</label>
                                    <input
                                        key="num-questions-input"
                                        type="number"
                                        value={numQuestions}
                                        onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                                        min="1"
                                        max="10"
                                        className={styles.input}
                                    />
                                </div>

                                <button
                                    key="generate-button"
                                    onClick={generateQuestions}
                                    className={styles.generateButton}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <span className={styles.buttonIcon}>⏳</span>
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <span className={styles.buttonIcon}>✨</span>
                                            Generate Quiz
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className={styles.manualSection}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Question</label>
                                    <input
                                        key="current-question-input"
                                        type="text"
                                        value={currentQuestion.question}
                                        onChange={(e) => setCurrentQuestion({
                                            ...currentQuestion,
                                            question: e.target.value
                                        })}
                                        placeholder="Enter your question"
                                        className={styles.input}
                                    />
                                </div>

                                <div className={styles.optionsSection}>
                                    <label className={styles.label}>Options</label>
                                    <div className={styles.optionsGrid}>
                                        {currentQuestion.options.map((option, index) => (
                                            <div key={`option-${index}`} className={styles.optionInput}>
                                                <input
                                                    key={`option-input-${index}`}
                                                    type="text"
                                                    value={option}
                                                    onChange={(e) => handleOptionChange(index, e.target.value)}
                                                    placeholder={`Option ${index + 1}`}
                                                    className={styles.input}
                                                />
                                                <label className={styles.radioLabel}>
                                                    <input
                                                        key={`radio-${index}`}
                                                        type="radio"
                                                        name="correctAnswer"
                                                        checked={currentQuestion.correctAnswer === index}
                                                        onChange={() => setCurrentQuestion({
                                                            ...currentQuestion,
                                                            correctAnswer: index
                                                        })}
                                                    />
                                                    <span className={styles.radioText}>Correct</span>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    key="add-question-button"
                                    onClick={handleAddQuestion}
                                    className={styles.addButton}
                                >
                                    <span className={styles.buttonIcon}>➕</span>
                                    Add Question
                                </button>
                            </div>
                        )}

                        {error && <div className={styles.error}>{error}</div>}
                    </div>

                    {loading && (
                        <div className={styles.loadingSection}>
                            <div className={styles.loadingCard}>
                                <div className={styles.loadingSpinner}></div>
                                <h3>Generating Quiz Questions...</h3>
                                <p>Please wait while AI creates your quiz questions</p>
                            </div>
                        </div>
                    )}

                    {questions.length > 0 && (
                        <div className={styles.saveQuizSection}>
                            <button
                                key="save-quiz-button"
                                onClick={handleSaveQuiz}
                                className={styles.saveButton}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className={styles.buttonIcon}>⏳</span>
                                        Saving Quiz...
                                    </>
                                ) : (
                                    <>
                                        <span className={styles.buttonIcon}>💾</span>
                                        Save Quiz
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {questions.length > 0 && (
                        <div className={styles.questionsSection}>
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>Generated Questions</h2>
                                <p className={styles.sectionSubtitle}>{questions.length} questions ready</p>
                            </div>
                            
                            <div className={styles.questionsGrid}>
                                {questions.map((q, index) => (
                                    <div key={index} className={styles.questionCard}>
                                        <div className={styles.questionHeader}>
                                            <div className={styles.questionNumber}>Question {index + 1}</div>
                                            {isManualMode && (
                                                <button
                                                    onClick={() => handleRemoveQuestion(index)}
                                                    className={styles.removeButton}
                                                >
                                                    <span className={styles.removeIcon}>🗑️</span>
                                                </button>
                                            )}
                                        </div>
                                        <p className={styles.questionText}>{q.question}</p>
                                        <div className={styles.options}>
                                            {q.options.map((option, optIndex) => (
                                                <div
                                                    key={optIndex}
                                                    className={`${styles.option} ${
                                                        optIndex === q.correctAnswer
                                                            ? styles.correct
                                                            : ""
                                                    }`}
                                                >
                                                    <span className={styles.optionLabel}>
                                                        {String.fromCharCode(65 + optIndex)}.
                                                    </span>
                                                    {option}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}