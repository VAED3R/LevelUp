import { NextResponse } from "next/server";

export async function POST(req) {
    const { subject } = await req.json();
    
    console.log("=== GET-TOPICS API DEBUG ===");
    console.log("Received subject:", subject);
    console.log("Subject type:", typeof subject);
    
    // Adjust the URL/port to match your Python backend
    const ragResponse = await fetch("http://0.0.0.0:8000/get-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject }),
    });

    console.log("RAG response status:", ragResponse.status);
    console.log("RAG response ok:", ragResponse.ok);

    if (!ragResponse.ok) {
        console.log("RAG system error - status:", ragResponse.status);
        return NextResponse.json({ topics: [], error: "RAG system error" }, { status: 500 });
    }

    const data = await ragResponse.json();
    console.log("RAG response data:", data);
    console.log("=== END DEBUG ===");
    
    return NextResponse.json(data);
} 