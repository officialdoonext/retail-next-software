export type DateFilterType =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom";

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

export function getDateRange(type: DateFilterType, customStart?: string, customEnd?: string): DateRange {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (type) {
    case "today": {
      return {
        startDate: startOfDay(now),
        endDate: endOfDay(now),
        label: "Today",
      };
    }
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return {
        startDate: startOfDay(y),
        endDate: endOfDay(y),
        label: "Yesterday",
      };
    }
    case "this_week": {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start of week
      const monday = new Date(d.setDate(diff));
      return {
        startDate: startOfDay(monday),
        endDate: endOfDay(now),
        label: "This Week",
      };
    }
    case "last_week": {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const lastMonday = new Date(d.setDate(diff));
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return {
        startDate: startOfDay(lastMonday),
        endDate: endOfDay(lastSunday),
        label: "Last Week",
      };
    }
    case "this_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: startOfDay(firstDay),
        endDate: endOfDay(now),
        label: "This Month",
      };
    }
    case "last_month": {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: startOfDay(firstDayLastMonth),
        endDate: endOfDay(lastDayLastMonth),
        label: "Last Month",
      };
    }
    case "this_year": {
      const firstDayYear = new Date(now.getFullYear(), 0, 1);
      return {
        startDate: startOfDay(firstDayYear),
        endDate: endOfDay(now),
        label: "This Year",
      };
    }
    case "last_year": {
      const firstDayLastYear = new Date(now.getFullYear() - 1, 0, 1);
      const lastDayLastYear = new Date(now.getFullYear() - 1, 11, 31);
      return {
        startDate: startOfDay(firstDayLastYear),
        endDate: endOfDay(lastDayLastYear),
        label: "Last Year",
      };
    }
    case "custom": {
      const start = customStart ? startOfDay(new Date(customStart)) : startOfDay(now);
      const end = customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now);
      return {
        startDate: start,
        endDate: end,
        label: "Custom Date",
      };
    }
    default:
      return {
        startDate: startOfDay(now),
        endDate: endOfDay(now),
        label: "Today",
      };
  }
}

export function isDateInRange(dateInput: string | number | Date, range: DateRange): boolean {
  const d = new Date(dateInput);
  const time = d.getTime();
  return time >= range.startDate.getTime() && time <= range.endDate.getTime();
}
