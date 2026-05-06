"use client";

import { useEffect, useState } from "react";
import { Container, Typography, CircularProgress, Box } from "@mui/material";
import { fetchNotifications, Notification } from "@/services/api";
import NotificationCard from "@/components/NotificationCard";
import FilterBar from "@/components/FilterBar";
import PaginationControls from "@/components/PaginationControls";
import Navbar from "@/components/Navbar";
import { log } from "@/utils/logger";

const PAGE_SIZE = 10;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    log("frontend", "info", "page", "Notifications page loaded");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchNotifications(page, PAGE_SIZE, filter).then((data) => {
      if (!cancelled) {
        setNotifications(data);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [page, filter]);

  const handleFilterChange = (value: string) => {
    setFilter(value);
    setPage(1);
  };

  return (
    <>
      <Navbar />
      <Container maxWidth="md">
        <Typography variant="h5" sx={{ mb: 2 }}>
          Notifications
        </Typography>

        <FilterBar selected={filter} onChange={handleFilterChange} />

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : notifications.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
            No notifications found.
          </Typography>
        ) : (
          <>
            {notifications.map((n) => (
              <NotificationCard key={n.ID} notification={n} />
            ))}
            <PaginationControls
              page={page}
              onPageChange={setPage}
              hasMore={notifications.length === PAGE_SIZE}
            />
          </>
        )}
      </Container>
    </>
  );
}
