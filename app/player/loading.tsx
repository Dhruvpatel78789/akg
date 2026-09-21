export default function PlayerLoading() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {/* Welcome banner skeleton */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="h-6 w-40 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-64 bg-gray-200 rounded" />
      </div>
      {/* Action cards skeleton */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-4 shadow-sm">
            <div className="h-10 w-10 bg-gray-200 rounded-full mb-2" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      {/* Content skeleton */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="h-5 w-28 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
