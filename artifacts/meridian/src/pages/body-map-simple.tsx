import { useLocation } from "wouter";
import SimplifiedBodyMap from "@/components/SimplifiedBodyMap";

export default function BodyMapSimple() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Body Assessment</h1>
          <p className="text-gray-600">
            Click on a body region to get personalized recommendations for discomfort or pain.
          </p>
        </div>
        <SimplifiedBodyMap />
      </div>
    </div>
  );
}