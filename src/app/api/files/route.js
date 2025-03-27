import cloudinary from "@/lib/cloudinary";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Fetch all files from the "notes" folder
    const { resources } = await cloudinary.search
      .expression("folder:notes")
      .sort_by("created_at", "desc")
      .max_results(50)
      .execute();

    // Fetch full metadata for each file individually
    const files = await Promise.all(
      resources.map(async (file) => {
        const asset = await cloudinary.api.resource(file.public_id, {
          context: true,   // Retrieve metadata individually
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
      })
    );

    return NextResponse.json(files, { status: 200 });

  } catch (error) {
    console.error("Failed to fetch files:", error);
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
  }
}
