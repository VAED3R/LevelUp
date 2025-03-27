import cloudinary from "@/lib/cloudinary";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  const { id } = params;

  try {
    const asset = await cloudinary.api.resource(id, {
      resource_type: "raw",
      context: true,
    });

    if (!asset) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const downloadUrl = asset.secure_url;

    return NextResponse.redirect(downloadUrl);  // Redirect to file
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
  }
}
