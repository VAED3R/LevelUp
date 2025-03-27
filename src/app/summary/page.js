"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/studentNavbar";


export default function Summary() {

  return (
    <div>
      <Navbar />
      <div style={{ padding: "20px" }}>
        <h1>File Summary</h1>
        <p><strong>File URL:</strong> {fileUrl || "No file selected"}</p>
        <div style={{ marginTop: "20px" }}>
          <h2>Summary:</h2>
          <p>{summary}</p>
        </div>
      </div>
    </div>
  );
}
