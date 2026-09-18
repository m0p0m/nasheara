-- Product: the flat glaze texture is replaced by a transparent PNG cut-out of
-- one whole tile, which carries its real outline into the visualizer.
ALTER TABLE `Product`
    DROP COLUMN `tileTexture`,
    ADD COLUMN `tileCutout` VARCHAR(500) NULL;

-- Admin-managed photo scenes for the visualizer
CREATE TABLE `VisualizerScene` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NULL,
    `nameAr` VARCHAR(191) NULL,
    `image` VARCHAR(500) NOT NULL,
    `overlay` VARCHAR(500) NULL,
    `quad` JSON NOT NULL,
    `wallWidthCm` DOUBLE NOT NULL DEFAULT 240,
    `wallHeightCm` DOUBLE NOT NULL DEFAULT 60,
    `lighting` DOUBLE NOT NULL DEFAULT 0.8,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
