// Prepares product/project videos for the site. Needs ffmpeg + ffprobe on PATH
// (Windows: `winget install Gyan.FFmpeg`, then open a new terminal).
//
//   node scripts/prepare-videos.js <input-folder> [output-folder] [--clip-start=SECONDS] [--clip-length=SECONDS]
//
// For every video in the input folder it writes three files to the output
// folder (default: <input-folder>/prepared):
//   <name>-aparat.mp4  full video, 1080p max, H.264 — smaller upload for Aparat
//   <name>-clip.mp4    short muted loop (default 8 s from the middle), 720p,
//                      kept under 5 MB — the "short clip" field in the admin panel
//   <name>-poster.jpg  a frame from the clip — the "video cover" field
// Originals are never modified.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEO_EXT = /\.(mp4|mov|m4v|avi|mkv|webm|3gp)$/i;
const CLIP_LIMIT = 4.8 * 1024 * 1024; // admin upload limit is 5 MB

const args = process.argv.slice(2);
const flag = name => {
    const hit = args.find(a => a.startsWith(`--${name}=`));
    return hit ? parseFloat(hit.split('=')[1]) : null;
};
const [input, outputArg] = args.filter(a => !a.startsWith('--'));
if (!input) {
    console.error('Usage: node scripts/prepare-videos.js <input-folder> [output-folder] [--clip-start=S] [--clip-length=S]');
    process.exit(1);
}
const output = outputArg || path.join(input, 'prepared');
const clipLength = flag('clip-length') || 8;

const run = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
try { run('ffmpeg', ['-version']); run('ffprobe', ['-version']); } catch (e) {
    console.error('ffmpeg/ffprobe not found. Install with: winget install Gyan.FFmpeg  (then open a new terminal)');
    process.exit(1);
}

const duration = file => parseFloat(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])) || 0;
const mb = file => (fs.statSync(file).size / 1024 / 1024).toFixed(1) + ' MB';

fs.mkdirSync(output, { recursive: true });
const files = fs.readdirSync(input).filter(f => VIDEO_EXT.test(f) && fs.statSync(path.join(input, f)).isFile());
if (!files.length) { console.error('No videos found in', input); process.exit(1); }

for (const name of files) {
    const src = path.join(input, name);
    const base = path.join(output, path.parse(name).name.replace(/[^\p{L}\p{N}_-]+/gu, '-'));
    const total = duration(src);
    const start = flag('clip-start') ?? Math.max(0, total / 2 - clipLength / 2);
    const len = Math.min(clipLength, total || clipLength);
    console.log(`\n${name}  (${total.toFixed(1)} s, ${mb(src)})`);

    // Full video for Aparat: keep the audio, cap at 1080p, fast start for streaming.
    run('ffmpeg', ['-y', '-i', src, '-vf', "scale='min(1920,iw)':-2", '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', `${base}-aparat.mp4`]);
    console.log('  aparat:', mb(`${base}-aparat.mp4`));

    // Short muted loop for the site; raise compression until it fits the upload limit.
    for (const crf of [28, 32, 36]) {
        run('ffmpeg', ['-y', '-ss', String(start), '-t', String(len), '-i', src, '-an', '-vf', "scale='min(1280,iw)':-2,fps=30",
            '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${base}-clip.mp4`]);
        if (fs.statSync(`${base}-clip.mp4`).size <= CLIP_LIMIT) break;
    }
    console.log('  clip:  ', mb(`${base}-clip.mp4`));

    run('ffmpeg', ['-y', '-ss', String(start), '-i', src, '-frames:v', '1', '-vf', "scale='min(1280,iw)':-2", '-q:v', '3', `${base}-poster.jpg`]);
    console.log('  poster:', mb(`${base}-poster.jpg`));
}
console.log(`\nDone. Files are in ${output}`);
