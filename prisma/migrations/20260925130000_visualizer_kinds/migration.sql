-- A tile is laid on a wall; a breeze block builds the wall itself (partition,
-- screen, facade). Scenes say which of the two they are for.
ALTER TABLE `Product` ADD COLUMN `tileKind` VARCHAR(16) NULL;
ALTER TABLE `VisualizerScene` ADD COLUMN `kind` VARCHAR(16) NOT NULL DEFAULT 'wall';
