import { create } from "zustand";
import type {
  Upload,
  UploadResult,
  PaginatedResponse,
} from "@insurance/shared";

export interface UploadProgress {
  upload_id: string;
  processed_rows: number;
  total_rows: number;
}

interface UploadsState {
  uploads: Upload[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
  currentProgress: UploadProgress | null;
  lastResult: UploadResult | null;
  isUploading: boolean;
  isLoading: boolean;
  setUploads: (data: PaginatedResponse<Upload>) => void;
  setProgress: (progress: UploadProgress) => void;
  setComplete: (result: UploadResult) => void;
  setUploading: (uploading: boolean) => void;
  setLoading: (loading: boolean) => void;
  clearResult: () => void;
}

export const useUploadsStore = create<UploadsState>((set) => ({
  uploads: [],
  pagination: { page: 1, per_page: 25, total_items: 0, total_pages: 0 },
  currentProgress: null,
  lastResult: null,
  isUploading: false,
  isLoading: true,

  setUploads: (data) =>
    set({
      uploads: data.items,
      pagination: data.pagination,
      isLoading: false,
    }),

  setProgress: (progress) =>
    set({
      currentProgress: progress,
      isUploading: true,
    }),

  setComplete: (result) =>
    set({
      lastResult: result,
      currentProgress: null,
      isUploading: false,
    }),

  setUploading: (uploading) => set({ isUploading: uploading }),

  setLoading: (loading) => set({ isLoading: loading }),

  clearResult: () => set({ lastResult: null }),
}));
