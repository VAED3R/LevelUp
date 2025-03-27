import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    console.log("📌 Received request...");

    const { fileUrl } = await req.json();
    console.log("📌 File URL:", fileUrl);

    if (!fileUrl) {
      console.error("❌ Missing file URL");
      return NextResponse.json({ error: "Missing file URL" }, { status: 400 });
    }

    // Fetch the file content
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      console.error(`❌ Failed to fetch file: ${fileResponse.status} - ${fileResponse.statusText}`);
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
    }

    const fileContent = await fileResponse.text();
    console.log("📌 Fetched file content successfully.");

    // Send the content to DeepSeek AI for summarization
    const deepSeekResponse = await fetch("https://api.deepseek.com/summarize", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: fileContent,
        max_length: 300  // Adjust the summary length as needed
      })
    });

    if (!deepSeekResponse.ok) {
      console.error(`❌ DeepSeek API error: ${deepSeekResponse.status} - ${deepSeekResponse.statusText}`);
      return NextResponse.json({ error: "DeepSeek API error" }, { status: 500 });
    }

    const deepSeekData = await deepSeekResponse.json();
    console.log("✅ DeepSeek API response:", deepSeekData);

    return NextResponse.json({ summary: deepSeekData.summary });

  } catch (error) {
    console.error("❌ Server Error:", error);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
