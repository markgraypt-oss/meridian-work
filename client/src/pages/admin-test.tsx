export default function AdminTest() {
  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Admin Panel Test</h1>
      <p className="text-gray-600 mb-6">This is a test to verify admin routing works correctly.</p>
      
      <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
        <strong>Success!</strong> The admin route is working properly.
      </div>
      
      <div className="bg-blue-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold text-blue-900 mb-2">Admin Features Coming Soon:</h2>
        <ul className="text-blue-800 space-y-1">
          <li>• Content management dashboard</li>
          <li>• User statistics and analytics</li>
          <li>• Platform configuration settings</li>
          <li>• Database management tools</li>
        </ul>
      </div>
    </div>
  );
}