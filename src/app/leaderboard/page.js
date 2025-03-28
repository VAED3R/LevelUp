"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";  // Import CSS module

export default function Leaderboard() {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("All");
  const [loading, setLoading] = useState(true);
  const [classToppers, setClassToppers] = useState({});
  const [overallTopper, setOverallTopper] = useState(null);

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, "users"));

        const studentsList = querySnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(user => user.role === "student")
          .sort((a, b) => b.points - a.points);  // Sort by points (descending)

        // Set the overall topper (first in the sorted list)
        const topOverall = studentsList[0] || null;

        // Identify top students by class
        const classTopperMap = {};
        studentsList.forEach((student) => {
          const className = student.class || "Unknown";
          if (
            !classTopperMap[className] ||
            student.points > classTopperMap[className].points
          ) {
            classTopperMap[className] = student;
          }
        });

        // Extract unique classes for the filter dropdown
        const uniqueClasses = Array.from(
          new Set(studentsList.map(student => student.class || "Unknown"))
        );

        setStudents(studentsList);
        setFilteredStudents(studentsList);
        setClasses(["All", ...uniqueClasses]);
        setClassToppers(classTopperMap);
        setOverallTopper(topOverall);

      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  // Handle class filter change
  const handleClassChange = (event) => {
    const selected = event.target.value;
    setSelectedClass(selected);

    if (selected === "All") {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student => student.class === selected);
      setFilteredStudents(filtered);
    }
  };

  // 🏅 Function to display badges with overall topper persistence
  const getBadges = (student) => {
    const isOverallTopper = overallTopper?.id === student.id;
    const isClassTopper = classToppers[student.class]?.id === student.id;

    let badges = "";
    if (isOverallTopper) badges += "🏅";  // Overall topper
    if (isClassTopper) badges += " 🎓";   // Class topper

    return badges;
  };

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <h1 className={styles.title}>Leaderboard</h1>

        {/* Dropdown for filtering */}
        <div className={styles.filterContainer}>
          <label htmlFor="classFilter" className={styles.label}>Filter by Class:</label>
          <select
            id="classFilter"
            value={selectedClass}
            onChange={handleClassChange}
            className={styles.select}
          >
            {classes.map((className, index) => (
              <option key={index} value={className}>
                {className}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className={styles.loading}>Loading...</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Class</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, index) => (
                <tr key={student.id}>
                  <td>{index + 1}</td>
                  <td>
                    {student.name || "Unknown"} 
                    <span className={styles.badge}> {getBadges(student)}</span>
                  </td>
                  <td>{student.class || "N/A"}</td>
                  <td>{student.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
