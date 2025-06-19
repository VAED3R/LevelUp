"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, addDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import style from './page.module.css';
import Navbar from "@/components/teacherNavbar";

export default function CourseMapping() {
    const [teacherEmail, setTeacherEmail] = useState("");
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSemester, setSelectedSemester] = useState("");
    const [students, setStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [classes, setClasses] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [courseTypes, setCourseTypes] = useState([]);
    const [studentCourses, setStudentCourses] = useState({});
    const [courseNamesByType, setCourseNamesByType] = useState({});
    const [submitMessage, setSubmitMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Get current teacher email
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setTeacherEmail(user.email);
            }
        });
        return () => unsubscribe();
    }, []);

    // Fetch classes from users collection
    const fetchClasses = async () => {
        try {
            const usersRef = collection(db, "users");
            const querySnapshot = await getDocs(usersRef);
            
            const classSet = new Set();
            querySnapshot.docs.forEach(doc => {
                const userData = doc.data();
                if (userData.class && userData.role === 'student') {
                    classSet.add(userData.class);
                }
            });
            
            const classesList = Array.from(classSet).sort();
            setClasses(classesList);
        } catch (error) {
            console.error("Error fetching classes:", error);
        }
    };

    // Fetch semesters from subjects collection
    const fetchSemesters = async () => {
        try {
            const subjectsRef = collection(db, "subjects");
            const querySnapshot = await getDocs(subjectsRef);
            
            const semesterSet = new Set();
            querySnapshot.docs.forEach(doc => {
                const subjectData = doc.data();
                if (subjectData.semester) {
                    semesterSet.add(subjectData.semester);
                }
            });
            
            const semestersList = Array.from(semesterSet).sort();
            setSemesters(semestersList);
        } catch (error) {
            console.error("Error fetching semesters:", error);
        }
    };

    // Fetch course types from subjects collection
    const fetchCourseTypes = async () => {
        try {
            const subjectsRef = collection(db, "subjects");
            const querySnapshot = await getDocs(subjectsRef);
            
            const typeSet = new Set();
            querySnapshot.docs.forEach(doc => {
                const subjectData = doc.data();
                if (subjectData.type) {
                    typeSet.add(subjectData.type);
                }
            });
            
            const typesList = Array.from(typeSet).sort();
            setCourseTypes(typesList);
        } catch (error) {
            console.error("Error fetching course types:", error);
        }
    };

    // Fetch course names by type and semester
    const fetchCourseNamesByType = async () => {
        if (!selectedSemester) return;

        try {
            const subjectsRef = collection(db, "subjects");
            const q = query(subjectsRef, where("semester", "==", selectedSemester));
            const querySnapshot = await getDocs(q);
            
            const courseNamesByTypeMap = {};
            
            querySnapshot.docs.forEach(doc => {
                const subjectData = doc.data();
                if (subjectData.type && subjectData.courseName) {
                    if (!courseNamesByTypeMap[subjectData.type]) {
                        courseNamesByTypeMap[subjectData.type] = [];
                    }
                    courseNamesByTypeMap[subjectData.type].push(subjectData.courseName);
                }
            });
            
            // Sort course names within each type
            Object.keys(courseNamesByTypeMap).forEach(type => {
                courseNamesByTypeMap[type].sort();
            });
            
            setCourseNamesByType(courseNamesByTypeMap);
        } catch (error) {
            console.error("Error fetching course names by type:", error);
        }
    };

    const fetchStudents = async () => {
        if (!selectedClass || !selectedSemester) {
            setStudents([]);
            return;
        }

        setLoadingStudents(true);
        try {
            const studentsRef = collection(db, "users");
            const q = query(
                studentsRef, 
                where("class", "==", selectedClass),
                where("role", "==", "student")
            );
            const querySnapshot = await getDocs(q);
            
            const studentsList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Sort students by name in ascending order
            studentsList.sort((a, b) => {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
            
            setStudents(studentsList);
            
            // Initialize student courses state
            const initialCourses = {};
            studentsList.forEach(student => {
                initialCourses[student.id] = {};
                courseTypes.forEach(type => {
                    initialCourses[student.id][type] = '';
                });
            });
            setStudentCourses(initialCourses);
        } catch (error) {
            console.error("Error fetching students:", error);
        } finally {
            setLoadingStudents(false);
        }
    };

    const handleCourseChange = (studentId, courseType, value) => {
        setStudentCourses(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [courseType]: value
            }
        }));
    };

    // Fetch classes, semesters, and course types on component mount
    useEffect(() => {
        fetchClasses();
        fetchSemesters();
        fetchCourseTypes();
    }, []);

    // Fetch students when class or semester changes
    useEffect(() => {
        fetchStudents();
    }, [selectedClass, selectedSemester]);

    // Fetch course names when semester changes
    useEffect(() => {
        fetchCourseNamesByType();
    }, [selectedSemester]);

    const handleSubmit = async () => {
        if (!selectedClass || !selectedSemester) {
            setSubmitMessage("Please select both class and semester");
            return;
        }

        setSubmitting(true);
        setSubmitMessage("");

        try {
            const coursemapRef = collection(db, "coursemap");
            let uploadedCount = 0;

            // Get course details from subjects collection
            const subjectsRef = collection(db, "subjects");
            const q = query(subjectsRef, where("semester", "==", selectedSemester));
            const subjectsSnapshot = await getDocs(q);
            
            const courseDetails = {};
            subjectsSnapshot.docs.forEach(doc => {
                const subjectData = doc.data();
                if (subjectData.courseName && subjectData.type) {
                    courseDetails[subjectData.courseName] = {
                        code: subjectData.code || '',
                        type: subjectData.type,
                        semester: subjectData.semester
                    };
                }
            });

            // Upload course mapping for each student
            for (const student of students) {
                const studentCourseSelections = studentCourses[student.id] || {};
                const semesterCourses = [];
                
                for (const [courseType, selectedCourse] of Object.entries(studentCourseSelections)) {
                    if (selectedCourse && selectedCourse !== 'NA') {
                        const courseDetail = courseDetails[selectedCourse];
                        if (courseDetail) {
                            semesterCourses.push({
                                courseName: selectedCourse,
                                courseCode: courseDetail.code,
                                courseType: courseDetail.type,
                                semester: courseDetail.semester
                            });
                        }
                    }
                }

                if (semesterCourses.length > 0) {
                    // Check if document already exists for this student
                    const existingQuery = query(coursemapRef, where("studentId", "==", student.id));
                    const existingSnapshot = await getDocs(existingQuery);
                    
                    if (!existingSnapshot.empty) {
                        // Update existing document - append new semester
                        const existingDoc = existingSnapshot.docs[0];
                        const existingData = existingDoc.data();
                        const updatedSemesters = [...existingData.semesters];
                        
                        // Check if semester already exists
                        const semesterIndex = updatedSemesters.findIndex(s => s.semesterName === selectedSemester);
                        
                        if (semesterIndex !== -1) {
                            // Append new courses to existing semester
                            const existingSemester = updatedSemesters[semesterIndex];
                            const updatedCourses = [...existingSemester.courses, ...semesterCourses];
                            
                            updatedSemesters[semesterIndex] = {
                                semesterName: selectedSemester,
                                courses: updatedCourses
                            };
                        } else {
                            // Add new semester
                            updatedSemesters.push({
                                semesterName: selectedSemester,
                                courses: semesterCourses
                            });
                        }
                        
                        await updateDoc(existingDoc.ref, {
                            semesters: updatedSemesters
                        });
                    } else {
                        // Create new document
                        await addDoc(coursemapRef, {
                            studentId: student.id,
                            studentName: student.name,
                            studentEmail: student.email,
                            class: selectedClass,
                            semesters: [{
                                semesterName: selectedSemester,
                                courses: semesterCourses
                            }]
                        });
                    }
                    uploadedCount++;
                }
            }

            setSubmitMessage(`Successfully uploaded ${uploadedCount} course mappings to database`);
            
            // Clear student courses after successful upload
            setStudentCourses({});
            
        } catch (error) {
            console.error("Error uploading course mapping:", error);
            setSubmitMessage(`Error: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={style.container}>
            <Navbar />
            <div className={style.content}>
                <div className={style.section}>
                    <div className={style.sectionHeader}>
                        <h1 className={style.sectionTitle}>Course Mapping</h1>
                        <p className={style.sectionSubtitle}>Map students to courses by class and semester</p>
                    </div>

                    <div className={style.mappingForm}>
                        <div className={style.filtersRow}>
                            <div className={style.filterGroup}>
                                <label className={style.label}>Class</label>
                                <select
                                    key="class-select"
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className={style.select}
                                >
                                    <option value="">Choose a class</option>
                                    {classes.map((className) => (
                                        <option key={className} value={className}>
                                            {className}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={style.filterGroup}>
                                <label className={style.label}>Semester</label>
                                <select
                                    key="semester-select"
                                    value={selectedSemester}
                                    onChange={(e) => setSelectedSemester(e.target.value)}
                                    className={style.select}
                                >
                                    <option value="">Choose a semester</option>
                                    {semesters.map((semester) => (
                                        <option key={semester} value={semester}>
                                            {semester}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {selectedClass && selectedSemester && (
                            <>
                                <div className={style.sectionHeader}>
                                    <h2 className={style.sectionTitle}>Students in {selectedClass} - {selectedSemester}</h2>
                                    <p className={style.sectionSubtitle}>{students.length} students found</p>
                                </div>

                                {loadingStudents ? (
                                    <div className={style.loadingState}>
                                        <div className={style.loadingSpinner}></div>
                                        <p className={style.loadingText}>Loading students...</p>
                                    </div>
                                ) : students.length === 0 ? (
                                    <div className={style.emptyState}>
                                        <div className={style.emptyIcon}>👥</div>
                                        <p className={style.emptyText}>No students found for this class and semester.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className={style.dataTable}>
                                            <div className={style.tableHeader}>
                                                <div className={style.headerCell}>Student Name</div>
                                                {courseTypes.map((type) => (
                                                    <div key={type} className={style.headerCell}>
                                                        <span className={style.courseTypeIcon}>📚</span>
                                                        {type}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className={style.tableBody}>
                                                {students.map((student) => (
                                                    <div key={student.id} className={style.tableRow}>
                                                        <div className={style.nameCell}>
                                                            <span className={style.studentIcon}>👤</span>
                                                            {student.name || 'Unknown Student'}
                                                        </div>
                                                        {courseTypes.map((courseType) => (
                                                            <div key={courseType} className={style.dropdownCell}>
                                                                <select
                                                                    key={`${student.id}-${courseType}`}
                                                                    value={studentCourses[student.id]?.[courseType] || ''}
                                                                    onChange={(e) => handleCourseChange(student.id, courseType, e.target.value)}
                                                                    className={style.courseSelect}
                                                                >
                                                                    <option value="">Select Course</option>
                                                                    {courseType.toLowerCase() !== 'core' && (
                                                                        <option value="NA">NA</option>
                                                                    )}
                                                                    {courseNamesByType[courseType]?.map((courseName) => (
                                                                        <option key={courseName} value={courseName}>
                                                                            {courseName}
                                                                        </option>
                                                                    )) || []}
                                                                </select>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <div className={style.submitSection}>
                                            <button
                                                key="submit-button"
                                                onClick={handleSubmit}
                                                disabled={submitting}
                                                className={style.submitButton}
                                            >
                                                {submitting ? (
                                                    <>
                                                        <span className={style.buttonIcon}>⏳</span>
                                                        Submitting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className={style.buttonIcon}>💾</span>
                                                        Submit Course Mapping
                                                    </>
                                                )}
                                            </button>
                                            {submitMessage && (
                                                <div className={`${style.message} ${submitMessage.includes('Error') ? style.error : style.success}`}>
                                                    <span className={style.messageIcon}>
                                                        {submitMessage.includes('Error') ? '❌' : '✅'}
                                                    </span>
                                                    {submitMessage}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
