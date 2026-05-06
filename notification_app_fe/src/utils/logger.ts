import { Log } from "logging-middleware";

export async function log(
  stack: "frontend" | "backend",
  level: "debug" | "info" | "warn" | "error" | "fatal",
  packageName: string,
  message: string
) {
  await Log(stack, level, packageName, message);
}
