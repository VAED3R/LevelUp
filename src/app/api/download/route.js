import cloudinary from "@/lib/cloudinary";
import { NextResponse } from "next/server";

export async function GET(req) {
  const searchParams = new URL(req.url).searchParams;

  const title = searchParams.get("title");
  const subject = searchParams.get("subject");
  const description = searchParams.get("description");
  const className = searchParams.get("class");

  let expression = [];

  if (title) expression.push(`context.title:${title}`);
  if (subject) expression.push(`context.subject:${subject}`);
  if (description) expression.push(`context.description:${description}`);
  if (className) expression.push(`context.class:${className}`);

  if (expression.length === 0) {
    return NextResponse.json({ error: "No filters provided" }, { status: 400 });
  }

  try {
    const result = await cloudinary.search
      .expression(expression.join(" AND "))
      .max_results(20)
      .execute();

    return NextResponse.json(result.resources, { status: 200 });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json({ error: "Failed to retrieve notes" }, { status: 500 });
  }
}
