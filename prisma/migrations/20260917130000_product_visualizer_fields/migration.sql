-- AlterTable
ALTER TABLE `Product`
    ADD COLUMN `tileShape` VARCHAR(32) NULL,
    ADD COLUMN `tileTexture` VARCHAR(500) NULL,
    ADD COLUMN `tileWidthCm` DOUBLE NULL,
    ADD COLUMN `tileHeightCm` DOUBLE NULL;
