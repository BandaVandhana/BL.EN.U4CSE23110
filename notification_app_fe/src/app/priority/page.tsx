"use client";

import { useEffect, useState } from "react";
import { Container, Typography, CircularProgress, Box } from "@mui/material";
import { fetchNotifications, Notification } from "@/services/api";
import NotificationCard from "@/components/NotificationCard";
import Navbar from "@/components/Navbar";
import { log } from "@/utils/logger";

const PRIORITY_ORDER: Record<string, number> = {
  Placement: 1,
  Result: 2,
  Event: 3,
};

function sortByPriority(notifications: Notification[]): Notification[] {
  return [...notifications].sort((a, b) => {
    const priorityDiff = (PRIORITY_ORDER[a.Type] || 99) - (PRIORITY_ORDER[b.Type] || 99);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime();
  });
}

export default function PriorityInboxPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    log("frontend", "info", "page", "Priority Inbox page loaded");

    fetchNotifications(1, 50).then((data) => {
      const sorted = sortByPriority(data);
      setNotifications(sorted.slice(0, 10));
      setLoading(false);
    });
  }, []);

  return (
    <>
      <Navbar />
      <Container maxWidth="md">
        <Typography variant="h5" sx={{ mb: 1 }}>
          Priority Inbox
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Top 10 notifications sorted by priority (Placement &gt; Result &gt; Event), then by latest first.
        </Typography>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : notifications.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
            No notifications found.
          </Typography>
        ) : (
          notifications.map((n) => (
            <NotificationCard key={n.ID} notification={n} />
          ))
        )}
      </Container>
    </>
  );
}
