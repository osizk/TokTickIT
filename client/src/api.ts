const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export interface HealthStatus {
  status: "ok";
  service: string;
}

export async function checkHealth(): Promise<HealthStatus> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/api/health`);
  } catch {
    throw new Error("Unable to connect to TokTickIT API.");
  }

  if (!response.ok) {
    throw new Error("Unable to connect to TokTickIT API.");
  }

  const health = (await response.json()) as Partial<HealthStatus>;
  if (health.status !== "ok" || typeof health.service !== "string") {
    throw new Error("TokTickIT API returned an invalid health response.");
  }

  return { status: health.status, service: health.service };
}

// Issue 2 + Issue 4 — call the backend.
// Steps: fetch `${API_URL}/api/health`; if not ok, throw.
//        then fetch `${API_URL}/api/categories`; if not ok, throw.
//        return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  // TODO(Issue 2 & 4): implement the two fetch calls described above.
  throw new Error("checkSystem not implemented yet");
}
