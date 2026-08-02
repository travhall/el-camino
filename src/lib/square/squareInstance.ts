import { SquareClient, SquareEnvironment } from "square-legacy";

// Validate at first use, not at import. Importing this module during prerender
// (e.g. for the static 404 page) shouldn't crash the build when env is unset —
// the actual API call will surface a clearer error if/when it runs.
let envValidated = false;
export function validateEnvironment(): void {
  if (envValidated) return;
  const missingVars: string[] = [];
  if (!process.env.SQUARE_ACCESS_TOKEN) missingVars.push("SQUARE_ACCESS_TOKEN");
  if (!import.meta.env.PUBLIC_SQUARE_LOCATION_ID) missingVars.push("PUBLIC_SQUARE_LOCATION_ID");
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
  }
  envValidated = true;
}

export const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN ?? "",
  environment:
    import.meta.env.PUBLIC_SQUARE_ENVIRONMENT === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
});
