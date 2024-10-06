import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SheetsDropdown = ({ onSheetSelect }) => {
  const [sheets, setSheets] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSheets = async () => {
      try {
        // Replace this with your actual API call
        const response = await fetch('/api/sheets');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSheets(data);
      } catch (error) {
        console.error('Error fetching sheets:', error);
        setError('Failed to load sheets. Please try again later.');
        // Fallback data for development
        setSheets([
          { id: '1', name: 'Sheet 1' },
          { id: '2', name: 'Sheet 2' },
          { id: '3', name: 'Sheet 3' },
        ]);
      }
    };

    fetchSheets();
  }, []);

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <Select onValueChange={onSheetSelect}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select a sheet" />
      </SelectTrigger>
      <SelectContent>
        {sheets.map((sheet) => (
          <SelectItem key={sheet.id} value={sheet.id}>
            {sheet.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default SheetsDropdown;