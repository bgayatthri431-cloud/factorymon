<?php
// ── stream.php — Module 3: Production Line Broadcast Engine
// Keeps SSE connection open forever
// Polls MySQL every 2 seconds
// Pushes new events to ALL connected browsers instantly

include 'db.php';

// ── SSE Headers ───────────────────────────────────────────
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');
header('Access-Control-Allow-Origin: *');

// ── Read URL Parameters ───────────────────────────────────
$lastId = (int)($_GET['lastId'] ?? 0);
$line   = isset($_GET['line']) && in_array($_GET['line'], ['A','B'])
          ? $conn->real_escape_string($_GET['line'])
          : null;

// ── Confirm Connection ────────────────────────────────────
echo ": connected\n\n";
ob_flush();
flush();

// ── Infinite Broadcast Loop ───────────────────────────────
while (true) {

    // Build query — filter by line if requested
    $where = "id > $lastId";
    if ($line) {
        $where .= " AND line = '$line'";
    }

    $result = $conn->query(
        "SELECT * FROM machine_events
         WHERE $where
         ORDER BY id ASC
         LIMIT 10"
    );

    // Push new events to browser
    if ($result && $result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            echo "id: " . $row['id'] . "\n";
            echo "data: " . json_encode($row) . "\n\n";
            $lastId = (int)$row['id'];
        }
        ob_flush();
        flush();
    }

    // Heartbeat — keeps connection alive
    echo ": heartbeat\n\n";
    ob_flush();
    flush();

    // Exit if browser disconnected
    if (connection_aborted()) {
        break;
    }

    // Wait 2 seconds before next poll
    sleep(2);
}

$conn->close();
?>
