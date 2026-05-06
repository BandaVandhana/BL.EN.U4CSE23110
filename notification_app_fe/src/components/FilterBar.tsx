"use client";

import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Box,
} from "@mui/material";
import { log } from "@/utils/logger";

interface Props {
  selected: string;
  onChange: (value: string) => void;
}

const TYPES = ["All", "Event", "Result", "Placement"];

export default function FilterBar({ selected, onChange }: Props) {
  const handleChange = (e: SelectChangeEvent) => {
    const val = e.target.value;
    log("frontend", "info", "ui", `Filter changed to: ${val}`);
    onChange(val);
  };

  return (
    <Box sx={{ mb: 3, minWidth: 200 }}>
      <FormControl fullWidth size="small">
        <InputLabel>Notification Type</InputLabel>
        <Select value={selected} label="Notification Type" onChange={handleChange}>
          {TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
