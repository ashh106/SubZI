export interface DemoResponse {
  message: string;
}

export interface UploadRequest {
  filename: string;
  size: number;
  type?: string;
}

export interface UploadResponse {
  success: true;
  file: string;
  receivedAt: string;
}

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";