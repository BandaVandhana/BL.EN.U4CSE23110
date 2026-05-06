"use client";

import { Card, CardContent, Typography, Chip, Box } from "@mui/material";
import { Notification } from "@/services/api";
import { isViewed, markAsViewed } from "@/utils/viewed";
import { useState } from "react";

interface Props {
  notification: Notification;
}

function getTypeColor(type: string) {
  switch (type) {
    case "Placement":
      return "error";
    case "Result":
      return "warning";
    case "Event":
      return "info";
    default:
      return "default";
  }
}

export default function NotificationCard({ notification }: Props) {
  const [viewed, setViewed] = useState(isViewed(notification.ID));

  const handleClick = () => {
    markAsViewed(notification.ID);
    setViewed(true);
  };

  return (
    <Card
      onClick={handleClick}
      sx={{
        mb: 2,
        cursor: "pointer",
        opacity: viewed ? 0.7 : 1,
        borderLeft: viewed ? "4px solid #9e9e9e" : "4px solid #1976d2",
        backgroundColor: viewed ? "#fafafa" : "#fff",
        transition: "all 0.2s ease",
        "&:hover": {
          boxShadow: 3,
        },
      }}
    >
      <CardContent>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Chip
            label={notification.Type}
            color={getTypeColor(notification.Type) as any}
            size="small"
          />
          {!viewed && (
            <Chip label="New" size="small" color="primary" variant="outlined" />
          )}
        </Box>
        <Typography variant="body1" sx={{ mb: 1 }}>
          {notification.Message}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {notification.Timestamp}
        </Typography>
      </CardContent>
    </Card>
  );
}
