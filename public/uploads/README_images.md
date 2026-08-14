Guidelines for adding images to this project

1) Place images into `public/uploads/incoming/` using the suggested filename patterns below.

2) Filename patterns (examples):
   - product-<slug>-main.jpg
   - product-<slug>-gallery-1.jpg
   - product-<slug>-gallery-2.jpg
   - project-<slug>-cover.jpg
   - project-<slug>-gallery-1.jpg

3) After copying images, run:

   npm run apply-images

   (This runs `node scripts/apply_incoming_images.js` which reads files and updates DB records.)

4) Naming conventions:
   - Use the product/project `slug` (see products/projects URLs) for the filename.
   - Use only lowercase letters, numbers and hyphens for slugs.
   - Keep image sizes reasonable for web (max 2000px on long side). Use WebP if possible.

5) Attribution:
   - If you download images from Unsplash or Pexels, include a short attribution in this file with URLs and photographer names.

