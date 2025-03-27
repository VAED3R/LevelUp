import cloudinary from "@/lib/cloudinary";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Fetch all notes from Cloudinary with context metadata
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: "notes/", // Only fetch from the "notes" folder
      context: true,    // Include context metadata
      max_results: 500   // Adjust as needed
    });

    // Extract unique subjects
    const subjects = new Set();
    result.resources.forEach((file) => {
      if (file.context && file.context.custom.subject) {
        subjects.add(file.context.custom.subject);
      }
    });

    // Convert Set to an array
    const uniqueSubjects = Array.from(subjects);

    return NextResponse.json({ subjects: uniqueSubjects }, { status: 200 });

  } catch (error) {
    console.error("Failed to fetch subjects:", error);
    return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
  }
}
