// src/app/api/validate-topic/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
    const { topic } = await req.json();

    // Adjust the URL/port to match your Python backend
    const ragResponse = await fetch("http://0.0.0.0:8000/validate-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
    });

    if (!ragResponse.ok) {
        return NextResponse.json({ valid: false, error: "RAG system error" }, { status: 500 });
    }

    const data = await ragResponse.json();
    return NextResponse.json(data);
}