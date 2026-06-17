-- Users table for the golden-path demo.
-- H2 AUTO_INCREMENT is the portable equivalent of IDENTITY / SERIAL.
CREATE TABLE IF NOT EXISTS users (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
);
