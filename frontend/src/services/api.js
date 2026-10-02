import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
});

/**
 * Checks backend connectivity status via GET /api/health
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth() {
  try {
    const response = await apiClient.get('/api/health', { timeout: 3000 });
    return response.status === 200 && response.data?.status === 'ok';
  } catch (error) {
    return false;
  }
}

/**
 * Uploads handwriting image files to the computer vision preprocessing pipeline.
 * @param {File[]} files - Array of image File objects
 * @returns {Promise<{ success: boolean, samples: Array<{ filename: string, original_size: { width: number, height: number }, processed_image: string }> }>}
 */
export async function processHandwritingSamples(files) {
  if (!files || files.length === 0) {
    throw new Error('Please select at least one handwriting sample image to process.');
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  try {
    // Note: Do not manually set Content-Type so Axios/browser computes the multipart boundary.
    const response = await apiClient.post('/api/samples/process', formData);
    return response.data;
  } catch (err) {
    if (err.response) {
      // Backend returned HTTP error
      const detail = err.response.data?.detail || err.response.statusText;
      throw new Error(detail || `Server returned error (${err.response.status})`);
    } else if (err.request) {
      // Network or backend unavailable
      throw new Error(
        'Backend server is unavailable or not responding. Please verify the FastAPI server is running on http://localhost:8000.'
      );
    } else {
      throw new Error(err.message || 'An unexpected error occurred while preparing your upload.');
    }
  }
}

/**
 * Step 3: Uploads a single handwriting page image to segment into text lines.
 * @param {File} file - Image File object
 * @returns {Promise<{
 *   success: boolean,
 *   filename: string,
 *   line_count: number,
 *   original_size?: { width: number, height: number },
 *   annotated_image?: string,
 *   lines: Array<{ index: number, bbox: { x: number, y: number, width: number, height: number }, image: string }>,
 *   message?: string
 * }>}
 */
export async function segmentHandwritingPage(file) {
  if (!file) {
    throw new Error('Please select a handwriting sample image to segment.');
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await apiClient.post('/api/samples/segment', formData);
    return response.data;
  } catch (err) {
    if (err.response) {
      const detail = err.response.data?.detail || err.response.statusText;
      throw new Error(detail || `Server returned error (${err.response.status})`);
    } else if (err.request) {
      throw new Error(
        'Backend server is unavailable or not responding. Please verify the FastAPI server is running on http://localhost:8000.'
      );
    } else {
      throw new Error(err.message || 'An unexpected error occurred while segmenting page lines.');
    }
  }
}
