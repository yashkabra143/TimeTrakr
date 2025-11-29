import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md aspect-square mb-8">
        <DotLottieReact
          src="https://lottie.host/0366e69c-7898-4343-989e-a392bae81aca/LSgc4GetT7.lottie"
          loop
          autoplay
        />
      </div>

      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Page Not Found</h1>
        <p className="text-gray-600">The page you're looking for doesn't exist or has been moved.</p>
        <Link href="/">
          <Button className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
