import { redirect } from "next/navigation";

// Slide je zamijenjen Crashom
export default function SlidePage() {
  redirect("/crash");
}
