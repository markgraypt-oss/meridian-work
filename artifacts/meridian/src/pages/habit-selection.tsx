import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronRight, ChevronDown, ChevronUp, Plus, MoreVertical } from "lucide-react";
import TopHeader from "@/components/TopHeader";
import type { HabitTemplate, UserHabitLibraryEntry } from "@shared/schema";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface GroupedTemplates {
  [category: string]: HabitTemplate[];
}

export default function HabitSelection() {
  const [, setLocation] = useLocation();
  const [menuEntry, setMenuEntry] = useState<UserHabitLibraryEntry | null>(null);
  const [openCategories, setOpenCategories] = useState<string[]>([
    "CUSTOM",
    "MOVEMENT",
    "NUTRITION",
    "NUTRITION PORTION GUIDES",
    "SLEEP",
    "MINDSET",
    "ENERGY AND PERFORMANCE",
    "DAILY MAINTENANCE",
  ]);

  const { data: templates, isLoading } = useQuery<HabitTemplate[]>({
    queryKey: ['/api/habit-templates'],
  });

  const { data: libraryEntries = [] } = useQuery<UserHabitLibraryEntry[]>({
    queryKey: ['/api/user-habit-library'],
  });

  const deleteLibraryEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/user-habit-library/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-habit-library'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const groupedTemplates: GroupedTemplates = templates?.reduce((acc, template) => {
    if (template.category === 'CUSTOM') return acc;
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as GroupedTemplates) || {};

  const categoryOrder = [
    "MOVEMENT",
    "NUTRITION",
    "NUTRITION PORTION GUIDES",
    "SLEEP",
    "MINDSET",
    "ENERGY AND PERFORMANCE",
    "DAILY MAINTENANCE",
  ];

  const knownCategories = new Set(categoryOrder);
  const extraCategories = Object.keys(groupedTemplates).filter(cat => !knownCategories.has(cat));
  const sortedCategories = [...categoryOrder, ...extraCategories].filter(cat => groupedTemplates[cat]);

  const toggleCategory = (category: string) => {
    setOpenCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleTemplateClick = (template: HabitTemplate) => {
    setLocation(`/habit-detail/${template.id}`);
  };

  const handleCustomHabitClick = () => {
    setLocation('/habit-custom');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopHeader title="Add New Habit" onBack={() => setLocation('/habits')} />

      <div className="px-4 py-4 space-y-2 pt-[72px]">
        {/* Custom Habit Option - Always at top */}
        <button
          onClick={handleCustomHabitClick}
          className="w-full px-4 py-4 flex items-center justify-between bg-card hover:bg-muted/50 rounded-lg border border-border transition-colors"
          data-testid="button-custom-habit"
        >
          <div className="flex items-center gap-3">
            <Plus className="h-5 w-5 text-muted-foreground" />
            <span className="text-foreground font-medium">Custom Habit</span>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* My Habits - saved custom habits */}
        {libraryEntries.length > 0 && (
          <Collapsible
            open={openCategories.includes("MY HABITS")}
            onOpenChange={() => toggleCategory("MY HABITS")}
          >
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">My Habits</span>
                {openCategories.includes("MY HABITS") ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border">
                  {libraryEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center border-b border-border last:border-0"
                    >
                      <button
                        onClick={() => setLocation(`/habit-custom?libraryId=${entry.id}`)}
                        className="flex-1 px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="text-xl">📝</span>
                        <span className="text-foreground">{entry.title}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuEntry(entry);
                        }}
                        className="px-4 py-3 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* Category List */}
        {sortedCategories.map((category) => (
          <Collapsible
            key={category}
            open={openCategories.includes(category)}
            onOpenChange={() => toggleCategory(category)}
          >
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <CollapsibleTrigger 
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors" 
                data-testid={`category-trigger-${category}`}
              >
                <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{category}</span>
                {openCategories.includes(category) ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t border-border">
                  {groupedTemplates[category]?.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateClick(template)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 border-b border-border last:border-0 transition-colors"
                      data-testid={`habit-template-${template.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {template.icon?.startsWith('/') || template.icon?.startsWith('http') ? (
                          <img src={template.icon} alt="" className="w-6 h-6 object-contain" />
                        ) : (
                          <span className="text-xl">{template.icon || '📝'}</span>
                        )}
                        <span className="text-foreground">{template.title}</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>

      {/* 3-dot menu drawer for My Habits entries */}
      <Drawer open={!!menuEntry} onOpenChange={(open) => { if (!open) setMenuEntry(null); }}>
        <DrawerContent className="bg-background border-t border-muted">
          <div className="py-4 px-4">
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6" />
            <div className="space-y-2">
              <button
                className="w-full text-left py-4 px-2 text-foreground text-lg hover:bg-muted/50 rounded-lg transition-colors"
                onClick={() => {
                  const id = menuEntry?.id;
                  setMenuEntry(null);
                  if (id) setLocation(`/habit-custom?libraryId=${id}&mode=edit`);
                }}
              >
                Edit Habit
              </button>
              <button
                className="w-full text-left py-4 px-2 text-destructive text-lg hover:bg-muted/50 rounded-lg transition-colors"
                onClick={() => {
                  const id = menuEntry?.id;
                  setMenuEntry(null);
                  if (id) deleteLibraryEntryMutation.mutate(id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
