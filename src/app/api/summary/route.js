import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fileUrl } = req.body;

  if (!fileUrl) {
    return res.status(400).json({ error: "File URL is required." });
  }

  try {
    const response = await axios.post(
      "https://api.deepseek.com/v1/summarize",
      {
        url: fileUrl,
        max_tokens: 500, // Adjust summary length
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,  // Using API key from .env.local
        },
      }
    );

    const summary = response.data.summary;
    res.status(200).json({ summary });

  } catch (error) {
    console.error("Deepseek API error:", error);
    res.status(500).json({ error: "Failed to generate summary." });
  }
}
