"use client";

import { useState } from "react";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";
import IntroAnimation from "../../components/IntroAnimation";

export default function GlobalSearch() {
    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [improvedQuery, setImprovedQuery] = useState("");
    const [filteredResults, setFilteredResults] = useState([]);
    const [isImprovingQuery, setIsImprovingQuery] = useState(false);
    const [isFilteringResults, setIsFilteringResults] = useState(false);

    // Local SearXNG instance URL
    const SEARXNG_URL = 'http://localhost:8080';

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError(null);
        setImprovedQuery("");
        setFilteredResults([]);

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

    const improveSearchQuery = async () => {
        if (!query.trim() || isImprovingQuery) return;
        
        setIsImprovingQuery(true);
        try {
            const response = await fetch('/api/improve-query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            });

            if (!response.ok) {
                throw new Error('Failed to improve query');
            }

            const data = await response.json();
            setImprovedQuery(data.improvedQuery);
        } catch (error) {
            console.error('Query improvement error:', error);
            setError('Failed to improve search query. Please try again.');
        } finally {
            setIsImprovingQuery(false);
        }
    };

    const filterSearchResults = async () => {
        if (searchResults.length === 0 || isFilteringResults) return;
        
        setIsFilteringResults(true);
        try {
            // Ensure each result has the required fields
            const formattedResults = searchResults.map(result => ({
                title: result.title || '',
                url: result.url || '',
                snippet: result.snippet || '',
                // Add any other fields that might be present
                ...result
            }));

            console.log('Sending results to filter:', formattedResults);

            const response = await fetch('/api/filter-results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ results: formattedResults }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to filter results');
            }

            const data = await response.json();
            console.log('Received filtered results:', data);
            setFilteredResults(data.filteredResults);
        } catch (error) {
            console.error('Results filtering error:', error);
            setError(error.message || 'Failed to filter search results. Please try again.');
        } finally {
            setIsFilteringResults(false);
        }
    };

    const handleUseImprovedQuery = () => {
        if (improvedQuery) {
            setQuery(improvedQuery);
            setImprovedQuery("");
        }
    };

    return (
        <IntroAnimation loadingText="Loading Search Results...">
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

                    <div className={styles.aiButtons}>
                        <button
                            onClick={improveSearchQuery}
                            disabled={!query.trim() || isImprovingQuery}
                            className={styles.aiButton}
                        >
                            {isImprovingQuery ? "Improving..." : "Improve Search Query"}
                        </button>
                        <button
                            onClick={filterSearchResults}
                            disabled={searchResults.length === 0 || isFilteringResults}
                            className={styles.aiButton}
                        >
                            {isFilteringResults ? "Filtering..." : "Filter Results"}
                        </button>
                    </div>

                    {improvedQuery && (
                        <div className={styles.improvedQuery}>
                            <p>Improved query: {improvedQuery}</p>
                            <button
                                onClick={handleUseImprovedQuery}
                                className={styles.useImprovedButton}
                            >
                                Use Improved Query
                            </button>
                        </div>
                    )}

                    {error && <p className={styles.error}>{error}</p>}
                </div>

                <div className={styles.resultsContainer}>
                    {(filteredResults.length > 0 ? filteredResults : searchResults).map((result, index) => (
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
        </IntroAnimation>
    );
}