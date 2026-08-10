-- AlterTable
ALTER TABLE `article` ADD COLUMN `translations` JSON NULL;

-- AlterTable
ALTER TABLE `category` ADD COLUMN `translations` JSON NULL;

-- AlterTable
ALTER TABLE `product` ADD COLUMN `translations` JSON NULL;

-- AlterTable
ALTER TABLE `project` ADD COLUMN `translations` JSON NULL;
