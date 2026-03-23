import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FilterCategory {
  label: string;
  key: string;
  filterKey?: string; // Optional: the actual filter key to use (defaults to key)
  options: string[];
}

interface ExerciseFilterPanelProps {
  categories: FilterCategory[];
  selectedFilters: Record<string, string[]>;
  onFilterChange: (category: string, options: string[]) => void;
  onClearFilters: () => void;
  onApply: () => void;
}

export default function ExerciseFilterPanel({
  categories,
  selectedFilters,
  onFilterChange,
  onClearFilters,
  onApply,
}: ExerciseFilterPanelProps) {
  const handleOptionChange = (filterKey: string, value: string) => {
    const current = selectedFilters[filterKey] || [];
    const updated = current.includes(value)
      ? current.filter(o => o !== value)
      : [...current, value];
    onFilterChange(filterKey, updated);
  };

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-card border-l border-border shadow-lg overflow-y-auto z-50">
      <div className="p-6 border-b sticky top-0 bg-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Exercise Filters</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-xs text-primary hover:text-primary/80"
            data-testid="button-reset-filters"
          >
            Reset All
          </Button>
        </div>
      </div>

      <div className="p-6">
        <Accordion type="single" collapsible className="w-full space-y-2">
          {categories.map((category) => {
            const filterKey = category.filterKey || category.key;
            const allSelected = selectedFilters[filterKey] || [];
            // Count only options that belong to this category
            const selectedCount = category.options.filter(opt => allSelected.includes(opt)).length;

            return (
              <AccordionItem key={category.key} value={category.key} className="border border-border rounded-md">
                <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 text-foreground">
                  <div className="flex items-center justify-between w-full text-left">
                    <span className="font-medium text-sm">{category.label}</span>
                    {selectedCount > 0 && (
                      <span className="text-xs text-muted-foreground ml-2 bg-muted px-2 py-1 rounded">
                        {selectedCount} selected
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 py-3 bg-muted/30 border-t border-border">
                  <div className="space-y-3">
                    {category.options.map((option) => (
                      <label
                        key={option}
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        data-testid={`checkbox-${category.key}-${option}`}
                      >
                        <Checkbox
                          checked={allSelected.includes(option)}
                          onCheckedChange={() => handleOptionChange(filterKey, option)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm text-foreground">{option}</span>
                      </label>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      <div className="p-6 border-t border-border sticky bottom-0 bg-card space-y-3">
        <Button
          onClick={onApply}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          data-testid="button-apply-filters"
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
