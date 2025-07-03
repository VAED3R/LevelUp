import { NextResponse } from "next/server";

export async function POST(req) {
    const { subject } = await req.json();
    // Adjust the URL/port to match your Python backend
    const ragResponse = await fetch("http://0.0.0.0:8000/get-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject }),
    });

    if (!ragResponse.ok) {
        return NextResponse.json({ topics: [], error: "RAG system error" }, { status: 500 });
    }

    const data = await ragResponse.json();
    return NextResponse.json(data);
} 