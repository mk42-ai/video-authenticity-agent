const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json({ limit: '10mb' }));

const GPU_BACKEND = process.env.GPU_BACKEND_URL || 'https://launched-integrated-expect-watts.trycloudflare.com';

// ── Health ──
app.get('/health', async (req, res) => {
  try {
    const r = await fetch(`${GPU_BACKEND}/health`, { timeout: 8000 });
    const data = await r.json();
    res.json({ status: 'ok', backend: data, proxy: 'video-authenticity-agent-v1' });
  } catch (e) {
    res.json({ status: 'ok', backend: 'unreachable', proxy: 'video-authenticity-agent-v1', error: e.message });
  }
});

// ── Analyze Video ──
app.post('/analyze', async (req, res) => {
  try {
    const { mp4_url, job_id, callback_url, options } = req.body;

    if (!mp4_url) {
      return res.status(400).json({
        job_id: job_id || 'unknown',
        status: 'failed',
        error_code: 'MISSING_URL',
        message: 'mp4_url is required'
      });
    }

    // Forward to GPU backend
    const payload = {
      mp4_url,
      job_id: job_id || undefined,
      callback_url: callback_url || undefined,
      options: {
        max_frames: (options && options.max_frames) || 32,
        sample_fps: (options && options.sample_fps) || 2,
        top_k_segments: (options && options.top_k_segments) || 3,
        frames_per_segment: (options && options.frames_per_segment) || 3,
        run_llm_analysis: options && options.run_llm_analysis !== undefined ? options.run_llm_analysis : true
      }
    };

    const backendRes = await fetch(`${GPU_BACKEND}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 300000,
    });

    const result = await backendRes.json();
    res.status(backendRes.status).json(result);
  } catch (e) {
    console.error('[ANALYZE ERROR]', e.message);
    res.status(500).json({
      job_id: req.body.job_id || 'unknown',
      status: 'failed',
      error_code: 'PROXY_ERROR',
      message: `Proxy error: ${e.message}`
    });
  }
});

// ── Version ──
app.get('/version', (req, res) => {
  res.json({
    name: 'Video Authenticity Agent',
    version: '1.0.0',
    model: 'STIL-Pipeline (EfficientNet-B4, fine-tuned on VideoSham+GenVidBench)',
    capabilities: ['deepfake_detection', 'manipulation_detection', 'ai_generated_video_detection', 'llm_reasoning']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Video Authenticity Agent proxy running on port ${PORT}`));
