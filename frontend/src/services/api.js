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
 * @param {number} [options.timeout=60000] - Request timeout in milliseconds (default 60s)
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
