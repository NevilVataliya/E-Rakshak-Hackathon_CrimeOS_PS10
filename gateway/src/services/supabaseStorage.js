const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'crimeos-evidence';

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[+] Supabase Storage client initialized successfully');
  } catch (err) {
    console.warn('[-] Failed to initialize Supabase Storage client:', err.message);
  }
} else {
  console.log('[i] Supabase Storage keys not provided. System will use local file storage/fallback.');
}

/**
 * Uploads a local file buffer or disk file to Supabase Storage bucket.
 * @param {string} localFilePath - Path to local file on disk
 * @param {string} storageDestinationPath - Storage path inside bucket (e.g. "complaints/CR-2026-9910.pdf")
 * @param {string} mimeType - File mime type
 * @returns {Promise<{ storageUrl: string, path: string, isCloud: boolean }>}
 */
const uploadFileToStorage = async (localFilePath, storageDestinationPath, mimeType = 'application/octet-stream') => {
  if (supabase && fs.existsSync(localFilePath)) {
    try {
      const fileBuffer = fs.readFileSync(localFilePath);
      
      // Ensure bucket exists or handle upload
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storageDestinationPath, fileBuffer, {
          contentType: mimeType,
          upsert: true
        });

      if (error) {
        console.warn('[-] Supabase upload error:', error.message);
        throw error;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storageDestinationPath);

      console.log(`[+] File uploaded to Supabase Storage: ${publicUrlData.publicUrl}`);
      return {
        storageUrl: publicUrlData.publicUrl,
        path: data.path,
        isCloud: true
      };
    } catch (err) {
      console.warn('[-] Supabase upload fallback to local URL:', err.message);
    }
  }

  // Fallback to relative API endpoint URL
  const filename = path.basename(storageDestinationPath);
  return {
    storageUrl: `/api/requests/download/${filename}`,
    path: storageDestinationPath,
    isCloud: false
  };
};

/**
 * Generates a signed temporary download URL for a file in Supabase Storage.
 */
const getSignedDownloadUrl = async (storageDestinationPath, expiresInSeconds = 3600) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(storageDestinationPath, expiresInSeconds);

      if (data && data.signedUrl) {
        return data.signedUrl;
      }
    } catch (err) {
      console.warn('[-] Supabase signed URL error:', err.message);
    }
  }
  const filename = path.basename(storageDestinationPath);
  return `/api/requests/download/${filename}`;
};

module.exports = {
  uploadFileToStorage,
  getSignedDownloadUrl,
  BUCKET_NAME
};
