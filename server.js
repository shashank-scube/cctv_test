import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const HLS_FOLDER = path.join(process.cwd(), 'hls');
if (!fs.existsSync(HLS_FOLDER)) fs.mkdirSync(HLS_FOLDER);

app.post('/convertToHls', (req, res) => {
  const cameras = req.body;
  const result = [];

  cameras.forEach((cam) => {
    const safeName = cam.placeName.replace(/\s+/g, '_');
    const outputPath = path.join(HLS_FOLDER, `${safeName}.m3u8`);

    // ✅ FIXED FFmpeg command
    exec(`ffmpeg -i "${cam.rtspUrl}" \
    -c:v libx264 -preset veryfast -tune zerolatency \
    -c:a aac \
    -f hls \
    -hls_time 2 \
    -hls_list_size 5 \
    -hls_flags delete_segments \
    "${outputPath}"`, 
    (err) => {
      if (err) console.error(`FFmpeg error for ${cam.placeName}:`, err);
    });

    result.push({
      placeName: cam.placeName,
      hlsUrl: `http://localhost:8080/hls/${safeName}.m3u8`
    });
  });

  res.json(result);
});

app.use('/hls', express.static(HLS_FOLDER));
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));