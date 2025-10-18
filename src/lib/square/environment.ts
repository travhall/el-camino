// /src/lib/square/environment.ts
import { Environment } from "square/legacy";

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return import.meta.env.PUBLIC_SQUARE_ENVIRONMENT === "production";
}

/**
 * Validate that all required production configuration is present
 * Throws error if any required variables are missing in production mode
 */
export function validateProductionConfig(): void {
  if (isProduction()) {
    const required = [
      "SQUARE_ACCESS_TOKEN",
      "PUBLIC_SQUARE_APP_ID",
      "PUBLIC_SQUARE_LOCATION_ID",
    ];

    const missing = required.filter((key) => !import.meta.env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing production Square configuration: ${missing.join(", ")}`
      );
    }

    console.log("✓ Production Square configuration validated");
  }
}

/**
 * Get the appropriate Square environment constant
 */
export function getSquareEnvironment(): typeof Environment.Production | typeof Environment.Sandbox {
  return isProduction() ? Environment.Production : Environment.Sandbox;
}

/**
 * Get environment name for logging
 */
export function getEnvironmentName(): string {
  return isProduction() ? "production" : "sandbox";
}
