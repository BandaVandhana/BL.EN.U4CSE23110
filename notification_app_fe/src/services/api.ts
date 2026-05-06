import axios from "axios";
import { log } from "@/utils/logger";

const BASE_URL = "http://20.207.122.201/evaluation-service";

export interface Notification {
  ID: string;
  Type: "Event" | "Result" | "Placement";
  Message: string;
  Timestamp: string;
}

interface NotificationResponse {
  notifications: Notification[];
}

export async function fetchNotifications(
  page: number,
  limit: number,
  type?: string
): Promise<Notification[]> {
  try {
    const params: Record<string, string | number> = { page, limit };
    if (type && type !== "All") {
      params.notification_type = type;
    }

    log("frontend", "info", "api", `Fetching notifications - page: ${page}, limit: ${limit}, type: ${type || "All"}`);

    const res = await axios.get<NotificationResponse>(
      `${BASE_URL}/notifications`,
      { params }
    );

    log("frontend", "info", "api", `Fetched ${res.data.notifications.length} notifications`);
    return res.data.notifications;
  } catch (err) {
    log("frontend", "error", "api", `Failed to fetch notifications: ${err instanceof Error ? err.message : "Unknown error"}`);
    return [];
  }
}
