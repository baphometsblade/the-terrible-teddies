import React from "react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function TeddyBearCard({ bear, onSelect }) {
  return (
    <Card className="w-64 bg-white shadow-lg rounded-lg overflow-hidden">
      <CardHeader>
        <h3 className="text-xl font-bold">{bear.name}</h3>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-1">Strength: {bear.strength}</p>
        <p className="text-sm mb-1">Agility: {bear.agility}</p>
        <p className="text-sm mb-1">Intelligence: {bear.intelligence}</p>
      </CardContent>
      <CardFooter>
        <Button onClick={() => onSelect(bear)} className="w-full">
          Select
        </Button>
      </CardFooter>
    </Card>
  );
}
