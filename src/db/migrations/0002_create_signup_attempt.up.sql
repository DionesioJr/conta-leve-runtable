CREATE TABLE `signup_attempt` (
  `scope` VARCHAR(32) NOT NULL,
  `subject_hash` CHAR(64) NOT NULL,
  `window_start_ms` BIGINT UNSIGNED NOT NULL,
  `attempts` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`scope`, `subject_hash`, `window_start_ms`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
