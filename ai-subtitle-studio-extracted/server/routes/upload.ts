import { RequestHandler } from "express";

import { type UploadRequest, type UploadResponse } from "@shared/api";

function sanitizeFileName(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || `video-${Date.now()}.mp4`;
}

export const handleUpload: RequestHandler<unknown, UploadResponse, UploadRequest> = (
  req,
  res,
) => {
  const safeName = sanitizeFileName(req.body.filename ?? "video.mp4");

  const response: UploadResponse = {
    success: true,
    file: safeName,
    receivedAt: new Date().toISOString(),
  };

  res.status(200).json(response);
};
