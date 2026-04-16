import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/providers/AuthProvider";
import { SocketProvider } from "@/providers/SocketProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { AppRouter } from "@/router";
import { Toaster } from "@/components/ui/sonner";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <QueryProvider>
            <AppRouter />
            <Toaster position="bottom-right" richColors closeButton />
          </QueryProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
