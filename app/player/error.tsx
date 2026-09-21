"use client";

export default function PlayerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[50vh]">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-sm text-center">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Oops! Something went wrong</h2>
        <p className="text-red-600 mb-4 text-sm">{error.message || "Please try again."}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
