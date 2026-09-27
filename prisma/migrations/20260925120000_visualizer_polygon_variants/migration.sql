-- Scene: the tiled area may be any polygon; the four-corner quad only
-- describes the wall's perspective.
ALTER TABLE `VisualizerScene` ADD COLUMN `polygon` JSON NULL;

-- Product: one cut-out per colour ([{ label, cutout }]); `tileCutout` keeps the first.
ALTER TABLE `Product` ADD COLUMN `tileVariants` JSON NULL;
