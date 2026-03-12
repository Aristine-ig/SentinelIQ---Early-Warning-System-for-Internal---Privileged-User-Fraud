import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/lib/store";
import { CustomerProvider } from "@/lib/customerStore";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import CustomerLogin from "./pages/CustomerLogin";
import BankingDashboard from "./pages/BankingDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <CustomerProvider>
          <Toaster />
          <Sonner position="top-right" richColors />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/customer" element={<CustomerLogin />} />
              <Route path="/banking" element={<BankingDashboardGuard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CustomerProvider>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomer } from '@/lib/customerStore';

function BankingDashboardGuard() {
  const { state } = useCustomer();
  const navigate = useNavigate();
  useEffect(() => {
    if (!state.currentCustomer && !state.loading) navigate('/customer');
  }, [state.currentCustomer, state.loading, navigate]);
  if (!state.currentCustomer) return null;
  return <BankingDashboard />;
}

export default App;
