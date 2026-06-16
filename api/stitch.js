// api/stitch.js — download Higgsfield clips, concat with ffmpeg (no re-encode), upload to Supabase
// Stream-copy concat is extremely fast (1-3s regardless of clip count) — safe within 60s Hobby limit

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const BUCKET = 'listing-photos'; // reuse existing bucket for final videos too

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase env vars not configured' });
  }

  const { clipUrls } = req.body;
  if (!clipUrls || !Array.isArray(clipUrls) || clipUrls.length < 2) {
    return res.status(400).json({ error: 'clipUrls array with at least 2 URLs required' });
  }

  // Cap at 6 clips (30 seconds max) regardless of plan
  const urls = clipUrls.slice(0, 6);
  const tmp = tmpdir();
  const clipPaths = [];
  const listPath = join(tmp, `concat-list-${Date.now()}.txt`);
  const outPath = join(tmp, `spark-listing-${Date.now()}.mp4`);

  try {
    // Step 1: Download all clips in parallel
    console.log(`Downloading ${urls.length} clips...`);
    await Promise.all(urls.map(async (url, i) => {
      const clipPath = join(tmp, `clip-${Date.now()}-${i}.mp4`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to download clip ${i}: ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(clipPath, buffer);
      clipPaths[i] = clipPath; // preserve order
      console.log(`Clip ${i} downloaded: ${buffer.length} bytes`);
    }));

    // Step 2: Write ffmpeg concat list
    const listContent = clipPaths.map(p => `file '${p}'`).join('\n');
    writeFileSync(listPath, listContent);
    console.log('Concat list:\n', listContent);

    // Step 3: Concat with stream copy — no re-encode, extremely fast
    // -fflags +genpts regenerates timestamps to avoid sync issues between clips
    const ffmpegPath = getFfmpegPath();
    try { execSync(`chmod +x "${ffmpegPath}"`); } catch {}
    const cmd = `"${ffmpegPath}" -f concat -safe 0 -i "${listPath}" -c copy -fflags +genpts -y "${outPath}"`;
    console.log('Running ffmpeg:', cmd);
    execSync(cmd, { timeout: 30000 }); // 30s timeout for ffmpeg itself
    console.log('ffmpeg concat complete');

    // Step 4: Upload stitched video to Supabase Storage
    const videoBuffer = readFileSync(outPath);
    const fileName = `listing-video-${Date.now()}.mp4`;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, videoBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError.message);
      return res.status(500).json({ error: 'Failed to upload stitched video' });
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    const finalUrl = publicData?.publicUrl;
    console.log('Final stitched video:', finalUrl);

    return res.status(200).json({ url: finalUrl, clips: urls.length });

  } catch (error) {
    console.error('Stitch error:', error.message);
    return res.status(500).json({ error: error.message });
  } finally {
    // Cleanup temp files
    [...clipPaths, listPath, outPath].forEach(p => {
      try { if(p && existsSync(p)) unlinkSync(p); } catch {}
    });
  }
}

// ffmpeg binary path — @ffmpeg-installer/ffmpeg provides a static binary
function getFfmpegPath() {
  return ffmpegInstaller?.path || 'ffmpeg';
}
