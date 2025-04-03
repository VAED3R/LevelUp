import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        console.log('Received request body:', body);
        
        if (!body || !body.results) {
            return NextResponse.json(
                { error: 'Request body must contain a results array' },
                { status: 400 }
            );
        }

        const { results } = body;
        
        if (!Array.isArray(results)) {
            return NextResponse.json(
                { error: 'Results must be an array' },
                { status: 400 }
            );
        }

        // More lenient validation - only check if the object exists
        const validResults = results.filter(result => 
            result && typeof result === 'object'
        );

        if (validResults.length === 0) {
            return NextResponse.json(
                { error: 'No valid results to filter' },
                { status: 400 }
            );
        }

        console.log('Valid results to filter:', validResults);
        const filteredResults = await filterResultsWithAI(validResults);
        console.log('Filtered results:', filteredResults);

        return NextResponse.json({ filteredResults });
    } catch (error) {
        console.error('Error filtering results:', error);
        return NextResponse.json(
            { error: 'Failed to filter results', details: error.message },
            { status: 500 }
        );
    }
}

async function filterResultsWithAI(results) {
    try {
        // Score each result based on multiple factors
        const scoredResults = results.map(result => {
            let score = 0;
            
            // 1. Content Quality (40% weight)
            const title = result.title || '';
            const snippet = result.snippet || '';
            
            // Title quality
            if (title.length > 5) { // More lenient title length
                score += 2;
                if (title.length > 20 && title.length < 120) {
                    score += 2; // Bonus for good length
                }
            }
            
            // Snippet quality
            if (snippet.length > 30) { // More lenient snippet length
                score += 2;
                if (snippet.length > 100) {
                    score += 2; // Bonus for detailed snippets
                }
            }
            
            // 2. Source Quality (30% weight)
            const url = (result.url || '').toLowerCase();
            
            // Educational and government sources
            if (url.includes('.edu') || url.includes('.gov')) {
                score += 4; // Higher weight for academic/government sources
            } else if (url.includes('.org')) {
                score += 2;
            }
            
            // Reputable domains
            const reputableDomains = [
                'wikipedia.org',
                'stackoverflow.com',
                'github.com',
                'medium.com',
                'dev.to',
                'mozilla.org',
                'w3.org',
                'microsoft.com',
                'apple.com',
                'google.com'
            ];
            
            if (reputableDomains.some(domain => url.includes(domain))) {
                score += 3;
            }
            
            // 3. Content Type (20% weight)
            if (url.includes('/blog/') || url.includes('/article/') || url.includes('/docs/')) {
                score += 2; // Prefer blog posts, articles, and documentation
            }
            
            // 4. Freshness (10% weight)
            if (result.publishedDate) {
                const publishedDate = new Date(result.publishedDate);
                const now = new Date();
                const monthsOld = (now - publishedDate) / (1000 * 60 * 60 * 24 * 30);
                
                if (monthsOld < 12) { // Prefer content less than a year old
                    score += 2;
                }
            }
            
            // 5. Additional Quality Indicators
            if (snippet.includes('tutorial') || snippet.includes('guide') || 
                snippet.includes('how to') || snippet.includes('example')) {
                score += 2; // Bonus for tutorial/guide content
            }
            
            return {
                ...result,
                score
            };
        });

        // Sort by score and return top results
        const sortedResults = scoredResults.sort((a, b) => b.score - a.score);
        
        // Return all results with a score above threshold, or top 5 if all scores are low
        const threshold = 5; // Minimum score to be considered "good"
        const goodResults = sortedResults.filter(result => result.score >= threshold);
        
        const finalResults = goodResults.length > 0 
            ? goodResults.slice(0, 5) 
            : sortedResults.slice(0, 5);
            
        return finalResults.map(({ score, ...result }) => result); // Remove score from final results
    } catch (error) {
        console.error('Error in filterResultsWithAI:', error);
        // Return original results if filtering fails
        return results.slice(0, 5);
    }
} 