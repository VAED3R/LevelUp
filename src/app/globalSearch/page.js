"use client";

import { useState } from "react";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";

export default function GlobalSearch() {
    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Local SearXNG instance URL
    const SEARXNG_URL = 'http://localhost:8080';

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/search?q=${encodeURIComponent(query)}`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Search failed with status: ${response.status}`);
            }

            const data = await response.json();
            setSearchResults(data.results);
        } catch (error) {
            console.error('Search error:', error);
            setError('Failed to fetch search results. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <Navbar />
            <h1 className={styles.heading}>AI-Enhanced Learning Resources</h1>
            
            <div className={styles.searchSection}>
                <form onSubmit={handleSearch} className={styles.form}>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="What would you like to learn about?"
                        className={styles.input}
                        disabled={loading}
                    />
                    <button 
                        type="submit"
                        disabled={loading}
                        className={styles.button}
                    >
                        {loading ? "Searching..." : "Search"}
                    </button>
                </form>

                {error && <p className={styles.error}>{error}</p>}
            </div>

            <div className={styles.resultsContainer}>
                {searchResults.map((result, index) => (
                    <div key={index} className={styles.resultCard}>
                        <a 
                            href={result.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.resultTitle}
                        >
                            {result.title}
                        </a>
                        <p className={styles.resultDescription}>
                            {result.snippet}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}