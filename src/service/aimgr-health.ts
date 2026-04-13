export interface AimgrVerifyHealth {
  available: boolean;
  healthy: boolean;
  hasIssues: boolean;
}

export interface AimgrRepairHealth {
  attempted: boolean;
  healthy: boolean;
}

interface AimgrHealthPayload {
  issues?: unknown[];
  errors?: unknown[];
  error?: unknown;
  status?: unknown;
}

export function interpretAimgrVerifyHealth(result: unknown): AimgrVerifyHealth {
  if (!result || typeof result !== "object") {
    return {
      available: false,
      healthy: false,
      hasIssues: true,
    };
  }

  const payload = result as AimgrHealthPayload;
  const hasIssues =
    (Array.isArray(payload.issues) && payload.issues.length > 0) ||
    (Array.isArray(payload.errors) && payload.errors.length > 0) ||
    (typeof payload.error === "string" && payload.error !== "") ||
    (typeof payload.status === "string" && payload.status !== "ok" && payload.status !== "healthy");

  return {
    available: true,
    healthy: !hasIssues,
    hasIssues,
  };
}

export function interpretAimgrRepairHealth(result: unknown, attempted: boolean): AimgrRepairHealth {
  if (!attempted) {
    return {
      attempted: false,
      healthy: false,
    };
  }

  const verifyShape = interpretAimgrVerifyHealth(result);
  return {
    attempted: true,
    healthy: verifyShape.available && verifyShape.healthy,
  };
}
