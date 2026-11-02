import { redirect } from "next/navigation";

// unknown URLs go back to "/", as the old router's catch-all did
export default function NotFound() {
  redirect("/");
}
