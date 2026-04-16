export type UploadStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface Upload {
  id: string;
  filename: string;
  file_size: number;
  status: UploadStatus;
  error_message: string | null;
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  uploaded_by_id: string;
  uploaded_by_name?: string;
  created_at: string;
  completed_at: string | null;
}

export interface UploadResult {
  upload_id: string;
  status: UploadStatus;
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_message: string | null;
}
