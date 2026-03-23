import { useAuth } from "@/hooks/useAuth";

export default function AdminDebug() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="p-8 bg-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Admin Debug Page</h1>
      
      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-bold">Authentication State:</h2>
        <p>Loading: {isLoading ? 'true' : 'false'}</p>
        <p>Authenticated: {isAuthenticated ? 'true' : 'false'}</p>
        <p>User: {user ? JSON.stringify(user) : 'null'}</p>
      </div>

      {isLoading && (
        <div className="bg-[#0cc9a9]/10 p-4 rounded mb-4">
          <p>Currently loading authentication state...</p>
        </div>
      )}

      {!isLoading && !isAuthenticated && (
        <div className="bg-red-100 p-4 rounded mb-4">
          <p>Not authenticated. Please log in.</p>
          <button 
            onClick={() => window.location.href = "/api/login"}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Log In
          </button>
        </div>
      )}

      {!isLoading && isAuthenticated && (
        <div className="bg-green-100 p-4 rounded mb-4">
          <p>Successfully authenticated!</p>
          <p>Welcome to the admin panel.</p>
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-bold mb-4">Test API Calls:</h2>
        <button 
          onClick={async () => {
            try {
              const response = await fetch('/api/programs');
              const data = await response.json();
              console.log('Programmes:', data);
              alert(`Found ${data.length} programs`);
            } catch (error) {
              console.error('Error:', error);
              alert('Error loading programs');
            }
          }}
          className="px-4 py-2 bg-green-500 text-white rounded mr-2"
        >
          Test Programmes API
        </button>
        
        <button 
          onClick={async () => {
            try {
              const response = await fetch('/api/videos');
              const data = await response.json();
              console.log('Videos:', data);
              alert(`Found ${data.length} videos`);
            } catch (error) {
              console.error('Error:', error);
              alert('Error loading videos');
            }
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded mr-2"
        >
          Test Videos API
        </button>

        <button 
          onClick={async () => {
            try {
              const response = await fetch('/api/recipes');
              const data = await response.json();
              console.log('Recipes:', data);
              alert(`Found ${data.length} recipes`);
            } catch (error) {
              console.error('Error:', error);
              alert('Error loading recipes');
            }
          }}
          className="px-4 py-2 bg-purple-500 text-white rounded"
        >
          Test Recipes API
        </button>
      </div>
    </div>
  );
}