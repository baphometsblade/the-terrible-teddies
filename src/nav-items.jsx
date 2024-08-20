import React, { lazy } from 'react';
import { Home, LogIn } from "lucide-react";

const Index = lazy(() => import("./pages/Index.jsx"));
const SupabaseAuthUI = lazy(() => import("./integrations/supabase/auth").then(module => ({ default: module.SupabaseAuthUI })));

export const navItems = [
  {
    title: "Home",
    to: "/",
    icon: <Home className="h-4 w-4" />,
    page: Index,
  },
  {
    title: "Auth",
    to: "/auth",
    icon: <LogIn className="h-4 w-4" />,
    page: SupabaseAuthUI,
  },
];