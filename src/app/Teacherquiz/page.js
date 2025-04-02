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
    const [topic, setTopic] = useState("");
    const [numQuestions, setNumQuestions] = useState(5);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [teacherEmail, setTeacherEmail] = useState("");
    const [subjects, setSubjects] = useState([]);
    const [error, setError] = useState("");
    const [isManualMode, setIsManualMode] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState({
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setTeacherEmail(user.email);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const fetchTeacherSubjects = async () => {
            if (!teacherEmail) return;

            const usersRef = collection(db, "users");
            const querySnapshot = await getDocs(usersRef);
            const teacher = querySnapshot.docs.find(
                (doc) => doc.data().email === teacherEmail
            )?.data();

            if (teacher && teacher.subject) {
                const teacherSubjects = teacher.subject
                    .split(",")
                    .map((sub) => sub.trim().toLowerCase().replace(/ /g, "_"));
                setSubjects(teacherSubjects);
            }
        };

        fetchTeacherSubjects();
    }, [teacherEmail]);

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
        if (!subject || !topic) {
            setError("Please fill in all fields");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const prompt = `Generate ${numQuestions} multiple choice questions about ${topic} in ${subject}. 
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
        if (!subject || !topic || questions.length === 0) {
            setError("Please generate or create questions first");
            return;
        }

        setLoading(true);
        try {
            const quizData = {
                subject,
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
                <h1 className={styles.title}>Create Quiz</h1>

                <div className={styles.form}>
                    <div className={styles.formGroup}>
                        <label>Subject:</label>
                        <select
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className={styles.select}
                        >
                            <option value="">Select Subject</option>
                            {subjects.map((sub) => (
                                <option key={sub} value={sub}>
                                    {sub.replace(/_/g, " ")}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Topic:</label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Enter topic"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.modeToggle}>
                        <button
                            className={`${styles.modeButton} ${!isManualMode ? styles.active : ''}`}
                            onClick={() => setIsManualMode(false)}
                        >
                            AI Generation
                        </button>
                        <button
                            className={`${styles.modeButton} ${isManualMode ? styles.active : ''}`}
                            onClick={() => setIsManualMode(true)}
                        >
                            Manual Creation
                        </button>
                    </div>

                    {!isManualMode ? (
                        <>
                            <div className={styles.formGroup}>
                                <label>Number of Questions:</label>
                                <input
                                    type="number"
                                    value={numQuestions}
                                    onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                                    min="1"
                                    max="10"
                                    className={styles.input}
                                />
                            </div>

                            <div className={styles.buttonGroup}>
                                <button
                                    onClick={generateQuestions}
                                    className={styles.generateButton}
                                    disabled={loading}
                                >
                                    {loading ? "Generating..." : "Generate Quiz"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className={styles.manualQuestionForm}>
                            <div className={styles.formGroup}>
                                <label>Question:</label>
                                <input
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

                            <div className={styles.formGroup}>
                                <label>Options:</label>
                                {currentQuestion.options.map((option, index) => (
                                    <div key={index} className={styles.optionInput}>
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => handleOptionChange(index, e.target.value)}
                                            placeholder={`Option ${index + 1}`}
                                            className={styles.input}
                                        />
                                        <label className={styles.radioLabel}>
                                            <input
                                                type="radio"
                                                name="correctAnswer"
                                                checked={currentQuestion.correctAnswer === index}
                                                onChange={() => setCurrentQuestion({
                                                    ...currentQuestion,
                                                    correctAnswer: index
                                                })}
                                            />
                                            Correct
                                        </label>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleAddQuestion}
                                className={styles.addButton}
                            >
                                Add Question
                            </button>
                        </div>
                    )}

                    {error && <div className={styles.error}>{error}</div>}

                    {questions.length > 0 && (
                        <button
                            onClick={handleSaveQuiz}
                            className={styles.saveButton}
                            disabled={loading}
                        >
                            {loading ? "Saving..." : "Save Quiz"}
                        </button>
                    )}
                </div>

                {questions.length > 0 && (
                    <div className={styles.questionsContainer}>
                        <h2 className={styles.questionsTitle}>Questions</h2>
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
                                                Remove
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
    );
}