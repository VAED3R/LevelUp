import cloudinary from "@/lib/cloudinary";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    const title = formData.get("title");
    const subject = formData.get("subject");
    const description = formData.get("description");
    const className = formData.get("class");

    if (!file || !title || !subject || !description || !className) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Convert the file to a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Prepare metadata context
    const contextString = `title=${title}|subject=${subject}|description=${description}|class=${className}`;

    // Upload file to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "notes",
          resource_type: "auto",   // Ensure auto type detection
          access_mode: "public",
          context: contextString,  // Add metadata
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      uploadStream.end(buffer);
    });

    // Fetch the uploaded asset again to get the `context`
    const asset = await cloudinary.api.resource(result.public_id, {
      context: true,  // Ensure context is returned
    });

    return NextResponse.json({
      url: result.secure_url,
      context: asset.context?.custom || {},  // Retrieve metadata
    }, { status: 200 });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
