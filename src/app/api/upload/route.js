import cloudinary from "@/lib/cloudinary";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    // Validate Cloudinary configuration
    if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 
        !process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || 
        !process.env.CLOUDINARY_API_SECRET) {
      console.error("Cloudinary configuration is missing");
      return NextResponse.json({ 
        error: "Server configuration error. Please contact administrator." 
      }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    // Validate file
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    const title = formData.get("title");
    const subject = formData.get("subject");
    const description = formData.get("description");
    const className = formData.get("class");

    // Validate required fields
    if (!title || !subject || !description || !className) {
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
          resource_type: "auto",
          access_mode: "public",
          context: contextString,
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
      context: true,
    });

    return NextResponse.json({
      url: result.secure_url,
      context: asset.context?.custom || {},
    }, { status: 200 });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to upload file. Please try again." 
    }, { status: 500 });
  }
}
