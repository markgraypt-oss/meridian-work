import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldAlert, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";

type ValidationOutcome = "valid" | "repaired" | "invalid" | "no_schema" | "error" | "timeout";

interface Props {
  safetyFlags?: string[] | null;
  validationOutcome?: ValidationOutcome | null;
  className?: string;
}

const SAFETY_FLAG_LABELS: Record<string, { label: string; description: string }> = {
  medical_diagnosis: {
    label: "Medical claim removed",
    description: "Wording that diagnosed a medical condition was stripped. Consult a healthcare professional for medical guidance.",
  },
  medical_prescription: {
    label: "Prescription wording removed",
    description: "Phrases suggesting a prescription were removed from the draft.",
  },
  medical_cure_claim: {
    label: "Cure claim removed",
    description: "Language claiming to cure or treat a medical condition was filtered out.",
  },
  stop_medication: {
    label: "Medication advice removed",
    description: "Advice to stop or skip medication was filtered. Defer to the user's clinician.",
  },
  extreme_diet: {
    label: "Extreme diet advice removed",
    description: "Suggestions of extreme caloric restriction or fasting were stripped from the draft.",
  },
  self_harm: {
    label: "Sensitive content removed",
    description: "Self-harm related language was filtered out of the draft.",
  },
};

const VALIDATION_META: Partial<Record<ValidationOutcome, { label: string; description: string; tone: "ok" | "warn" | "info"; icon: typeof CheckCircle2 }>> = {
  repaired: {
    label: "Repaired after retry",
    description: "The first AI response was not valid; a single retry produced a usable draft. Review carefully before saving.",
    tone: "warn",
    icon: RefreshCw,
  },
  invalid: {
    label: "Validation failed",
    description: "The AI response did not match the expected structure. Some parts of the draft may be missing or incomplete.",
    tone: "warn",
    icon: AlertTriangle,
  },
  error: {
    label: "Generation error",
    description: "The AI call returned an error during generation.",
    tone: "warn",
    icon: AlertTriangle,
  },
  timeout: {
    label: "Generation timed out",
    description: "The AI call exceeded the time limit before completing.",
    tone: "warn",
    icon: AlertTriangle,
  },
  valid: {
    label: "Validated",
    description: "The AI response matched the expected structure on the first attempt.",
    tone: "ok",
    icon: CheckCircle2,
  },
};

export default function AiSafetyFlags({ safetyFlags, validationOutcome, className }: Props) {
  const flags = (safetyFlags || []).filter(Boolean);
  const validation = validationOutcome && VALIDATION_META[validationOutcome];

  if (!flags.length && !validation) return null;
  if (!flags.length && validationOutcome === "valid") return null;
  if (!flags.length && validationOutcome === "no_schema") return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`} data-testid="ai-safety-flags">
        {validation && validationOutcome !== "valid" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant={validation.tone === "ok" ? "secondary" : "outline"}
                className={
                  validation.tone === "warn"
                    ? "border-amber-500/60 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 cursor-help"
                    : "cursor-help"
                }
                data-testid={`badge-validation-${validationOutcome}`}
              >
                <validation.icon className="h-3 w-3 mr-1" />
                {validation.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{validation.description}</TooltipContent>
          </Tooltip>
        )}
        {flags.map((flag) => {
          const meta = SAFETY_FLAG_LABELS[flag] || {
            label: `Safety filter: ${flag.replace(/_/g, " ")}`,
            description: "The safety filter modified part of the draft.",
          };
          return (
            <Tooltip key={flag}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="border-amber-500/60 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 cursor-help"
                  data-testid={`badge-safety-${flag}`}
                >
                  <ShieldAlert className="h-3 w-3 mr-1" />
                  {meta.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{meta.description}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
