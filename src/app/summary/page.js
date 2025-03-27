"use client";

import { useEffect, useState } from "react";
import { getDocument } from "pdfjs-dist";
import Navbar from "@/components/studentNavbar";

export default function Summary() {
  const [text, setText] = useState("Loading...");

  const extractTextFromPDF = async (url) => {
    try {
      // Fetch the PDF document
      const loadingTask = getDocument(url);
      const pdf = await loadingTask.promise;

      let fullText = "";
      // Loop through all pages of the PDF
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        // Extract text from the content
        const strings = content.items.map((item) => item.str).join(" ");
        fullText += `${strings}\n\n`;
      }

      // Set the extracted text to the state
      setText(fullText || "No text extracted from the PDF.");
    } catch (error) {
      console.error("Error extracting PDF text:", error);
      setText("Failed to load or extract text from the PDF.");
    }
  };

  // Extract the text when the component mounts
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pdfUrl = urlParams.get("url");

    if (pdfUrl) {
      extractTextFromPDF(pdfUrl);
    } else {
      setText("No PDF URL provided.");
    }
  }, []);

  return (
    <div className="p-6">
      <Navbar />
      <h1 className="text-2xl font-bold mb-4">PDF Summary</h1>
      <div className="bg-gray-100 p-4 rounded-md shadow-md">
        <pre className="whitespace-pre-wrap">{text}</pre>
      </div>
    </div>
  );
}
