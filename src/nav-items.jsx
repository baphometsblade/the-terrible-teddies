import React from 'react';
import { Home, LogIn } from "lucide-react";

const Index = React.lazy(() => import("./pages/Index").then(module => ({ default: module.default })));
const SupabaseAuthUI = React.lazy(() => import("./integrations/supabase/auth").then(module => ({ default: module.SupabaseAuthUI })));

export const navItems = [
  {
    title: "Home",
    to: "/",
    icon: <Home className="h-4 w-4" />,
    component: Index,
  },
  {
    title: "Auth",
    to: "/auth",
    icon: <LogIn className="h-4 w-4" />,
    component: SupabaseAuthUI,
  },
];