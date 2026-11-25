import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
});

/**
 * Accurately parses and formats API errors distinguishing between:
 * - Request cancellation (AbortController / Axios cancel)
 * - Request timeouts (ECONNABORTED, timeout errors)
 * - HTTP status errors (400, 422, 500, etc.)
 * - Network / connection refusal errors (ERR_NETWORK)
 * - Response parsing / invalid payload errors
 *
 * @param {any} err - Caught error object
 * @param {string} fallbackMessage - Fallback error string
 * @returns {string} User-friendly, accurate error message
 */
export function formatApiError(err, fallbackMessage = 'An unexpected error occurred.') {
  if (!err) return fallbackMessage;

  // 1. Cancellation via AbortController or Axios cancel token
  if (axios.isCancel(err) || err.code === 'ERR_CANCELED' || err.name === 'CanceledError') {
    return 'The request was cancelled.';
  }

  // 2. Request timeout (client aborted after configured duration)
  const isTimeout =
    err.code === 'ECONNABORTED' ||
    err.code === 'ETIMEDOUT' ||
    (typeof err.message === 'string' && err.message.toLowerCase().includes('timeout'));

  if (isTimeout) {
    return 'The request timed out while processing. Deep learning or complex image analysis on CPU can take some time. Please try again.';
  }

  // 3. HTTP status error responses (4xx, 5xx)
  if (err.response) {
    const status = err.response.status;
    const data = err.response.data;

    let detail = '';
    if (typeof data?.detail === 'string') {
      detail = data.detail;
    } else if (Array.isArray(data?.detail)) {
      // FastAPI 422 validation errors: [{loc: [...], msg: "...", type: "..."}]
      detail = data.detail
        .map((item) => (item.msg ? `${item.loc ? item.loc.slice(-1) + ': ' : ''}${item.msg}` : JSON.stringify(item)))
        .join('; ');
    } else if (typeof data?.message === 'string') {
      detail = data.message;
    } else if (err.response.statusText) {
      detail = err.response.statusText;
    }

    if (status === 400) {
      return detail || 'Invalid request (400). Please verify the uploaded file format and image dimensions.';
    }
    if (status === 422) {
      return detail ? `Validation error (422): ${detail}` : 'Validation error (422): The server could not process the provided file data.';
    }
    if (status === 500) {
      return detail
        ? `Backend error (500): ${detail}`
        : 'Internal server error (500) occurred on the backend during processing.';
    }
    return detail ? `Server error (${status}): ${detail}` : `Server returned error (${status}).`;
  }

  // 4. Network / Connection errors (server actually unreachable)
  if (err.code === 'ERR_NETWORK' || (!err.response && err.request)) {
    return 'Backend server is unavailable or not responding. Please verify the FastAPI server is running on http://localhost:8000.';
  }

  // 5. Fallback generic or client validation error
  return err.message || fallbackMessage;
}

/**
 * Checks backend connectivity status via GET /api/health
 * Uses a 10-second timeout so high CPU load does not falsely report disconnected.
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth() {
  try {
    const response = await apiClient.get('/api/health', { timeout: 10000 });
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
    throw new Error(formatApiError(err, 'An unexpected error occurred while preparing your upload.'));
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
    throw new Error(formatApiError(err, 'An unexpected error occurred while segmenting page lines.'));
  }
}

/**
 * Step 4: Recognizes handwritten text from a page image using Microsoft TrOCR.
 * Configured with a 10-minute (600,000ms) client-side timeout to comfortably handle
 * long-running CPU inferences on pages with 30+ handwritten lines.
 *
 * @param {File} file - Image File object
 * @param {Object} [options] - Optional settings
 * @param {number} [options.timeout=600000] - Request timeout in milliseconds (default 10 min)
 * @param {AbortSignal} [options.signal] - Optional AbortSignal for user cancellation
 * @returns {Promise<{
 *   success: boolean,
 *   filename: string,
 *   line_count: number,
 *   model: string,
 *   device: string,
 *   preprocessing_mode?: string,
 *   lines: Array<{ index: number, bbox?: { x: number, y: number, width: number, height: number }, image?: string, text: string }>,
 *   full_text: string,
 *   original_size?: { width: number, height: number },
 *   annotated_image?: string,
 *   message?: string,
 *   inference_time_sec?: number
 * }>}
 */
