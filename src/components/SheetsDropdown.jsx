import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SheetsDropdown = ({ onSheetSelect }) => {
  const [sheets, setSheets] = useState([]);

  useEffect(() => {
    // Fetch sheets data from your API or database
    const fetchSheets = async () => {
      try {
        // Replace this with your actual API call
        const response = await fetch('/api/sheets');
        const data = await response.json();
        setSheets(data);
      } catch (error) {
        console.error('Error fetching sheets:', error);
      }
    };

    fetchSheets();
  }, []);

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