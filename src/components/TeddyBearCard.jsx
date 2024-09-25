import React from 'react';
import { Card, CardContent, Typography, Button } from '@mui/material';

export function TeddyBearCard({ bear, onSelect }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5">{bear.name}</Typography>
        <Typography>Strength: {bear.strength}</Typography>
        <Typography>Agility: {bear.agility}</Typography>
        <Typography>Intelligence: {bear.intelligence}</Typography>
        <Button onClick={() => onSelect(bear)}>Select</Button>
      </CardContent>
    </Card>
  );
}