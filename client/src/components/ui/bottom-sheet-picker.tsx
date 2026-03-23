import { useState, useRef, useEffect, useCallback } from "react";

interface BottomSheetPickerProps {
  value: string;
  options: { label: string; value: string }[];
  onValueChange: (value: string) => void;
  triggerClassName?: string;
}

export function BottomSheetPicker({ value, options, onValueChange, triggerClassName }: BottomSheetPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>();
  const itemHeight = 48;
  const visibleItems = 3;

  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      const idx = options.findIndex(o => o.value === selectedValue);
      if (idx >= 0) {
        scrollRef.current.scrollTop = idx * itemHeight;
      }
    }
  }, [isOpen]);

  const snapToNearest = useCallback(() => {
    if (!scrollRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;
    const idx = Math.round(scrollTop / itemHeight);
    const clamped = Math.max(0, Math.min(idx, options.length - 1));
    scrollRef.current.scrollTo({ top: clamped * itemHeight, behavior: 'smooth' });
    if (options[clamped]) {
      setSelectedValue(options[clamped].value);
    }
  }, [options, itemHeight]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;
    const idx = Math.round(scrollTop / itemHeight);
    const clamped = Math.max(0, Math.min(idx, options.length - 1));
    if (options[clamped]) {
      setSelectedValue(options[clamped].value);
    }
    clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(snapToNearest, 80);
  }, [options, snapToNearest]);

  const selectOption = (optValue: string) => {
    setSelectedValue(optValue);
    const idx = options.findIndex(o => o.value === optValue);
    if (idx >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ top: idx * itemHeight, behavior: 'smooth' });
    }
  };

  const handleApply = () => {
    onValueChange(selectedValue);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setSelectedValue(value);
    setIsOpen(false);
  };

  const currentLabel = options.find(o => o.value === value)?.label || value;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={triggerClassName || "text-[#0cc9a9] font-normal"}
      >
        {currentLabel}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100]" onClick={handleCancel}>
          <div className="absolute inset-0 bg-black/40" />
          <div 
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <button 
                onClick={handleCancel}
                className="text-[#0cc9a9] text-sm font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleApply}
                className="text-[#0cc9a9] text-sm font-semibold"
              >
                Apply
              </button>
            </div>

            <div className="relative" style={{ height: itemHeight * visibleItems }}>
              <div 
                className="absolute left-4 right-4 border border-border rounded-xl bg-muted/30 pointer-events-none z-10"
                style={{ 
                  top: itemHeight, 
                  height: itemHeight,
                }}
              />
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="h-full overflow-y-auto scrollbar-hide"
                style={{ 
                  scrollBehavior: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  paddingTop: itemHeight,
                  paddingBottom: itemHeight,
                }}
              >
                {options.map((option) => {
                  const isSelected = option.value === selectedValue;
                  return (
                    <div
                      key={option.value}
                      onClick={() => selectOption(option.value)}
                      className={`flex items-center justify-center cursor-pointer transition-all duration-150 ${
                        isSelected 
                          ? 'text-foreground font-medium text-base' 
                          : 'text-muted-foreground/50 text-sm'
                      }`}
                      style={{ height: itemHeight }}
                    >
                      {option.label}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="h-6" />
          </div>
        </div>
      )}
    </>
  );
}
