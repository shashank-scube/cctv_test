import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 8080;
const BASE_URL = process.env.RAILWAY_STATIC_URL
  ? `https://${process.env.RAILWAY_STATIC_URL}`
  : `http://localhost:${PORT}`;

// 📁 HLS Folder
const HLS_FOLDER = path.join(process.cwd(), 'hls');
if (!fs.existsSync(HLS_FOLDER)) fs.mkdirSync(HLS_FOLDER);

// 🔥 Track running streams
const runningStreams = new Map();

/**
 * ▶ START STREAM
 */
app.post('/start', (req, res) => {
  const cameras = req.body;
  const result = [];

  cameras.forEach((cam) => {
    const safeName = cam.placeName.replace(/\s+/g, '_');
    const outputPath = path.join(HLS_FOLDER, `${safeName}.m3u8`);

    // 🚫 Avoid duplicate streams
    if (runningStreams.has(safeName)) {
      result.push({
        placeName: cam.placeName,
        hlsUrl: `${BASE_URL}/hls/${safeName}.m3u8`,
        status: 'already_running'
      });
      return;
    }

    const ffmpeg = spawn('ffmpeg', [
      '-rtsp_transport', 'tcp',
      '-i', cam.rtspUrl,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-c:a', 'aac',
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '5',
      '-hls_flags', 'delete_segments',
      outputPath
    ]);

    ffmpeg.stderr.on('data', (data) => {
      console.log(`${safeName}: ${data}`);
    });
    ffmpeg.on('error', (err) => {
  console.error(`FFmpeg failed for ${safeName}`, err);
});

    ffmpeg.on('close', () => {
      console.log(`${safeName} stopped`);
      runningStreams.delete(safeName);
    });

    runningStreams.set(safeName, ffmpeg);

    result.push({
      placeName: cam.placeName,
      hlsUrl: `${BASE_URL}/hls/${safeName}.m3u8`,
      status: 'started'
    });
  });

  res.json(result);
});

/**
 * 🛑 STOP STREAM
 */
app.post('/stop', (req, res) => {
  const { placeName } = req.body;
  const safeName = placeName.replace(/\s+/g, '_');

  if (!runningStreams.has(safeName)) {
    return res.json({ message: 'Stream not running' });
  }

  const process = runningStreams.get(safeName);
  process.kill('SIGINT');
  runningStreams.delete(safeName);

  res.json({ message: 'Stream stopped' });
});

/**
 * 📊 LIST STREAMS
 */
app.get('/streams', (req, res) => {
  res.json(Array.from(runningStreams.keys()));
});
app.get('/', (req, res) => {
  res.send('CCTV HLS Server Running 🚀');
});
/**
 * 📺 SERVE HLS FILES
 */
app.use('/hls', express.static(HLS_FOLDER));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
