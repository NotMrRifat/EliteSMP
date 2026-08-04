package eu.elitesmp.telegrambridge;

import org.bukkit.plugin.java.JavaPlugin;
import java.util.logging.Logger;

public class EliteTelegramBridge extends JavaPlugin {

    private HttpBridgeServer httpServer;
    private EventListener eventListener;
    private long startTime;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        this.startTime = System.currentTimeMillis();

        Logger logger = getLogger();
        int port = getConfig().getInt("port", 8080);
        String bridgeKey = getConfig().getString("bridge-key", "change_me_to_your_secure_bridge_key");
        String webhookUrl = getConfig().getString("vercel-events-url", "");
        boolean webhooksEnabled = getConfig().getBoolean("enable-event-webhooks", true);

        try {
            this.httpServer = new HttpBridgeServer(this, port, bridgeKey);
            this.httpServer.start();
            logger.info("EliteTelegramBridge HTTP REST API listening on port " + port);
        } catch (Exception e) {
            logger.severe("Failed to start EliteTelegramBridge HTTP Server: " + e.getMessage());
        }

        if (webhooksEnabled && webhookUrl != null && !webhookUrl.isEmpty()) {
            this.eventListener = new EventListener(this, webhookUrl, bridgeKey);
            getServer().getPluginManager().registerEvents(this.eventListener, this);
            logger.info("EliteTelegramBridge event webhooks enabled. Target: " + webhookUrl);

            // Notify Vercel that server is online
            this.eventListener.sendEventAsync("SERVER_ONLINE", null);
        }

        logger.info("EliteTelegramBridge successfully enabled!");
    }

    @Override
    public void onDisable() {
        if (this.eventListener != null) {
            this.eventListener.sendEventSync("SERVER_OFFLINE", null);
        }

        if (this.httpServer != null) {
            this.httpServer.stop();
        }

        getLogger().info("EliteTelegramBridge disabled.");
    }

    public long getStartTime() {
        return startTime;
    }

    public String getUptimeFormatted() {
        long millis = System.currentTimeMillis() - startTime;
        long seconds = millis / 1000;
        long hours = seconds / 3600;
        long minutes = (seconds % 3600) / 60;
        return hours + "h " + minutes + "m";
    }
}
