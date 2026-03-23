import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";

interface FilterOption {
  label: string;
  value: string;
  options: { label: string; value: string }[];
}

interface FilterSheetProps {
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  filterOptions: FilterOption[];
  onClearFilters?: () => void;
}

export function FilterSheet({ filters, onFilterChange, filterOptions, onClearFilters }: FilterSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-open-filters">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter Options</SheetTitle>
          <SheetDescription>
            Customize your search by selecting filter options below.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {filterOptions.map((filter) => (
            <div key={filter.value}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {filter.label}
              </label>
              <Select
                value={filters[filter.value]}
                onValueChange={(value) => onFilterChange(filter.value, value)}
              >
                <SelectTrigger data-testid={`select-filter-${filter.value}`}>
                  <SelectValue placeholder={`Select ${filter.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {onClearFilters && (
            <Button
              variant="outline"
              className="w-full"
              onClick={onClearFilters}
              data-testid="button-clear-filters"
            >
              Clear All Filters
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
