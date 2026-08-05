<?php

namespace EliteTelegramBridge;

use pocketmine\plugin\PluginBase;
use pocketmine\event\Listener;
use pocketmine\event\player\PlayerJoinEvent;
use pocketmine\event\player\PlayerQuitEvent;
use pocketmine\console\ConsoleCommandSender;
use pocketmine\player\Player;
use pocketmine\scheduler\ClosureTask;

class Main extends PluginBase implements Listener {

    private string $webhookUrl = "";
    private string $bridgeKey = "";
    private string $serverName = "EliteSMP Bedrock";
    private int $startTime = 0;
    private array $lastEventTimes = [];

    public function onEnable(): void {
        $this->saveDefaultConfig();
        $this->startTime = time();

        $config = $this->getConfig();
        $this->webhookUrl = (string) $config->get("vercel-events-url", "");
        $this->bridgeKey = (string) $config->get("bridge-key", "");
        $this->serverName = (string) $config->get("server-name", "EliteSMP Bedrock");

        $this->getServer()->getPluginManager()->registerEvents($this, $this);

        $this->getLogger()->info("EliteTelegramBridge Bedrock Edition (PocketMine-MP) enabled!");

        if (!empty($this->webhookUrl) && $config->get("enable-event-webhooks", true)) {
            $this->getLogger()->info("Event webhooks enabled targeting: " . $this->webhookUrl);
            $this->sendEventAsync("SERVER_ONLINE", null, count($this->getServer()->getOnlinePlayers()), $this->getServer()->getMaxPlayers());
        }

        // Start HTTP REST listener thread/socket if enabled
        if ($config->get("enable-rest-api", true)) {
            $port = (int) $config->get("port", 8080);
            $this->startRestServer($port);
        }
    }

    public function onDisable(): void {
        if (!empty($this->webhookUrl) && $this->getConfig()->get("enable-event-webhooks", true)) {
            $this->sendEventSync("SERVER_OFFLINE", null, 0, $this->getServer()->getMaxPlayers());
        }
        $this->getLogger()->info("EliteTelegramBridge disabled.");
    }

    /**
     * Handle Bedrock Player Join Event
     */
    public function onPlayerJoin(PlayerJoinEvent $event): void {
        $player = $event->getPlayer()->getName();
        $online = count($this->getServer()->getOnlinePlayers());
        $max = $this->getServer()->getMaxPlayers();

        $this->sendEventAsync("PLAYER_JOIN", $player, $online, $max);
    }

    /**
     * Handle Bedrock Player Quit Event
     */
    public function onPlayerQuit(PlayerQuitEvent $event): void {
        $player = $event->getPlayer()->getName();
        $online = max(0, count($this->getServer()->getOnlinePlayers()) - 1);
        $max = $this->getServer()->getMaxPlayers();

        $this->sendEventAsync("PLAYER_QUIT", $player, $online, $max);
    }

