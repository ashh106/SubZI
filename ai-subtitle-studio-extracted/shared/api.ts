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
