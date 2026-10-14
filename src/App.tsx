
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Ventilation from "./pages/Ventilation";
import Firefighting from "./pages/Firefighting";
import Reference from "./pages/Reference";
import About from "./pages/About";
import RouteMap from "./pages/RouteMap";
import NotFound from "./pages/NotFound";
import UpdateBanner from "@/components/update-banner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <UpdateBanner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/ventilation" element={<Ventilation />} />
            <Route path="/firefighting" element={<Firefighting />} />
            <Route path="/reference" element={<Reference />} />
            <Route path="/about" element={<About />} />
            <Route path="/route-map" element={<RouteMap />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
  </QueryClientProvider>
);

export default App;