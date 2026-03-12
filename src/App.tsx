import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Alerts from "./pages/Alerts";
import AlertDetail from "./pages/AlertDetail";
import UserProfiles from "./pages/UserProfiles";
import UserDetail from "./pages/UserDetail";
import ActivityLog from "./pages/ActivityLog";
import Cases from "./pages/Cases";
import CaseDetail from "./pages/CaseDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen bg-[hsl(222,30%,7%)]">
    <Sidebar />
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {children}
    </main>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/alerts" element={<AppLayout><Alerts /></AppLayout>} />
          <Route path="/alerts/:id" element={<AppLayout><AlertDetail /></AppLayout>} />
          <Route path="/users" element={<AppLayout><UserProfiles /></AppLayout>} />
          <Route path="/users/:id" element={<AppLayout><UserDetail /></AppLayout>} />
          <Route path="/activity" element={<AppLayout><ActivityLog /></AppLayout>} />
          <Route path="/cases" element={<AppLayout><Cases /></AppLayout>} />
          <Route path="/cases/:id" element={<AppLayout><CaseDetail /></AppLayout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
