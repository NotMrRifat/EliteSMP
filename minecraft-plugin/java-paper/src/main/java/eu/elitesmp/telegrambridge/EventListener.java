package eu.elitesmp.telegrambridge;

import org.bukkit.Bukkit;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

public class EventListener implements Listener {

    private final EliteTelegramBridge plugin;
    private final String webhookUrl;
    private final String bridgeKey;
    private final Map<String, Long> lastEventTimeMap = new ConcurrentHashMap<>();
    private static final long DUP_THROTTLE_MS = 3000;

    public EventListener(EliteTelegramBridge plugin, String webhookUrl, String bridgeKey) {
        this.plugin = plugin;
        this.webhookUrl = webhookUrl;
        this.bridgeKey = bridgeKey;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPlayerJoin(PlayerJoinEvent event) {
        int online = Bukkit.getOnlinePlayers().size();
        int max = Bukkit.getMaxPlayers();
        String player = event.getPlayer().getName();

        sendEventAsync("PLAYER_JOIN", player, online, max);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPlayerQuit(PlayerQuitEvent event) {
        int online = Math.max(0, Bukkit.getOnlinePlayers().size() - 1);
        int max = Bukkit.getMaxPlayers();
        String player = event.getPlayer().getName();

        sendEventAsync("PLAYER_QUIT", player, online, max);
    }

    public void sendEventAsync(String type, String player) {
        sendEventAsync(type, player, Bukkit.getOnlinePlayers().size(), Bukkit.getMaxPlayers());
    }

    public void sendEventAsync(String type, String player, int online, int max) {
        CompletableFuture.runAsync(() -> sendEventSync(type, player, online, max));
    }

    public void sendEventSync(String type, String player) {
        sendEventSync(type, player, Bukkit.getOnlinePlayers().size(), Bukkit.getMaxPlayers());
    }

    public void sendEventSync(String type, String player, int online, int max) {
        if (webhookUrl == null || webhookUrl.isEmpty() || !webhookUrl.startsWith("http")) {
            return;
        }

        String eventKey = type + ":" + (player != null ? player : "server");
        long now = System.currentTimeMillis();
        Long lastTime = lastEventTimeMap.get(eventKey);
        if (lastTime != null && (now - lastTime) < DUP_THROTTLE_MS) {
            // Throttled duplicate event within 3 seconds
            return;
        }
        lastEventTimeMap.put(eventKey, now);

        try {
            URL url = new URL(webhookUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; utf-8");
            conn.setRequestProperty("Accept", "application/json");
            if (bridgeKey != null && !bridgeKey.isEmpty()) {
                conn.setRequestProperty("X-Bridge-Key", bridgeKey);
            }
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);
            conn.setDoOutput(true);

            String playerJson = (player != null) ? "\"" + escapeJson(player) + "\"" : "null";
            String jsonPayload = String.format(
                "{\"type\":\"%s\",\"player\":%s,\"online\":%d,\"max\":%d}",
                escapeJson(type), playerJson, online, max
            );

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonPayload.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int responseCode = conn.getResponseCode();
            if (responseCode >= 400) {
                plugin.getLogger().warning("Event webhook POST to " + webhookUrl + " returned status code " + responseCode);
            }
            conn.disconnect();
        } catch (Exception e) {
            plugin.getLogger().warning("Failed to dispatch event webhook (" + type + "): " + e.getMessage());
        }
    }

    private String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
