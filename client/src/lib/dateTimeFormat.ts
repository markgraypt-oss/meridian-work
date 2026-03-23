import { format, parse } from "date-fns";

type DateFormatType = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
type TimeFormatType = "12h" | "24h";

const DATE_FORMAT_MAP: Record<DateFormatType, string> = {
  "DD/MM/YYYY": "dd/MM/yyyy",
  "MM/DD/YYYY": "MM/dd/yyyy",
  "YYYY-MM-DD": "yyyy-MM-dd",
};

const DATE_FORMAT_SHORT_MAP: Record<DateFormatType, string> = {
  "DD/MM/YYYY": "dd/MM",
  "MM/DD/YYYY": "MM/dd",
  "YYYY-MM-DD": "MM-dd",
};

const DATE_FORMAT_WITH_DAY_MAP: Record<DateFormatType, string> = {
  "DD/MM/YYYY": "EEE, dd MMM yyyy",
  "MM/DD/YYYY": "EEE, MMM dd, yyyy",
  "YYYY-MM-DD": "EEE, yyyy-MM-dd",
};

const DATE_FORMAT_MONTH_DAY_MAP: Record<DateFormatType, string> = {
  "DD/MM/YYYY": "dd MMM",
  "MM/DD/YYYY": "MMM dd",
  "YYYY-MM-DD": "MM-dd",
};

export function formatDate(
  date: Date | string,
  dateFormat: DateFormatType,
  variant: "full" | "short" | "withDay" | "monthDay" = "full"
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return "";
  }

  let formatString: string;
  switch (variant) {
    case "short":
      formatString = DATE_FORMAT_SHORT_MAP[dateFormat];
      break;
    case "withDay":
      formatString = DATE_FORMAT_WITH_DAY_MAP[dateFormat];
      break;
    case "monthDay":
      formatString = DATE_FORMAT_MONTH_DAY_MAP[dateFormat];
      break;
    default:
      formatString = DATE_FORMAT_MAP[dateFormat];
  }

  return format(dateObj, formatString);
}

export function formatTime(
  date: Date | string,
  timeFormat: TimeFormatType
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return "";
  }

  if (timeFormat === "12h") {
    return format(dateObj, "h:mm a");
  }
  return format(dateObj, "HH:mm");
}

export function formatDateTime(
  date: Date | string,
  dateFormat: DateFormatType,
  timeFormat: TimeFormatType
): string {
  const dateStr = formatDate(date, dateFormat);
  const timeStr = formatTime(date, timeFormat);
  return `${dateStr} ${timeStr}`;
}

export function formatTimeOnly(
  timeString: string,
  timeFormat: TimeFormatType
): string {
  const [hours, minutes] = timeString.split(":").map(Number);
  
  if (timeFormat === "12h") {
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
  }
  
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function getDateFormatPlaceholder(dateFormat: DateFormatType): string {
  return dateFormat.toLowerCase();
}
