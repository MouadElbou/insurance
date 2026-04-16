import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return <TooltipProvider delay={300}>{children}</TooltipProvider>;
}
