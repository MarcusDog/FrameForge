package studio.frameforge;
import org.apache.ibatis.annotations.*;
import java.util.List;
import static studio.frameforge.Models.*;

@Mapper
public interface StoreMapper {
    @Select("SELECT * FROM demo_user ORDER BY id") List<DemoUser> users();
    @Select("SELECT * FROM demo_user WHERE id=#{id}") DemoUser user(String id);
    @Select("""
        SELECT p.user_id,p.nickname,p.bio,p.avatar_color,p.avatar_asset_id,
          CASE WHEN a.id IS NOT NULL THEN CONCAT('/api/assets/',a.id,'/content?v=',p.version) END AS avatar_url,
          p.version,p.created_at,p.updated_at
        FROM user_profile p LEFT JOIN asset a ON a.id=p.avatar_asset_id AND a.user_id=p.user_id
        WHERE p.user_id=#{userId}
        """)
    UserProfile profile(String userId);
    @Update("""
        UPDATE user_profile SET nickname=#{profile.nickname},bio=#{profile.bio},avatar_color=#{profile.avatarColor},
          avatar_asset_id=#{profile.avatarAssetId},version=version+1,updated_at=CURRENT_TIMESTAMP(3)
        WHERE user_id=#{userId} AND version=#{profile.version}
        """)
    int updateProfile(@Param("userId") String userId,@Param("profile") ProfileRequest profile);
    @Select("""
        SELECT COUNT(*) AS total_tasks,
          COALESCE(SUM(status IN ('QUEUED','RUNNING')),0) AS active_tasks,
          COALESCE(SUM(status='SUCCEEDED'),0) AS succeeded_tasks,
          COALESCE(SUM(status='FAILED'),0) AS failed_tasks,
          (SELECT COUNT(*) FROM asset WHERE user_id=#{userId}) AS asset_count
        FROM task WHERE user_id=#{userId}
        """)
    UserSummary summary(String userId);
    @Select("SELECT * FROM template ORDER BY id") List<Template> templates();
    @Select("SELECT * FROM template WHERE id=#{id}") Template template(String id);
    @Insert("INSERT INTO asset(id,user_id,path,mime_type,size_bytes,width,height) VALUES(#{id},#{userId},#{path},#{mimeType},#{sizeBytes},#{width},#{height})")
    void insertAsset(Asset asset);
    @Select("SELECT * FROM asset WHERE id=#{id} AND user_id=#{userId}")
    Asset asset(@Param("id") String id, @Param("userId") String userId);
    @Select("SELECT a.* FROM asset a JOIN task_asset ta ON ta.asset_id=a.id WHERE ta.task_id=#{id} ORDER BY ta.position")
    List<Asset> taskAssets(String id);
}
