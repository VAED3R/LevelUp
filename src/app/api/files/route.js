import cloudinary from "@/lib/cloudinary";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("📁 Fetching files from Cloudinary...");

    // Fetch files from the "notes" folder
    const { resources } = await cloudinary.search
      .expression("folder:notes")
      .sort_by("created_at", "desc")
      .max_results(50)
      .execute();

    console.log(`✅ Retrieved ${resources.length} files`);

    if (!resources || resources.length === 0) {
      console.log("⚠️ No files found");
      return NextResponse.json([], { status: 200 });
    }

    // Fetch full metadata for each file
    const files = await Promise.all(
      resources.map(async (file) => {
        try {
          const asset = await cloudinary.api.resource(file.public_id, {
            context: true, // Retrieve metadata
          });

          return {
            id: file.public_id,
            url: asset.secure_url,
            title: asset.context?.custom?.title || "No Title",
            subject: asset.context?.custom?.subject || "No Subject",
            description: asset.context?.custom?.description || "No Description",
            className: asset.context?.custom?.class || "Unknown Class",
            uploadedAt: file.created_at,
          };
        } catch (metadataError) {
          console.error(`❌ Failed to fetch metadata for ${file.public_id}`, metadataError);
          return null; // Skip file if metadata fetch fails
        }
      })
    );

    // Filter out any null values (files with failed metadata)
    const validFiles = files.filter(file => file !== null);

    return NextResponse.json(validFiles, { status: 200 });

  } catch (error) {
    console.error("🔥 API Error:", error);

    // Cloudinary-specific error handling
    if (error.http_code === 401) {
      return NextResponse.json({ error: "Unauthorized. Check Cloudinary credentials." }, { status: 401 });
    }

    if (error.http_code === 429) {
      return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
    }

    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
  }
}
