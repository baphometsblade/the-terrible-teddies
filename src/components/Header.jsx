import React from 'react';
import { Button } from "@/components/ui/button";

export const Header = () => {
  return (
    <header className="bg-purple-900 bg-opacity-80 text-white p-4 shadow-md relative z-20">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">Terrible Teddies</h1>
        <nav>
          <Button variant="outline" className="text-white border-white hover:bg-purple-700">
            Login
          </Button>
        </nav>
      </div>
    </header>
  );
};
