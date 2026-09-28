-- Aparat videos, a short self-hosted clip and a poster per product/project.
ALTER TABLE `Product` ADD COLUMN `video` JSON NULL;
ALTER TABLE `Project` ADD COLUMN `video` JSON NULL;
