
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ExplosionTriangle from "./pages/ExplosionTriangle";
import EmergencyScheme from "./pages/EmergencyScheme";
import Admin from "./pages/Admin";
import FireLoad from "./pages/FireLoad";
import Ventilation from "./pages/Ventilation";
import Firefighting from "./pages/Firefighting";
import Reference from "./pages/Reference";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import { LicenseProvider } from "@/context/license-context";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LicenseProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/explosion-triangle" element={<ExplosionTriangle />} />
            <Route path="/emergency-scheme" element={<EmergencyScheme />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/fire-load" element={<FireLoad />} />
            <Route path="/ventilation" element={<Ventilation />} />
            <Route path="/firefighting" element={<Firefighting />} />
            <Route path="/reference" element={<Reference />} />
            <Route path="/about" element={<About />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LicenseProvider>
  </QueryClientProvider>
);

export default App;