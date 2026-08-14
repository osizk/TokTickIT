import { useState } from "react";
import { checkSystem, Category } from "./api.js";

type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [service, setService] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCheck() {
    setState("loading");
    setService(null);
    setCategories([]);
    setErrorMessage(null);

    try {
      const system = await checkSystem();
      setService(system.service);
      setCategories(system.categories);
      setState("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to connect to TokTickIT API."
      );
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading..." : "Check System"}
      </button>

      {state === "loading" && (
        <p className="mt-4" role="status">
          Loading...
        </p>
      )}

      {state === "success" && (
        <div className="mt-4" role="status">
          <p>System Status: Online</p>
          <p>Service: {service}</p>
          <h2 className="h5 mt-4">Supported Request Categories</h2>
          <ul aria-label="Supported Request Categories">
            {categories.map((category) => (
              <li key={category.id}>{category.name}</li>
            ))}
          </ul>
        </div>
      )}

      {state === "error" && (
        <div className="alert alert-danger mt-4" role="alert">
          <p className="mb-1">System Status: Offline</p>
          <p className="mb-0">{errorMessage}</p>
        </div>
      )}

    </div>
  );
}
