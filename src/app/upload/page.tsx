import Link from "next/link";
import UploadDropzone from "@/components/UploadDropzone";

export default function UploadPage() {
  return (
    <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Upload</h1>
        <Link href="/" className="text-sm text-blue-600">
          Back to library
        </Link>
      </div>
      <UploadDropzone />
    </div>
  );
}
