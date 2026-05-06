"use client";

import { Box, Button, Typography } from "@mui/material";
import { log } from "@/utils/logger";

interface Props {
  page: number;
  onPageChange: (page: number) => void;
  hasMore: boolean;
}

export default function PaginationControls({ page, onPageChange, hasMore }: Props) {
  const handlePrev = () => {
    if (page > 1) {
      log("frontend", "info", "navigation", `Page changed to ${page - 1}`);
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    log("frontend", "info", "navigation", `Page changed to ${page + 1}`);
    onPageChange(page + 1);
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 2,
        mt: 3,
        mb: 3,
      }}
    >
      <Button
        variant="outlined"
        onClick={handlePrev}
        disabled={page <= 1}
      >
        Previous
      </Button>
      <Typography variant="body2">Page {page}</Typography>
      <Button
        variant="outlined"
        onClick={handleNext}
        disabled={!hasMore}
      >
        Next
      </Button>
    </Box>
  );
}
