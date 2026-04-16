import { Toaster } from "@/components/ui/sonner";

export function ToastContainer() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: "font-sans",
          title: "text-sm font-medium",
          description: "text-xs text-muted-foreground",
        },
      }}
      closeButton
    />
  );
}
