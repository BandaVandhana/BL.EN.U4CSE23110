import axios from "axios";

const BASE_URL = "/evaluation-service";

export async function log(
  stack: "frontend" | "backend",
  level: "debug" | "info" | "warn" | "error" | "fatal",
  packageName: string,
  message: string
) {
  const token =
    process.env.NEXT_PUBLIC_AUTH_TOKEN ?? process.env.AUTH_TOKEN ?? "";

  try {
    await axios.post(
      `${BASE_URL}/logs`,
      {
        stack,
        level,
        package: packageName,
        message,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch {
    // Logging failures should never break UI behavior.
  }
}
