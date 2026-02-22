export const AUDIO_ADMIN_HEADER = "x-audio-admin-token";

export type AudioAdminErrorReason = "missing_admin_token" | "invalid_admin_token";

export interface AudioFilePayload {
  name: string;
  url: string;
  size: number | null;
  uploadedAt: string | null;
}

export interface UploadAudioResponse {
  message: string;
  filename: string;
  url: string;
}

export interface AudioAdminErrorPayload {
  message: string;
  reason?: AudioAdminErrorReason;
}

export function normalizeAdminToken(rawToken: string | null | undefined): string | null {
  const trimmed = typeof rawToken === "string" ? rawToken.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

export function buildAudioAdminHeaders(
  adminToken?: string | null,
  initialHeaders: HeadersInit = {}
): Headers {
  const headers = new Headers(initialHeaders);
  const normalizedToken = normalizeAdminToken(adminToken);
  if (normalizedToken) {
    headers.set(AUDIO_ADMIN_HEADER, normalizedToken);
  }
  return headers;
}

export async function fetchAudioFiles(adminToken?: string | null): Promise<Response> {
  return fetch("/api/audio-files", {
    headers: buildAudioAdminHeaders(adminToken),
  });
}

export async function uploadAudioFile(file: File, adminToken?: string | null): Promise<Response> {
  const formData = new FormData();
  formData.append("file", file);
  return fetch("/api/upload", {
    method: "POST",
    headers: buildAudioAdminHeaders(adminToken),
    body: formData,
  });
}

export async function deleteAudioFile(filename: string, adminToken?: string | null): Promise<Response> {
  return fetch(`/api/audio-files/${encodeURIComponent(filename)}`, {
    method: "DELETE",
    headers: buildAudioAdminHeaders(adminToken),
  });
}

export async function renameAudioFile(
  filename: string,
  newName: string,
  adminToken?: string | null
): Promise<Response> {
  return fetch(`/api/audio-files/${encodeURIComponent(filename)}`, {
    method: "PATCH",
    headers: buildAudioAdminHeaders(adminToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ name: newName }),
  });
}

export async function readAudioAdminError(response: Response): Promise<AudioAdminErrorPayload | null> {
  try {
    const payload = (await response.json()) as Partial<AudioAdminErrorPayload>;
    if (typeof payload?.message !== "string") {
      return null;
    }
    const reason = payload.reason;
    return {
      message: payload.message,
      reason: reason === "missing_admin_token" || reason === "invalid_admin_token" ? reason : undefined,
    };
  } catch {
    return null;
  }
}
