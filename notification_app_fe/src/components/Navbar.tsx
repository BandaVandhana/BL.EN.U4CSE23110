"use client";

import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { useRouter, usePathname } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <AppBar position="static" sx={{ mb: 3 }}>
      <Toolbar>
        <NotificationsIcon sx={{ mr: 1 }} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Campus Notify
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            color="inherit"
            variant={pathname === "/" ? "outlined" : "text"}
            onClick={() => router.push("/")}
          >
            Notifications
          </Button>
          <Button
            color="inherit"
            variant={pathname === "/priority" ? "outlined" : "text"}
            onClick={() => router.push("/priority")}
          >
            Priority Inbox
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
