/**
 * Local, non-identifying visual indicators from camera frames.
 * Never sent as raw video. Not identity recognition. Not emotion diagnosis.
 */
export function sampleFrameMetrics(videoEl, canvas) {
  if (!videoEl || videoEl.readyState < 2) return null;
  const w = 64;
  const h = 48;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(videoEl, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let sum = 0;
  let center = 0;
  let centerN = 0;
  let edge = 0;
  let edgeN = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += lum;
      const inCenter = Math.abs(x - w / 2) < 12 && Math.abs(y - h / 2) < 10;
      if (inCenter) {
        center += lum;
        centerN += 1;
      } else {
        edge += lum;
        edgeN += 1;
      }
    }
  }

  const mean = sum / (w * h);
  const centerMean = centerN ? center / centerN : 0;
  const edgeMean = edgeN ? edge / edgeN : 0;
  return { mean, centerMean, edgeMean, ts: Date.now() };
}

export function deriveVisualMetrics(samples = []) {
  if (!samples.length) {
    return {
      gazeStability: null,
      lookAwayFrequency: 0,
      headMovement: 0,
      engagementIndicator: 'unavailable'
    };
  }

  const means = samples.map((s) => s.mean);
  const centers = samples.map((s) => s.centerMean);
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = (arr) => {
    const m = avg(arr);
    return avg(arr.map((v) => (v - m) ** 2));
  };

  const motion = Math.sqrt(variance(means));
  const centerVar = Math.sqrt(variance(centers));
  const last = samples[samples.length - 1];
  const lookAway = last.centerMean + 8 < last.edgeMean ? 1 : 0;
  const lookAwayFrequency = samples.filter((s) => s.centerMean + 8 < s.edgeMean).length;

  let engagementIndicator = 'steady framing';
  if (lookAway) engagementIndicator = 'subject moved from frame center';
  else if (motion > 18) engagementIndicator = 'increased head movement';

  return {
    gazeStability: Math.max(0, Math.min(100, Math.round(100 - centerVar))),
    lookAwayFrequency,
    headMovement: Math.round(motion),
    engagementIndicator,
    samplesCollected: samples.length
  };
}