    /**
     * Dispatch event webhooks asynchronously
     */
    public function sendEventAsync(string $type, ?string $player, int $online, int $max): void {
        // Throttling / Deduplication check (3 seconds)
        $eventKey = $type . ":" . ($player ?? "server");
        $now = time();
        if (isset($this->lastEventTimes[$eventKey]) && ($now - $this->lastEventTimes[$eventKey]) < 3) {
            return;
        }
        $this->lastEventTimes[$eventKey] = $now;

        $url = $this->webhookUrl;
        $key = $this->bridgeKey;

        if (empty($url)) return;

        $payload = json_encode([
            "type" => $type,
            "player" => $player,
            "online" => $online,
            "max" => $max,
            "server" => $this->serverName,
            "platform" => "Bedrock (PocketMine-MP)"
        ]);

        // Schedule async cURL dispatch via task
        $this->getScheduler()->scheduleTask(new ClosureTask(function() use ($url, $key, $payload): void {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                "Content-Type: application/json",
                "X-Bridge-Key: " . $key
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 4);
            curl_exec($ch);
            curl_close($ch);
        }));
    }

    /**
     * Dispatch event webhooks synchronously (for shutdown)
     */
    public function sendEventSync(string $type, ?string $player, int $online, int $max): void {
        $url = $this->webhookUrl;
        $key = $this->bridgeKey;

        if (empty($url)) return;

        $payload = json_encode([
            "type" => $type,
            "player" => $player,
            "online" => $online,
            "max" => $max,
            "server" => $this->serverName,
            "platform" => "Bedrock (PocketMine-MP)"
        ]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Content-Type: application/json",
            "X-Bridge-Key: " . $key
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        curl_exec($ch);
        curl_close($ch);
    }

    /**
     * Embedded REST API Server for PocketMine-MP
     */
    private function startRestServer(int $port): void {
        try {
            $server = @stream_socket_server("tcp://0.0.0.0:" . $port, $errno, $errstr);
            if (!$server) {
                $this->getLogger()->notice("REST server HTTP listener could not bind to port {$port}: {$errstr}. (Webhooks outbound to Vercel active!)");
                return;
            }

            stream_set_blocking($server, false);
            $this->getLogger()->info("HTTP REST Server listening on port {$port}");

            $this->getScheduler()->scheduleRepeatingTask(new ClosureTask(function() use ($server): void {
                $client = @stream_socket_accept($server, 0);
                if ($client) {
                    $request = fread($client, 2048);
                    $response = $this->handleHttpRequest($request);
                    fwrite($client, $response);
                    fclose($client);
                }
            }), 1);
        } catch (\Throwable $e) {
            $this->getLogger()->notice("REST Server initialization notice: " . $e->getMessage());
        }
    }

    private function handleHttpRequest(string $request): string {
        $lines = explode("\r\n", $request);
        $firstLine = $lines[0] ?? "";
        $parts = explode(" ", $firstLine);
        $method = $parts[0] ?? "GET";
        $path = parse_url($parts[1] ?? "/", PHP_URL_PATH);

        // Header check
        $providedKey = "";
        foreach ($lines as $line) {
            if (stripos($line, "X-Bridge-Key:") === 0) {
                $providedKey = trim(substr($line, 13));
            }
        }

        if (!empty($this->bridgeKey) && $providedKey !== $this->bridgeKey && $this->bridgeKey !== "change_me_to_your_secure_bridge_key") {
            return "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\n\r\n" . json_encode(["ok" => false, "error" => "Unauthorized"]);
        }

        if ($path === "/status" || $path === "/") {
            $players = [];
            foreach ($this->getServer()->getOnlinePlayers() as $p) {
                $players[] = $p->getName();
            }
            $data = [
                "ok" => true,
                "state" => "🟢 ONLINE",
                "rawState" => "ONLINE",
                "serverName" => $this->serverName,
                "players" => [
                    "online" => count($players),
                    "max" => $this->getServer()->getMaxPlayers(),
                    "names" => $players
                ],
                "uptime" => gmdate("H\\h i\\m", time() - $this->startTime),
                "tps" => round($this->getServer()->getTicksPerSecond(), 1),
                "version" => "PocketMine-MP Bedrock " . $this->getServer()->getPocketMineVersion()
            ];
            return "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n" . json_encode($data);
        }

        if ($path === "/players") {
            $players = [];
            foreach ($this->getServer()->getOnlinePlayers() as $p) {
                $players[] = $p->getName();
            }
            $data = [
                "ok" => true,
                "online" => count($players),
                "max" => $this->getServer()->getMaxPlayers(),
                "names" => $players
            ];
            return "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n" . json_encode($data);
        }

        if ($path === "/say" && $method === "POST") {
            $bodyPos = strpos($request, "\r\n\r\n");
            $body = $bodyPos !== false ? substr($request, $bodyPos + 4) : "";
            $json = json_decode($body, true);
            $msg = $json["message"] ?? null;

            if ($msg) {
                $announcement = "[Telegram] " . $msg;
                $this->getServer()->broadcastMessage($announcement);
                return "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n" . json_encode(["ok" => true, "message" => $announcement]);
            }
            return "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n\r\n" . json_encode(["ok" => false, "error" => "Message required"]);
        }

        if ($path === "/command" && $method === "POST") {
            $bodyPos = strpos($request, "\r\n\r\n");
            $body = $bodyPos !== false ? substr($request, $bodyPos + 4) : "";
            $json = json_decode($body, true);
            $cmd = $json["command"] ?? null;

            if ($cmd) {
                $this->getServer()->dispatchCommand(new ConsoleCommandSender($this->getServer(), $this->getServer()->getLanguage()), $cmd);
                return "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n" . json_encode(["ok" => true, "command" => $cmd, "output" => "Executed command: " . $cmd]);
            }
            return "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n\r\n" . json_encode(["ok" => false, "error" => "Command required"]);
        }

        return "HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\n\r\n" . json_encode(["ok" => false, "error" => "Not Found"]);
    }
}
