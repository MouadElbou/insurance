import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Selectionner une periode",
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const displayText =
    value?.from && value?.to
      ? `${format(value.from, "dd MMM yyyy", { locale: fr })} - ${format(value.to, "dd MMM yyyy", { locale: fr })}`
      : value?.from
        ? format(value.from, "dd MMM yyyy", { locale: fr })
        : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal h-9",
              !value?.from && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <CalendarDays className="mr-2 h-4 w-4" />
        <span className="truncate">{displayText}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={(range) => {
            onChange({
              from: range?.from,
              to: range?.to,
            });
            if (range?.from && range?.to) {
              setOpen(false);
            }
          }}
          locale={fr}
          numberOfMonths={2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
