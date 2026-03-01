-- ============================================================
--  FACTORY MACHINE MONITOR — Database Schema
--  Import this file in phpMyAdmin
-- ============================================================

CREATE DATABASE IF NOT EXISTS factory_monitor;
USE factory_monitor;

-- Machine Events Table (core table)
CREATE TABLE machine_events (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    machine_id      VARCHAR(50)  NOT NULL,          -- e.g. "M1", "M2"
    machine_name    VARCHAR(100) NOT NULL,           -- e.g. "Compressor A1"
    line            ENUM('A','B') NOT NULL,          -- Production Line
    sensor_type     VARCHAR(50)  DEFAULT 'temperature',
    sensor_value    DECIMAL(8,2) NOT NULL,           -- e.g. 87.5 (°C)
    unit            VARCHAR(20)  DEFAULT '°C',
    status          ENUM('normal','warning','critical') DEFAULT 'normal',
    event_type      ENUM('reading','fault','resolved') DEFAULT 'reading',
    threshold_max   DECIMAL(8,2) DEFAULT 85.00,      -- fault fires above this
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_line      (line),
    INDEX idx_machine   (machine_id),
    INDEX idx_status    (status),
    INDEX idx_created   (created_at)
);

-- Fault Log Table
CREATE TABLE fault_log (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    event_id        INT,
    machine_id      VARCHAR(50),
    machine_name    VARCHAR(100),
    line            ENUM('A','B'),
    fault_value     DECIMAL(8,2),
    fault_time      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved        TINYINT(1) DEFAULT 0,
    resolved_at     TIMESTAMP NULL,
    FOREIGN KEY (event_id) REFERENCES machine_events(id)
);

-- Machines Reference Table
CREATE TABLE machines (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    machine_id      VARCHAR(50) UNIQUE NOT NULL,
    machine_name    VARCHAR(100) NOT NULL,
    line            ENUM('A','B') NOT NULL,
    threshold_max   DECIMAL(8,2) DEFAULT 85.00,
    is_active       TINYINT(1) DEFAULT 1
);

-- Seed machines
INSERT INTO machines (machine_id, machine_name, line, threshold_max) VALUES
('M1', 'Compressor A1',    'A', 85.00),
('M2', 'Conveyor A2',      'A', 80.00),
('M3', 'Hydraulic Press A3','A', 90.00),
('M4', 'Compressor B1',    'B', 85.00),
('M5', 'Conveyor B2',      'B', 80.00),
('M6', 'Hydraulic Press B3','B', 90.00);

-- Seed some sample events
INSERT INTO machine_events (machine_id, machine_name, line, sensor_value, status, event_type) VALUES
('M1', 'Compressor A1',     'A', 72.3, 'normal',   'reading'),
('M2', 'Conveyor A2',       'A', 65.1, 'normal',   'reading'),
('M3', 'Hydraulic Press A3','A', 88.5, 'warning',  'reading'),
('M4', 'Compressor B1',     'B', 70.0, 'normal',   'reading'),
('M5', 'Conveyor B2',       'B', 77.4, 'normal',   'reading'),
('M6', 'Hydraulic Press B3','B', 91.2, 'critical', 'fault');