export async function recognizeHandwriting(file, options = {}) {
  if (!file) {
    throw new Error('Please select a handwriting sample image to recognize.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const timeoutMs = options.timeout ?? 600000; // 10 minutes default for CPU inference

  try {
    const response = await apiClient.post('/api/samples/ocr', formData, {
      timeout: timeoutMs,
      signal: options.signal,
    });

    const data = response.data;

    // Validate response payload
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response structure received from OCR service: Expected a JSON object.');
    }

    // Normalize and validate response fields matching backend OCRResponse schema
    const rawLines = Array.isArray(data.lines) ? data.lines : [];
    const normalizedLines = rawLines.map((line, idx) => ({
      index: typeof line.index === 'number' ? line.index : idx + 1,
      bbox: line.bbox && typeof line.bbox === 'object' ? line.bbox : null,
      image: typeof line.image === 'string' ? line.image : '',
      text: typeof line.text === 'string' ? line.text : '',
    }));

    const fullText =
      typeof data.full_text === 'string'
        ? data.full_text
        : normalizedLines.map((l) => l.text).filter(Boolean).join('\n');

    const normalizedData = {
      success: Boolean(data.success),
      filename: data.filename || file.name || 'handwritten_page',
      line_count: typeof data.line_count === 'number' ? data.line_count : normalizedLines.length,
      model: data.model || 'microsoft/trocr-base-handwritten',
      device: data.device || 'CPU',
      preprocessing_mode: data.preprocessing_mode || 'original',
      lines: normalizedLines,
      full_text: fullText,
      original_size: data.original_size || null,
      annotated_image: data.annotated_image || null,
      message: data.message || '',
      inference_time_sec: typeof data.inference_time_sec === 'number' ? data.inference_time_sec : null,
    };

    return normalizedData;
  } catch (err) {
    throw new Error(formatApiError(err, 'An unexpected error occurred while recognizing handwriting.'));
  }
}

/**
 * Step 5: Analyzes handwriting style metrics from an un-thresholded original image.
 * Extracts stroke thickness, line/character height, line spacing, horizontal spacing,
 * baseline slant angle, ink density, coverage %, and dominant ink color.
 *
 * @param {File} file - Image File object
 * @param {Object} [options] - Optional settings
 * @param {number} [options.timeout=90000] - Request timeout in milliseconds (default 90s)
 * @param {AbortSignal} [options.signal] - Optional cancellation signal
 * @returns {Promise<{
 *   success: boolean,
 *   filename: string,
 *   original_size?: { width: number, height: number },
 *   line_count_detected: number,
 *   metrics: {
 *     stroke_thickness: { value: number|null, unit: string, is_heuristic: boolean, status: string, confidence: string, description: string },
 *     line_height: { value: number|null, unit: string, is_heuristic: boolean, status: string, confidence: string, description: string },
 *     line_spacing: { value: number|null, unit: string, is_heuristic: boolean, status: string, confidence: string, description: string },
 *     horizontal_spacing: { value: number|null, unit: string, is_heuristic: boolean, status: string, confidence: string, description: string },
 *     slant_angle: { value: number|null, unit: string, is_heuristic: boolean, status: string, confidence: string, description: string },
 *     ink_density: { value: number|null, unit: string, is_heuristic: boolean, status: string, confidence: string, description: string },
 *     ink_coverage_pct: { value: number|null, unit: string, is_heuristic: boolean, status: string, confidence: string, description: string }
 *   },
 *   dominant_color: { rgb: number[]|null, hex: string|null, color_name: string|null, is_reliable: boolean, confidence: string },
 *   summary?: { headline: string, weight_label: string, slant_label: string, spacing_label: string, density_label: string, ink_label: string },
 *   annotated_sample?: string,
 *   message?: string,
 *   analysis_time_sec?: number
 * }>}
 */
export async function analyzeHandwritingStyle(file, options = {}) {
  if (!file) {
    throw new Error('Please select a handwriting sample image to analyze style.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const timeoutMs = options.timeout ?? 90000; // 90 seconds timeout

  try {
    const response = await apiClient.post('/api/samples/style', formData, {
      timeout: timeoutMs,
      signal: options.signal,
    });
    return response.data;
  } catch (err) {
    throw new Error(formatApiError(err, 'An unexpected error occurred while analyzing handwriting style.'));
  }
}

/**
 * Step 6: Extracts 512-dimensional CNN style embeddings across one or multiple handwriting images.
 * Uses a pretrained ResNet-18 convolutional backbone with Global Average Pooling.
 *
 * @param {File[]} files - Array of image File objects
 * @param {Object} [options] - Optional settings
 * @param {number} [options.timeout=60000] - Request timeout in milliseconds (default 60s)
 * @param {AbortSignal} [options.signal] - Optional cancellation signal
 * @returns {Promise<{
 *   success: boolean,
 *   model_name: string,
 *   model_source: string,
 *   is_pretrained: boolean,
 *   embedding_dim: number,
 *   embedding: number[],
 *   preview_values: number[],
 *   statistics?: { min: number, max: number, mean: number, std: number, l2_norm: number, active_features_count: number },
 *   total_samples_received: number,
 *   successful_samples: number,
 *   sample_details: Array<{ filename: string, success: boolean, embedding_dim: number, l2_norm?: number, preview_values?: number[], message?: string }>,
 *   aggregation_method: string,
 *   processing_time_sec?: number,
 *   warnings: string[],
 *   ml_limitations_notice: string,
 *   message?: string
 * }>}
 */
export async function extractStyleEmbedding(files, options = {}) {
  if (!files || files.length === 0) {
    throw new Error('Please select at least one handwriting sample image to extract CNN embeddings.');
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const timeoutMs = options.timeout ?? 60000;

  try {
    const response = await apiClient.post('/api/samples/style-encoder', formData, {
      timeout: timeoutMs,
      signal: options.signal,
    });
    return response.data;
  } catch (err) {
    throw new Error(formatApiError(err, 'An unexpected error occurred while extracting style embeddings.'));
  }
}

/**
 * Fetches diagnostic status of the OCR service.
 * @returns {Promise<{ model_name: string, device: string, cuda_available: boolean, is_loaded: boolean }>}
 */
export async function getOCRStatus() {
  try {
    const response = await apiClient.get('/api/samples/ocr/status', { timeout: 5000 });
    return response.data;
  } catch (err) {
    return { is_loaded: false, device: 'UNKNOWN' };
  }
}

/**
 * Step 7: Creates or updates a personalized handwriting style profile
 * by aggregating classical morphological metrics and 512-D CNN ResNet-18 visual embeddings
 * across one or multiple uploaded handwriting samples.
 *
 * @param {File[]} files - Array of image File objects
 * @param {Object} [options]
 * @param {string} [options.profileId='default_writer'] - Profile ID
 * @param {number} [options.timeout=90000] - Request timeout in ms
 * @param {AbortSignal} [options.signal] - Optional abort signal
 * @returns {Promise<Object>} PersonalizedProfileResponse
 */
export async function createStyleProfile(files, options = {}) {
  if (!files || files.length === 0) {
    throw new Error('Please select at least one handwriting sample image to build your style profile.');
  }

  const profileId = options.profileId || 'default_writer';
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const timeoutMs = options.timeout ?? 90000;

  try {
    const response = await apiClient.post(`/api/profile?profile_id=${encodeURIComponent(profileId)}`, formData, {
      timeout: timeoutMs,
      signal: options.signal,
    });
    return response.data;
  } catch (err) {
    throw new Error(formatApiError(err, 'An unexpected error occurred while building the style profile.'));
  }
}

/**
 * Step 7: Retrieves a persisted handwriting style profile from disk.
 * Returns null if no profile has been saved yet (HTTP 404).
 *
 * @param {string} [profileId='default_writer']
 * @returns {Promise<Object|null>}
 */
export async function getSavedStyleProfile(profileId = 'default_writer') {
  try {
    const response = await apiClient.get(`/api/profile?profile_id=${encodeURIComponent(profileId)}`, {
      timeout: 10000,
    });
    return response.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return null;
    }
    throw new Error(formatApiError(err, 'Could not retrieve saved style profile.'));
  }
}

/**
 * Step 7: Deletes / resets a saved handwriting style profile.
 *
 * @param {string} [profileId='default_writer']
 * @returns {Promise<boolean>}
 */
export async function deleteStyleProfile(profileId = 'default_writer') {
  try {
    const response = await apiClient.delete(`/api/profile?profile_id=${encodeURIComponent(profileId)}`, {
      timeout: 10000,
    });
    return response.status === 200;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return true; // Already gone
    }
    throw new Error(formatApiError(err, 'Could not delete style profile.'));
  }
}

/**
 * Step 8: Generates realistic handwritten-style A4 page images from user-supplied text.
 * Integrates morphological parameters from the Step 7 style profile (ink color, line spacing, stroke).
 *
 * @param {string} text - The input notes/content to render
 * @param {Object} [options] - Custom rendering parameters
 * @param {string} [options.fontFamily='casual'] - 'casual', 'print', 'cursive'
 * @param {number} [options.fontSize=26] - Font size in pixels
 * @param {string} [options.pageStyle='ruled'] - 'ruled', 'blank', 'grid'
 * @param {string} [options.inkColor] - Optional hex color override
 * @param {string} [options.profileId='default_writer'] - Style profile ID
 * @param {boolean} [options.useProfile=true] - Whether to apply Step 7 profile parameters
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{
 *   success: boolean,
 *   session_id: string,
 *   total_pages: number,
 *   pages: Array<{ page_number: number, total_pages: number, width: number, height: number, image_data: string, file_url: string, word_count: number, line_count: number }>,
 *   profile_applied: boolean,
 *   profile_id?: string,
 *   renderer_name: string,
 *   renderer_notice: string,
 *   generation_time_sec: number,
 *   options_applied: Object
 * }>}
 */
export async function generateHandwrittenNotes(text, options = {}) {
  if (!text || !text.trim()) {
    throw new Error('Please enter some notes or text before generating handwritten pages.');
  }

  const payload = {
    text: text.trim(),
    options: {
      font_family: options.fontFamily || 'casual',
      font_size: options.fontSize || 26,
      page_style: options.pageStyle || 'ruled',
      ink_color: options.inkColor || null,
      line_spacing_mult: options.lineSpacingMult || 1.4,
      profile_id: options.profileId || 'default_writer',
      use_profile: options.useProfile !== undefined ? options.useProfile : true,
      simulate_pressure: true,
    },
  };

  try {
    const response = await apiClient.post('/api/generate/handwriting', payload, {
      timeout: 60000,
      signal: options.signal,
    });
    return response.data;
  } catch (err) {
    throw new Error(formatApiError(err, 'An unexpected error occurred while generating handwritten pages.'));
  }
}

