import { useQuery } from "@tanstack/react-query";
import type { User } from "@/../../shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 30 * 1000, // 30 seconds
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
  };
}
