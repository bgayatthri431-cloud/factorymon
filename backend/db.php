<?php
// ── db.php — Database Connection ─────────────────────────
// Reads Railway env variables in production
// Falls back to XAMPP defaults for local development

$host = getenv('MYSQLHOST')     ?: getenv('MYSQL_HOST')     ?: 'localhost';
$db   = getenv('MYSQLDATABASE') ?: getenv('MYSQL_DATABASE') ?: 'factory_monitor';
$user = getenv('MYSQLUSER')     ?: getenv('MYSQL_USER')     ?: 'root';
$pass = getenv('MYSQLPASSWORD') ?: getenv('MYSQL_PASSWORD') ?: '';
$port = (int)(getenv('MYSQLPORT') ?: getenv('MYSQL_PORT') ?: 3306);

$conn = new mysqli($host, $user, $pass, $db, $port);

if ($conn->connect_error) {
    http_response_code(500);
    header('Content-Type: application/json');
    die(json_encode([
        'error' => 'Database connection failed',
        'detail' => $conn->connect_error
    ]));
}

$conn->set_charset('utf8mb4');
?>
