import { useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useUploadsStore } from "@/stores/uploads.store";
import type { Upload, UploadResult, PaginatedResponse } from "@insurance/shared";
import { toast } from "sonner";

export function useUploads() {
  const {
    uploads,
    pagination,
    currentProgress,
    lastResult,
    isUploading,
    isLoading,
    setUploads,
    setUploading,
    setComplete,
    setLoading,
    clearResult,
  } = useUploadsStore();

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<PaginatedResponse<Upload>>(
        "uploads?per_page=25",
      );
      setUploads(data);
    } catch {
      toast.error("Erreur lors du chargement des imports");
      setLoading(false);
    }
  }, [setUploads, setLoading]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const result = await api.upload<UploadResult>("uploads", formData);
        setComplete(result);
        toast.success("Fichier importe avec succes");
        fetchUploads();
      } catch (err: any) {
        const message =
          err?.response
            ? (await err.response.json().catch(() => null))?.error?.message
            : null;
        toast.error(message || "Erreur lors de l'import du fichier");
        setUploading(false);
        throw err;
      }
    },
    [setUploading, setComplete, fetchUploads],
  );

  return {
    uploads,
    pagination,
    currentProgress,
    lastResult,
    isUploading,
    isLoading,
    uploadFile,
    clearResult,
    refetch: fetchUploads,
  };
}
