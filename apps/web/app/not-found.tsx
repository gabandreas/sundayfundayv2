import { HttpErrorState } from "@/components/primitives/HttpErrorState";

export default function NotFoundPage() {
  return <HttpErrorState statusCode={404} />;
}
