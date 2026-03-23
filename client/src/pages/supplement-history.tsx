import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pill, ChevronRight, Clock, Calendar, Trash2 } from "lucide-react";
import TopHeader from "@/components/TopHeader";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Supplement } from "@shared/schema";

const FREQUENCY_LABELS: Record<number, string> = {
  1: "Daily",
  2: "Every 2 days",
  3: "Every 3 days",
  4: "Every 4 days",
  5: "Every 5 days",
  6: "Every 6 days",
  7: "Once per week",
};

const TIME_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

function SupplementCard({ 
  supplement, 
  onClick, 
  showDelete = false,
  onDelete 
}: { 
  supplement: Supplement; 
  onClick: () => void;
  showDelete?: boolean;
  onDelete?: () => void;
}) {
  return (
    <Card 
      className="bg-card hover:bg-card/80 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Pill className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-foreground truncate">{supplement.name}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground overflow-hidden">
                {supplement.dosage && <span className="truncate flex-shrink">{supplement.dosage}</span>}
                <span className="flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
                  <Clock className="w-3 h-3" />
                  {TIME_LABELS[supplement.timeOfDay] || supplement.timeOfDay}
                </span>
                {supplement.frequency && supplement.frequency > 1 && (
                  <span className="flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
                    <Calendar className="w-3 h-3" />
                    {FREQUENCY_LABELS[supplement.frequency]}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {showDelete && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SupplementHistory() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"current" | "past">("current");

  const { data: currentSupplements = [], isLoading: currentLoading } = useQuery<Supplement[]>({
    queryKey: ['/api/supplements/active'],
    enabled: isAuthenticated,
  });

  const { data: pastSupplements = [], isLoading: pastLoading } = useQuery<Supplement[]>({
    queryKey: ['/api/supplements/inactive'],
    enabled: isAuthenticated,
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/supplements/${id}/permanent`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supplements/inactive'] });
      toast({ title: "Supplement permanently deleted" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", variant: "destructive" });
        window.location.href = "/api/login";
      } else {
        toast({ title: "Failed to delete supplement", variant: "destructive" });
      }
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const isLoading = activeTab === "current" ? currentLoading : pastLoading;
  const supplements = activeTab === "current" ? currentSupplements : pastSupplements;

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader 
        title="Supplement History" 
        onBack={() => navigate('/supplement-stacks')} 
      />
      
      <div className="p-4 space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "current" | "past")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger 
              value="current"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Current
            </TabsTrigger>
            <TabsTrigger 
              value="past"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Past
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="current" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : currentSupplements.length === 0 ? (
              <Card className="bg-card/50 border-dashed">
                <CardContent className="p-6 text-center">
                  <Pill className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No active supplements. Add some from the Supplement Stacks page.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {currentSupplements.map((supp) => (
                  <SupplementCard 
                    key={supp.id} 
                    supplement={supp}
                    onClick={() => navigate(`/supplement-history/${supp.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="past" className="mt-4">
            {pastLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : pastSupplements.length === 0 ? (
              <Card className="bg-card/50 border-dashed">
                <CardContent className="p-6 text-center">
                  <Pill className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No past supplements yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pastSupplements.map((supp) => (
                  <SupplementCard 
                    key={supp.id} 
                    supplement={supp}
                    onClick={() => navigate(`/supplement-history/${supp.id}`)}
                    showDelete={true}
                    onDelete={() => permanentDeleteMutation.mutate(supp.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
