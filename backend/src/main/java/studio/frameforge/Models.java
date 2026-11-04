package studio.frameforge;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;

public final class Models {
    private Models() {}
    public enum Stage { MATERIAL_CHECK, GENERATING, ORGANIZING }
    public enum Status { QUEUED, RUNNING, SUCCEEDED, FAILED;
        public boolean terminal() { return this == SUCCEEDED || this == FAILED; }
    }
    public record DemoUser(String id, String name) {}
    public record UserProfile(String userId,String nickname,String bio,String avatarColor,String avatarAssetId,
                              String avatarUrl,long version,Instant createdAt,Instant updatedAt) {}
    public record ProfileRequest(@NotBlank @Size(max=24) String nickname,
                                 @NotNull @Size(max=160) String bio,
                                 @NotBlank @Pattern(regexp="#[a-fA-F0-9]{6}") String avatarColor,
                                 @Size(max=36) String avatarAssetId,@NotNull @Min(0) Long version) {}
    public record UserSummary(long totalTasks,long activeTasks,long succeededTasks,long failedTasks,long assetCount) {}
    public record Template(String id, String title, String category, String description,
                           int requiredImageCount, String coverUrl, String layout) {
        @JsonProperty public List<String> acceptedMimeTypes() { return List.of("image/jpeg", "image/png"); }
        @JsonProperty public long maxFileSizeBytes() { return 5L * 1024 * 1024; }
    }
    public record Asset(String id, String userId, String path, String mimeType, long sizeBytes,
                        int width, int height, Instant createdAt) {
        public AssetView view() { return new AssetView(id, "/api/assets/" + id + "/content", mimeType, sizeBytes, width, height); }
    }
    public record AssetView(String id, String previewUrl, String mimeType, long sizeBytes, int width, int height) {}
    public record TaskRow(long seq, String id, String userId, String templateId, Status status,
                          Stage currentStage, String resultPath, String errorCode, String errorMessage,
                          String requestKey, String payloadHash, int checkMs, int generationMs, int organizeMs,
                          Stage failAt, long version, Instant createdAt, Instant updatedAt) {}
    public record StageRow(String taskId, Stage stage, String status, Instant startedAt,
                           Instant endedAt, Long durationMs, String errorMessage) {}
    public record TaskView(String id, String templateId, String templateTitle, String coverUrl, Status status,
                           Stage currentStage, String resultUrl, String errorCode, String errorMessage,
                           long version, Instant createdAt, Instant updatedAt,
                           List<StageRow> stages, List<AssetView> assets) {}
    public record TaskPage(List<TaskView> items, Long nextCursor) {}
    public record Accepted(String taskId, TaskView task) {}
    public record SessionRequest(@NotBlank String userId) {}
    public record Simulation(Stage failAt, @Min(0) @Max(30000) Integer checkMs,
                             @Min(0) @Max(30000) Integer generationMs, @Min(0) @Max(30000) Integer organizeMs) {}
    public record TaskRequest(@NotBlank String templateId, @NotEmpty @Size(max=3) List<@NotBlank String> assetIds,
                              @NotBlank @Size(max=80) String requestKey, @Valid Simulation simulation) {}
    public record TaskCreated(String id) {}
}
